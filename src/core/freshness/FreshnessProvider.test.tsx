import { useEffect, type ReactNode } from 'react'
import { render, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApolloClient, ApolloLink, InMemoryCache, Observable } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import {
  FreshnessProvider,
  FRESHNESS_TOPICS,
  MIN_REFRESH_GAP_MS,
  type FreshnessContextValue,
  type FreshnessTopic,
} from './FreshnessProvider'
import { useFreshness, useLiveRefresh } from './useLiveRefresh'
import { reportWsConnected, reportWsDisconnected, resetWsStatus } from '@/core/apollo/wsStatus'

// La sucursal viene del contexto de ubicación; aquí sólo importa que haya un
// slug estable para abrir las suscripciones.
vi.mock('@/core/location/useLocation', () => ({
  useLocation: () => ({
    locationId: 'loc1',
    locationName: 'Centro',
    locationSlug: 'centro',
    locationTimezone: 'America/Monterrey',
    setLocationId: () => {},
  }),
}))

// Apollo mockeado: un link que deja emitir a mano cada subscription por su
// nombre de operación. Así distinguimos "llegó un evento de venta" de "llegó
// uno de la fila", cosa que MockSubscriptionLink no permite (reparte el mismo
// resultado a todos los observers).
type Emitter = (data: Record<string, unknown>) => void
const emitters = new Map<string, Set<Emitter>>()

function createEventLink(): ApolloLink {
  return new ApolloLink(
    (operation) =>
      new Observable<ApolloLink.Result>((observer) => {
        const name = operation.operationName ?? 'anonymous'
        const emit: Emitter = (data) => observer.next({ data })
        const set = emitters.get(name) ?? new Set<Emitter>()
        set.add(emit)
        emitters.set(name, set)
        return () => {
          set.delete(emit)
        }
      }),
  )
}

function emit(operationName: string, data: Record<string, unknown>): void {
  const set = emitters.get(operationName)
  // Si nadie está suscrito, el provider no abrió el canal: es un fallo real.
  if (!set || set.size === 0) throw new Error(`Nadie suscrito a ${operationName}`)
  for (const send of [...set]) send(data)
}

const AT = '2026-09-19T18:36:00.000Z'
let saleSeq = 0

function emitSale(): void {
  saleSeq += 1
  const saleEvent = { __typename: 'SaleEvent', kind: 'CREATED', locationSlug: 'centro' }
  emit('PosHomeSaleEvent', { saleEvent: { ...saleEvent, saleId: `sale-${saleSeq}`, occurredAt: AT } })
}

function emitWalkIn(): void {
  const walkInQueueUpdated = { __typename: 'WalkInQueueEvent', kind: 'CREATED', locationSlug: 'centro' }
  emit('PosHomeWalkInQueueUpdated', {
    walkInQueueUpdated: { ...walkInQueueUpdated, walkInId: 'wi-1', occurredAt: AT },
  })
}

const ctxRef: { current: FreshnessContextValue | null } = { current: null }

function Capture() {
  const value = useFreshness()
  useEffect(() => {
    ctxRef.current = value
  }, [value])
  return null
}

function Probe({ load, topics }: { load: () => void; topics: readonly FreshnessTopic[] }) {
  useLiveRefresh(load, topics)
  return null
}

function ctx(): FreshnessContextValue {
  if (!ctxRef.current) throw new Error('contexto no capturado')
  return ctxRef.current
}

function tree(children: ReactNode, client: ApolloClient) {
  return (
    <ApolloProvider client={client}>
      <FreshnessProvider>
        {children}
        <Capture />
      </FreshnessProvider>
    </ApolloProvider>
  )
}

async function renderFreshness(children: ReactNode) {
  const client = new ApolloClient({ link: createEventLink(), cache: new InMemoryCache() })
  const utils = render(tree(children, client))
  // Deja que los efectos abran las suscripciones antes de emitir.
  await act(async () => {})
  return {
    ...utils,
    rerenderWith: (next: ReactNode) => utils.rerender(tree(next, client)),
  }
}

