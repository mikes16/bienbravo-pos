import { useEffect, type ReactNode } from 'react'
import { render, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
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
// nombre de operación —y también RECHAZARLA—. Así distinguimos "llegó un
// evento de venta" de "llegó uno de la fila", cosa que MockSubscriptionLink no
// permite (reparte el mismo resultado a todos los observers), y podemos
// reproducir el error de una sola operación sin tocar el socket.
interface Channel {
  emit: (data: Record<string, unknown>) => void
  fail: (err: unknown) => void
  close: () => void
}
const channels = new Map<string, Set<Channel>>()
/** Aperturas por operación: una re-suscripción suma una. */
const opens = new Map<string, number>()

function createEventLink(): ApolloLink {
  return new ApolloLink(
    (operation) =>
      new Observable<ApolloLink.Result>((observer) => {
        const name = operation.operationName ?? 'anonymous'
        opens.set(name, (opens.get(name) ?? 0) + 1)
        const channel: Channel = {
          emit: (data) => observer.next({ data }),
          fail: (err) => observer.error(err),
          close: () => observer.complete(),
        }
        const set = channels.get(name) ?? new Set<Channel>()
        set.add(channel)
        channels.set(name, set)
        return () => {
          set.delete(channel)
        }
      }),
  )
}

function channelsOf(operationName: string): Channel[] {
  const set = channels.get(operationName)
  // Si nadie está suscrito, el provider no abrió el canal: es un fallo real.
  if (!set || set.size === 0) throw new Error(`Nadie suscrito a ${operationName}`)
  return [...set]
}

function emit(operationName: string, data: Record<string, unknown>): void {
  for (const channel of channelsOf(operationName)) channel.emit(data)
}

/**
 * El servidor RECHAZA esa operación: el observable termina. No es una caída
 * del socket (`wsStatus` ni se entera) y graphql-ws no la reabre al reconectar.
 */
function failSubscription(operationName: string): void {
  const err = new Error(`${operationName} rechazada`)
  for (const channel of channelsOf(operationName)) channel.fail(err)
}

/** El servidor CIERRA el stream sin error: tan muerto como si lo rechazara. */
function closeSubscription(operationName: string): void {
  for (const channel of channelsOf(operationName)) channel.close()
}

/** Cuántas veces se abrió esa operación desde el inicio del caso. */
function opensOf(operationName: string): number {
  return opens.get(operationName) ?? 0
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

/**
 * Aviso genérico por sucursal (`posDataChanged`). `kind` va como string a
 * propósito: así podemos emitir también uno que el POS no conoce.
 */
function emitPosData(kind: string): void {
  emit('PosDataChanged', {
    posDataChanged: { __typename: 'PosDataEvent', kind, locationSlug: 'centro', occurredAt: AT },
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

type TopicLoaders = Record<FreshnessTopic, Mock>

/**
 * Un cargador por TEMA, para poder afirmar "este evento llegó exactamente a
 * estos temas" sin enumerar espías a mano en cada caso.
 */
function topicProbes(): { loaders: TopicLoaders; node: ReactNode } {
  const loaders = Object.fromEntries(
    FRESHNESS_TOPICS.map((topic) => [topic, vi.fn()]),
  ) as TopicLoaders
  const node = (
    <>
      {FRESHNESS_TOPICS.map((topic) => (
        <Probe key={topic} load={loaders[topic]} topics={[topic]} />
      ))}
    </>
  )
  return { loaders, node }
}

/** Temas cuyo cargador corrió al menos una vez, en el orden del canal. */
function calledTopics(loaders: TopicLoaders): FreshnessTopic[] {
  return FRESHNESS_TOPICS.filter((topic) => loaders[topic].mock.calls.length > 0)
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
  /**
   * El canal grita por `console.error` cuando una suscripción falla (también
   * en producción). Se silencia aquí para no ensuciar la salida y para poder
   * afirmar que el rastro existe.
   */
  let errorLog: Mock

  beforeEach(() => {
    vi.useFakeTimers()
    resetWsStatus()
    channels.clear()
    opens.clear()
    ctxRef.current = null
    saleSeq = 0
    errorLog = vi.fn()
    vi.spyOn(console, 'error').mockImplementation(errorLog)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
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
  // Caja se entera por `posDataChanged` (kinds REGISTER y PAYMENT) y, como
  // todos, por reconexión, foco y refreshAll. Lo que NO la toca es un evento
  // de venta del canal de Hoy.

  it("'register' es parte de todos los temas, en orden estable", () => {
    // Si mañana se agrega un tema, este caso es el recordatorio de mantener
    // el orden y de actualizar `lastRunAt` del motor.
    expect(FRESHNESS_TOPICS).toEqual([
      'sales',
      'walkins',
      'appointments',
      'register',
      'catalog',
      'settings',
    ])
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

  // --- Aviso genérico `posDataChanged` -----------------------------------
  // Un solo evento por sucursal que cubre lo que las tres suscripciones de
  // Hoy no ven: caja, catálogo, ajustes, corrección de pago y comisión.

  it('REGISTER refresca sólo los cargadores de la caja', async () => {
    const { loaders, node } = topicProbes()
    await renderFreshness(node)

    await act(async () => {
      emitPosData('REGISTER')
    })

    // Otra iPad abrió o cerró la caja: nadie más se entera.
    expect(calledTopics(loaders)).toEqual(['register'])
  })

  it("PAYMENT refresca 'sales' y 'register': la corrección mueve montos entre canales", async () => {
    const { loaders, node } = topicProbes()
    const both = vi.fn()
    await renderFreshness(
      <>
        {node}
        <Probe load={both} topics={['sales', 'register']} />
      </>,
    )

    await act(async () => {
      emitPosData('PAYMENT')
    })

    expect(calledTopics(loaders)).toEqual(['sales', 'register'])
    // Un cargador en los dos temas del mismo evento corre UNA vez.
    expect(both).toHaveBeenCalledTimes(1)
  })

  it("COMMISSION refresca 'sales': cambia lo que el barbero tiene ganado", async () => {
    const { loaders, node } = topicProbes()
    await renderFreshness(node)

    await act(async () => {
      emitPosData('COMMISSION')
    })

    expect(calledTopics(loaders)).toEqual(['sales'])
  })

  it('CATALOG y SETTINGS llegan cada uno a su tema', async () => {
    const { loaders, node } = topicProbes()
    await renderFreshness(node)

    await act(async () => {
      emitPosData('CATALOG')
    })
    expect(calledTopics(loaders)).toEqual(['catalog'])

    await act(async () => {
      emitPosData('SETTINGS')
    })
    expect(calledTopics(loaders)).toEqual(['catalog', 'settings'])
    expect(loaders.catalog).toHaveBeenCalledTimes(1)
  })

  it('un kind desconocido se ignora sin romper el canal', async () => {
    const { loaders, node } = topicProbes()
    await renderFreshness(node)

    // Un API más nuevo publica un tipo que esta versión del POS no conoce.
    await act(async () => {
      emitPosData('TIPO_QUE_NO_EXISTE_TODAVIA')
    })
    expect(calledTopics(loaders)).toEqual([])
    expect(ctx().lastUpdatedAt).toBeNull()

    // Y el canal sigue vivo para el siguiente aviso que sí se entiende.
    await act(async () => {
      emitPosData('REGISTER')
    })
    expect(calledTopics(loaders)).toEqual(['register'])
  })

  it('el aviso genérico respeta la ráfaga de 5 s y la pausa del cobro', async () => {
    const register = vi.fn()
    await renderFreshness(<Probe load={register} topics={['register']} />)

    // Ráfaga: 6 avisos de caja se agrupan en 1 refresco + 1 al cerrar la ventana.
    await act(async () => {
      for (let i = 0; i < 6; i += 1) emitPosData('REGISTER')
    })
    expect(register).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MIN_REFRESH_GAP_MS)
    })
    expect(register).toHaveBeenCalledTimes(2)

    // Cobro en vuelo: el aviso queda pendiente y corre al reanudar.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MIN_REFRESH_GAP_MS)
      ctx().setPaused(true)
    })
    await act(async () => {
      emitPosData('REGISTER')
    })
    expect(register).toHaveBeenCalledTimes(2)

    await act(async () => {
      ctx().setPaused(false)
    })
    expect(register).toHaveBeenCalledTimes(3)
  })

  it('la puesta al día al reconectar también emite los temas nuevos', async () => {
    const { loaders, node } = topicProbes()
    await renderFreshness(node)

    await act(async () => {
      reportWsConnected()
    })
    expect(calledTopics(loaders)).toEqual([])

    await act(async () => {
      reportWsDisconnected()
      reportWsConnected(true)
    })
    expect(calledTopics(loaders)).toEqual([...FRESHNESS_TOPICS])
  })

  // --- Error de UNA suscripción ------------------------------------------
  // El servidor rechaza una operación: su observable termina y graphql-ws NO
  // la reabre al reconectar (sólo re-suscribe las vivas). Si se tragara, esa
  // fuente quedaría muerta con el socket diciendo "conectado" — R8 otra vez.

  it('un rechazo re-suscribe ESA fuente con espera creciente y no toca a las demás', async () => {
    const { loaders, node } = topicProbes()
    await renderFreshness(node)
    expect(opensOf('PosHomeSaleEvent')).toBe(1)

    await act(async () => {
      failSubscription('PosHomeSaleEvent')
    })
    // No se reabre en el mismo tick: el primer intento es al segundo.
    expect(opensOf('PosHomeSaleEvent')).toBe(1)

    // Y el resto del canal sigue trabajando: la fila no se enteró de nada.
    await act(async () => {
      emitWalkIn()
    })
    expect(calledTopics(loaders)).toEqual(['walkins'])
    expect(opensOf('PosHomeWalkInQueueUpdated')).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(999)
    })
    expect(opensOf('PosHomeSaleEvent')).toBe(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(opensOf('PosHomeSaleEvent')).toBe(2)

    // Segundo rechazo seguido: la espera se duplica (2 s).
    await act(async () => {
      failSubscription('PosHomeSaleEvent')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_999)
    })
    expect(opensOf('PosHomeSaleEvent')).toBe(2)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(opensOf('PosHomeSaleEvent')).toBe(3)
  })

  it('mientras reintenta la conexión no dice "connected"; al recuperarse refresca los temas de esa fuente', async () => {
    const { loaders, node } = topicProbes()
    await renderFreshness(node)

    await act(async () => {
      reportWsConnected()
    })
    expect(ctx().connection).toBe('connected')

    // El socket está impecable: lo que se cayó es la operación.
    await act(async () => {
      failSubscription('PosDataChanged')
    })
    expect(ctx().connection).toBe('reconnecting')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(opensOf('PosDataChanged')).toBe(2)
    // Recién reabierta todavía no se da por buena.
    expect(ctx().connection).toBe('reconnecting')
    expect(calledTopics(loaders)).toEqual([])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(ctx().connection).toBe('connected')
    // Puesta al día: TODO lo que ese aviso puede invalidar, no sólo lo último.
    expect(calledTopics(loaders)).toEqual(['sales', 'register', 'catalog', 'settings'])
  })

  it('un aviso recibido antes de asentar también cuenta como recuperación', async () => {
    const { loaders, node } = topicProbes()
    await renderFreshness(node)

    await act(async () => {
      reportWsConnected()
      failSubscription('PosHomeSaleEvent')
    })
    expect(ctx().connection).toBe('reconnecting')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    await act(async () => {
      emitSale()
    })

    expect(ctx().connection).toBe('connected')
    expect(calledTopics(loaders)).toEqual(['sales'])
  })

  it('cinco rechazos seguidos dejan "reconnecting" visible y rastro en el log', async () => {
    await renderFreshness(null)
    await act(async () => {
      reportWsConnected()
    })

    const backoff = [1_000, 2_000, 4_000, 8_000, 16_000]
    for (const delay of backoff) {
      await act(async () => {
        failSubscription('PosHomeSaleEvent')
      })
      expect(ctx().connection).toBe('reconnecting')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(delay)
      })
    }

    expect(opensOf('PosHomeSaleEvent')).toBe(1 + backoff.length)
    expect(ctx().connection).toBe('reconnecting')
    // El rastro NO está detrás del gate de DEV: es console.error siempre.
    expect(errorLog).toHaveBeenCalledTimes(backoff.length)
    expect(String(errorLog.mock.calls[backoff.length - 1][0])).toContain('5 fallos seguidos')

    // Sexto rechazo: la espera topa en 30 s (no sigue duplicando a 32).
    await act(async () => {
      failSubscription('PosHomeSaleEvent')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_999)
    })
    expect(opensOf('PosHomeSaleEvent')).toBe(6)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(opensOf('PosHomeSaleEvent')).toBe(7)
  })

  it('una suscripción que se cierra sin error también se reabre', async () => {
    await renderFreshness(null)
    await act(async () => {
      reportWsConnected()
    })

    // Apollo 4 completa el observable tras un rechazo y el servidor puede
    // cerrarlo por su cuenta: en los dos casos dejan de llegar avisos.
    await act(async () => {
      closeSubscription('PosHomeAppointmentUpdated')
    })
    expect(ctx().connection).toBe('reconnecting')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(opensOf('PosHomeAppointmentUpdated')).toBe(2)
  })

  it('desmontar el canal cancela el reintento pendiente', async () => {
    const { unmount } = await renderFreshness(null)

    await act(async () => {
      failSubscription('PosHomeSaleEvent')
    })
    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(opensOf('PosHomeSaleEvent')).toBe(1)
  })
})