describe('FreshnessProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetWsStatus()
    emitters.clear()
    ctxRef.current = null
    saleSeq = 0
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('no invoca la carga al montar y un evento de venta refresca sólo el tema "sales"', async () => {
    const sales = vi.fn()
    const walkins = vi.fn()
    await renderFreshness(
      <>
        <Probe load={sales} topics={['sales']} />
        <Probe load={walkins} topics={['walkins']} />
      </>,
    )

    // La pantalla decide su carga inicial; registrarse no dispara nada.
    expect(sales).not.toHaveBeenCalled()
    expect(walkins).not.toHaveBeenCalled()
    expect(ctx().lastUpdatedAt).toBeNull()

    await act(async () => {
      emitSale()
    })

    expect(sales).toHaveBeenCalledTimes(1)
    expect(walkins).not.toHaveBeenCalled()
    // El refresco exitoso deja fecha para el "Actualizado 18:36".
    expect(ctx().lastUpdatedAt).toBeInstanceOf(Date)

    await act(async () => {
      emitWalkIn()
    })

    expect(walkins).toHaveBeenCalledTimes(1)
    expect(sales).toHaveBeenCalledTimes(1)
  })

  it('agrupa una ráfaga de 10 eventos en 1 refresco, con uno final al cerrar la ventana', async () => {
    const sales = vi.fn()
    await renderFreshness(<Probe load={sales} topics={['sales']} />)

    await act(async () => {
      for (let i = 0; i < 10; i += 1) emitSale()
    })

    expect(sales).toHaveBeenCalledTimes(1)

    // Al cerrarse la ventana de 5 s se hace UN refresco final porque llegaron
    // más eventos durante la ráfaga.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MIN_REFRESH_GAP_MS)
    })
    expect(sales).toHaveBeenCalledTimes(2)

    // Y ahí se acaba: sin eventos nuevos no hay más consultas.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MIN_REFRESH_GAP_MS * 4)
    })
    expect(sales).toHaveBeenCalledTimes(2)
  })

  it('la reconexión refresca todos los temas UNA vez; la primera conexión no', async () => {
    const sales = vi.fn()
    const walkins = vi.fn()
    const both = vi.fn()
    await renderFreshness(
      <>
        <Probe load={sales} topics={['sales']} />
        <Probe load={walkins} topics={['walkins']} />
        <Probe load={both} topics={['sales', 'appointments']} />
      </>,
    )

    // Primera conexión: no se perdió nada, no hay que ponerse al día.
    await act(async () => {
      reportWsConnected()
    })
    expect(sales).not.toHaveBeenCalled()
    expect(walkins).not.toHaveBeenCalled()
    expect(both).not.toHaveBeenCalled()
    expect(ctx().connection).toBe('connected')

    await act(async () => {
      reportWsDisconnected()
    })
    expect(ctx().connection).toBe('reconnecting')

    await act(async () => {
      reportWsConnected(true)
    })

    expect(sales).toHaveBeenCalledTimes(1)
    expect(walkins).toHaveBeenCalledTimes(1)
    // Un cargador en dos temas corre UNA vez aunque ambos se refresquen.
    expect(both).toHaveBeenCalledTimes(1)
    expect(ctx().connection).toBe('connected')
  })

  it('marca la conexión como "offline" si la caída se prolonga', async () => {
    await renderFreshness(null)

    await act(async () => {
      reportWsConnected()
      reportWsDisconnected()
    })
    expect(ctx().connection).toBe('reconnecting')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(ctx().connection).toBe('offline')
  })

  it('en pausa (cobro en vuelo) no refresca, y al reanudar ejecuta lo pendiente', async () => {
    const sales = vi.fn()
    await renderFreshness(<Probe load={sales} topics={['sales']} />)

    await act(async () => {
      ctx().setPaused(true)
    })

    await act(async () => {
      emitSale()
      emitSale()
    })
    expect(sales).not.toHaveBeenCalled()

    await act(async () => {
      ctx().setPaused(false)
    })
    expect(sales).toHaveBeenCalledTimes(1)
  })

  it('refreshAll() y el foco refrescan todos los temas', async () => {
    const sales = vi.fn()
    const appointments = vi.fn()
    await renderFreshness(
      <>
        <Probe load={sales} topics={['sales']} />
        <Probe load={appointments} topics={['appointments']} />
      </>,
    )

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(sales).toHaveBeenCalledTimes(1)
    expect(appointments).toHaveBeenCalledTimes(1)

    // refreshAll ignora la ventana de 5 s: es la red de seguridad manual.
    await act(async () => {
      ctx().refreshAll()
    })
    expect(sales).toHaveBeenCalledTimes(2)
    expect(appointments).toHaveBeenCalledTimes(2)
  })

  it('desmontar la pantalla desregistra su carga', async () => {
    const sales = vi.fn()
    const { rerenderWith } = await renderFreshness(<Probe load={sales} topics={['sales']} />)

    await act(async () => {
      emitSale()
    })
    expect(sales).toHaveBeenCalledTimes(1)

    await act(async () => {
      rerenderWith(null)
    })

    // Fuera de la ventana de agrupación para que el siguiente evento sí
    // intentaría refrescar... si quedara algo registrado.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MIN_REFRESH_GAP_MS + 1_000)
    })
    await act(async () => {
      emitSale()
    })
    expect(sales).toHaveBeenCalledTimes(1)
  })

  it('no existe ningún temporizador periódico de consulta', async () => {
    const sales = vi.fn()
    const walkins = vi.fn()
    await renderFreshness(
      <>
        <Probe load={sales} topics={['sales']} />
        <Probe load={walkins} topics={['walkins']} />
      </>,
    )

    // Cinco minutos de terminal encendida sin eventos y sin foco: cero
    // consultas. Si alguien reintroduce un latido, esto falla.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000)
    })

    expect(sales).not.toHaveBeenCalled()
    expect(walkins).not.toHaveBeenCalled()
    expect(ctx().lastUpdatedAt).toBeNull()
  })

  // --- Tema `register` (Caja) -------------------------------------------
  // Caja todavía NO tiene suscripción en el API (ver el docblock de
  // FreshnessTopic): se comporta como los demás por reconexión, foco y
  // refreshAll, y no lo arrastra ningún evento existente.

  it("'register' es parte de todos los temas, en orden estable", () => {
    // Si mañana se agrega un tema, este caso es el recordatorio de mantener
    // el orden y de actualizar `lastRunAt` del motor.
    expect(FRESHNESS_TOPICS).toEqual(['sales', 'walkins', 'appointments', 'register'])
  })

  it("refreshAll() refresca 'register'; un evento de venta NO lo toca", async () => {
    const register = vi.fn()
    const sales = vi.fn()
    await renderFreshness(
      <>
        <Probe load={register} topics={['register']} />
        <Probe load={sales} topics={['sales']} />
      </>,
    )

    await act(async () => {
      emitSale()
    })
    expect(sales).toHaveBeenCalledTimes(1)
    // Caja no se entera de una venta por el tema equivocado.
    expect(register).not.toHaveBeenCalled()

    await act(async () => {
      ctx().refreshAll()
    })
    expect(register).toHaveBeenCalledTimes(1)
  })

  it("la reconexión también pone al día 'register'", async () => {
    const register = vi.fn()
    await renderFreshness(<Probe load={register} topics={['register']} />)

    await act(async () => {
      reportWsConnected()
    })
    expect(register).not.toHaveBeenCalled()

    await act(async () => {
      reportWsDisconnected()
      reportWsConnected(true)
    })
    expect(register).toHaveBeenCalledTimes(1)
  })

  it("un cargador en ['sales', 'register'] corre UNA sola vez por refreshAll", async () => {
    const both = vi.fn()
    await renderFreshness(<Probe load={both} topics={['sales', 'register']} />)

    await act(async () => {
      ctx().refreshAll()
    })
    expect(both).toHaveBeenCalledTimes(1)

    await act(async () => {
      ctx().refreshAll()
    })
    expect(both).toHaveBeenCalledTimes(2)
  })

  it("la ventana de 5 s de 'register' es independiente de la de 'sales'", async () => {
    const sales = vi.fn()
    const register = vi.fn()
    await renderFreshness(
      <>
        <Probe load={sales} topics={['sales']} />
        <Probe load={register} topics={['register']} />
      </>,
    )

    // Abre la ventana de 'sales' (y sólo la de ese tema).
    await act(async () => {
      emitSale()
    })
    expect(sales).toHaveBeenCalledTimes(1)
    expect(register).not.toHaveBeenCalled()

    // El foco pide todos los temas RESPETANDO la ventana: 'sales' está dentro
    // de la suya y queda pendiente; 'register' estrena la propia y corre ya.
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(sales).toHaveBeenCalledTimes(1)
    expect(register).toHaveBeenCalledTimes(1)

    // Al cerrarse la ventana de 'sales' corre lo pendiente de ESE tema; la
    // ventana de 'register', recién abierta, no vuelve a disparar.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MIN_REFRESH_GAP_MS)
    })
    expect(sales).toHaveBeenCalledTimes(2)
    expect(register).toHaveBeenCalledTimes(1)
  })
})
