import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ApolloClient } from '@apollo/client'
import type { MockedProviderProps } from '@apollo/client/testing/react'
import { MyDayPage, computeWorkedMinutes } from './MyDayPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'
import {
  FreshnessContext,
  type FreshnessConnection,
  type FreshnessContextValue,
  type FreshnessLoader,
  type FreshnessTopic,
} from '@/core/freshness/FreshnessProvider'
import type { Repositories } from '@/core/repositories/registry'
import type { PosViewer } from '@/core/auth/auth.types'
import type { SaleDetail } from '@/features/checkout/data/checkout.repository'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository'
import { POS_MY_DAY_EARNINGS } from '@/features/home/data/home.queries'

/** Nombre accesible del hero de ganancias (MoneyValue, [D-006]). */
const EARNINGS_LABEL = 'Lo que llevas hoy'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() { return MOCK_VIEWER }
}

/** AuthRepo que devuelve un viewer con permisos arbitrarios — para probar el
 *  gate de `pos.sale.read`. */
function authRepoWithPermissions(permissions: string[]): InMemoryAuthRepository {
  const viewer: PosViewer = { ...MOCK_VIEWER, permissions }
  return new (class extends InMemoryAuthRepository {
    override async getViewer() { return viewer }
  })()
}

type Mocks = MockedProviderProps['mocks']

interface SaleEntryOptions {
  saleId: string
  customerName: string
  earningsCents?: number
  tipCents?: number
  itemLabels?: string[]
  soldAt?: string
}

/** Entrada del desglose per-sale: una venta directa (sin walk-in ni cita
 *  linkados) atribuida al viewer → aparece como row de "Venta". */
function saleEntry(o: SaleEntryOptions) {
  const earnings = o.earningsCents ?? 12000
  return {
    __typename: 'StaffDaySaleEarning',
    saleId: o.saleId,
    commissionCents: earnings - (o.tipCents ?? 0),
    tipCents: o.tipCents ?? 0,
    earningsCents: earnings,
    soldAt: o.soldAt ?? new Date().toISOString(),
    customerName: o.customerName,
    linkedWalkInId: null,
    linkedAppointmentId: null,
    itemLabels: o.itemLabels ?? ['Corte clásico'],
    attributedRevenueCents: 30000,
  }
}

/**
 * Ganancias del día. Las variables se matchean con función: la fecha la
 * calcula la pantalla en la tz de la sucursal y no queremos que el test se
 * rompa por el reloj de la máquina. `maxUsageCount` alto porque la pantalla
 * re-consulta en cada aviso del canal.
 */
function earningsMock(
  o: {
    totalCommissionCents?: number
    tipsCents?: number
    perSale?: ReturnType<typeof saleEntry>[]
    maxUsageCount?: number
  } = {},
) {
  const total = o.totalCommissionCents ?? 12000
  const tips = o.tipsCents ?? 0
  return {
    request: { query: POS_MY_DAY_EARNINGS, variables: () => true },
    maxUsageCount: o.maxUsageCount ?? 20,
    result: {
      data: {
        staffDayEarnings: {
          __typename: 'StaffDayEarnings',
          serviceCommissionCents: total - tips,
          productCommissionCents: 0,
          tipsCents: tips,
          totalCommissionCents: total,
          serviceRevenueCents: 30000,
          productRevenueCents: 0,
          perSale: o.perSale ?? [],
        },
      },
    },
  }
}

/** Mock que nunca responde — deja la cifra en vuelo. */
function earningsInFlight() {
  return { request: { query: POS_MY_DAY_EARNINGS, variables: () => true }, delay: Infinity }
}

/** Mock que falla — el servidor respondió con error. */
function earningsError() {
  return {
    request: { query: POS_MY_DAY_EARNINGS, variables: () => true },
    maxUsageCount: 1,
    error: new Error('boom'),
  }
}

/** Construye un SaleDetail mínimo pero válido para el id/cliente dados. */
function saleDetail(saleId: string, customerName: string, itemName: string): SaleDetail {
  return {
    id: saleId,
    createdAt: new Date().toISOString(),
    subtotalCents: 30000,
    taxTotalCents: 0,
    totalCents: 30000,
    tipCents: 0,
    customer: { id: `c-${saleId}`, fullName: customerName },
    payments: [{ provider: 'CASH', amountCents: 30000 }],
    items: [
      {
        id: `${saleId}-item-0`,
        name: itemName,
        qty: 1,
        unitPriceCents: 30000,
        totalCents: 30000,
        staffUser: { id: MOCK_VIEWER.staff.id, fullName: MOCK_VIEWER.staff.fullName },
      },
    ],
    discounts: [],
  }
}

/** Promesa controlable: el test decide cuándo (y con qué) resuelve. */
interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function evt(at: string, type: 'CLOCK_IN' | 'CLOCK_OUT'): TimeClockEvent {
  return { id: at, type, at }
}

interface Registration {
  load: FreshnessLoader
  topics: readonly FreshnessTopic[]
}

/**
 * Canal de frescura de mentira: la pantalla ya no escucha el socket ni el
 * foco de la ventana, así que el test hace de servidor avisando por tema.
 * El objeto es estable (se crea una vez) para no re-registrar en cada render.
 */
function createFreshnessStub(connection: FreshnessConnection = 'connected') {
  const registrations = new Set<Registration>()
  const value: FreshnessContextValue = {
    connection,
    lastUpdatedAt: null,
    refreshAll: () => {},
    setPaused: () => {},
    register: (load, topics) => {
      const entry: Registration = { load, topics }
      registrations.add(entry)
      return () => {
        registrations.delete(entry)
      }
    },
  }
  /** Avisa del tema y espera a que las cargas registradas terminen. */
  async function announce(topic: FreshnessTopic) {
    await act(async () => {
      await Promise.allSettled(
        [...registrations].filter((r) => r.topics.includes(topic)).map((r) => r.load()),
      )
    })
  }
  return { value, registrations, announce }
}

function renderMyDay(
  options: {
    repos?: Repositories
    auth?: InMemoryAuthRepository
    mocks?: Mocks
    connection?: FreshnessConnection
  } = {},
) {
  const fresh = createFreshnessStub(options.connection)
  renderWithProviders(
    <FreshnessContext.Provider value={fresh.value}>
      <MyDayPage />
    </FreshnessContext.Provider>,
    {
      repos: {
        ...(options.repos ?? createMockRepositories()),
        auth: options.auth ?? new TestAuthRepo(),
      },
      apolloMocks: options.mocks ?? [earningsMock()],
    },
  )
  return fresh
}

/** Espía de `client.query` para contar (y auditar) lo que se pide a la red. */
function spyOnQueries() {
  const spy = vi.spyOn(ApolloClient.prototype, 'query')
  return {
    spy,
    earningsCalls(): Array<{ query: unknown; fetchPolicy?: string }> {
      const calls = spy.mock.calls as unknown as Array<[{ query: unknown; fetchPolicy?: string }]>
      return calls.map(([opts]) => opts).filter((opts) => opts.query === POS_MY_DAY_EARNINGS)
    },
  }
}

function earningsFigure() {
  return screen.getByRole('group', { name: EARNINGS_LABEL })
}

describe('MyDayPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders heading "Mi Día"', async () => {
    renderMyDay()
    expect(await screen.findByText(/mi día/i)).toBeInTheDocument()
  })

  it('renders staff name in viewer-aware copy', async () => {
    renderMyDay()
    expect(await screen.findByText(MOCK_VIEWER.staff.fullName)).toBeInTheDocument()
  })

  it('renders KPI sections', async () => {
    renderMyDay()
    expect(await screen.findByText(/citas completadas/i)).toBeInTheDocument()
    expect(screen.getByText(/tiempo trabajado/i)).toBeInTheDocument()
  })

  // ── Dinero siempre de la red (spec § 3.1, regla del dueño) ─────────────

  it('asks the network for the earnings on mount, never the cache', async () => {
    const queries = spyOnQueries()
    renderMyDay({ mocks: [earningsMock({ totalCommissionCents: 66000 })] })

    await waitFor(() => expect(earningsFigure()).toHaveTextContent('$660'))
    const calls = queries.earningsCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0].fetchPolicy).toBe('network-only')
  })

  it('a "sales" announcement reloads the money and not the list', async () => {
    const repos = createMockRepositories()
    const getAppointments = vi.fn().mockResolvedValue([])
    repos.agenda.getAppointments = getAppointments
    const queries = spyOnQueries()
    const fresh = renderMyDay({ repos, mocks: [earningsMock({ totalCommissionCents: 66000 })] })

    await waitFor(() => expect(earningsFigure()).toHaveTextContent('$660'))
    await waitFor(() => expect(getAppointments).toHaveBeenCalled())
    const apptCalls = getAppointments.mock.calls.length

    // Otra iPad cobró: el servidor avisa por el tema `sales`.
    await fresh.announce('sales')

    expect(queries.earningsCalls()).toHaveLength(2)
    expect(queries.earningsCalls()[1].fetchPolicy).toBe('network-only')
    // [D-019]: el tema del dinero no arrastra la lista.
    expect(getAppointments.mock.calls.length).toBe(apptCalls)
  })

  it('a "walkins" announcement reloads the list and not the money', async () => {
    const repos = createMockRepositories()
    const getAppointments = vi.fn().mockResolvedValue([])
    repos.agenda.getAppointments = getAppointments
    const queries = spyOnQueries()
    const fresh = renderMyDay({ repos, mocks: [earningsMock({ totalCommissionCents: 66000 })] })

    await waitFor(() => expect(earningsFigure()).toHaveTextContent('$660'))
    await waitFor(() => expect(getAppointments).toHaveBeenCalled())
    const apptCalls = getAppointments.mock.calls.length

    await fresh.announce('walkins')

    expect(getAppointments.mock.calls.length).toBeGreaterThan(apptCalls)
    expect(queries.earningsCalls()).toHaveLength(1)
  })

  it('does not open live connections of its own (the channel is shared)', async () => {
    const subscribeSpy = vi.spyOn(ApolloClient.prototype, 'subscribe')
    const fresh = renderMyDay({ mocks: [earningsMock({ totalCommissionCents: 66000 })] })

    await waitFor(() => expect(earningsFigure()).toHaveTextContent('$660'))
    expect(subscribeSpy).not.toHaveBeenCalled()
    // Y sí quedó registrada en el canal único, con sus temas.
    const topics = [...fresh.registrations].flatMap((r) => [...r.topics])
    expect(topics).toEqual(expect.arrayContaining(['sales', 'walkins', 'appointments']))
  })

  // ── Estados de la cifra (spec § 3.1b) ──────────────────────────────────

  it('shows a skeleton — no digits — while the earnings are in flight', async () => {
    renderMyDay({ mocks: [earningsInFlight()] })

    const figure = await screen.findByRole('group', { name: EARNINGS_LABEL })
    expect(figure).toHaveAttribute('aria-busy', 'true')
    expect(figure.textContent ?? '').not.toMatch(/\d/)
    expect(figure.textContent ?? '').not.toContain('$')
  })

  it('a failed refresh drops the figure instead of showing the previous one', async () => {
    const fresh = renderMyDay({
      mocks: [
        earningsMock({ totalCommissionCents: 66000, maxUsageCount: 1 }),
        earningsError(),
        earningsMock({ totalCommissionCents: 71000, maxUsageCount: 1 }),
      ],
    })
    await waitFor(() => expect(earningsFigure()).toHaveTextContent('$660'))

    await fresh.announce('sales')

    // [D-018]: nada de cifra vieja haciéndose pasar por la de ahora.
    const figure = earningsFigure()
    expect(figure).toHaveTextContent(/no se pudo cargar/i)
    expect(figure.textContent ?? '').not.toMatch(/\d/)

    // Y la salida es tocar Reintentar, no recargar la app.
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    await waitFor(() => expect(earningsFigure()).toHaveTextContent('$710'))
  })

  it('with the live channel down the figure says "sin conexión", not a stale amount', async () => {
    renderMyDay({ connection: 'offline', mocks: [earningsError()] })

    const figure = await screen.findByRole('group', { name: EARNINGS_LABEL })
    await waitFor(() => expect(figure).toHaveTextContent(/sin conexión/i))
    expect(figure.textContent ?? '').not.toMatch(/\d/)
  })

  it('a real zero renders as $0 with its empty-state copy', async () => {
    renderMyDay({ mocks: [earningsMock({ totalCommissionCents: 0 })] })

    await waitFor(() => expect(earningsFigure()).toHaveTextContent('$0'))
    expect(await screen.findByText(/aún no hay servicios cerrados hoy/i)).toBeInTheDocument()
  })

  it('paints the per-row amount with the money component, not a bare numeral', async () => {
    renderMyDay({
      mocks: [
        earningsMock({
          totalCommissionCents: 12000,
          perSale: [saleEntry({ saleId: 'sale-abc', customerName: 'Juan Pérez' })],
        }),
      ],
    })

    const row = await screen.findByRole('group', { name: /tu parte de juan pérez/i })
    expect(row).toHaveTextContent('$120')
  })

  // ── Gate de pos.sale.read ──────────────────────────────────────────────

  it('WITHOUT pos.sale.read: la row de venta NO es clickable (sin button)', async () => {
    renderMyDay({
      // MOCK_VIEWER sí incluye pos.sale.read; acá recortamos los permisos.
      auth: authRepoWithPermissions(['pos.sale.create']),
      mocks: [
        earningsMock({ perSale: [saleEntry({ saleId: 'sale-abc', customerName: 'Juan Pérez' })] }),
      ],
    })
    // La venta aparece como row con el nombre del cliente.
    const customer = await screen.findByText('Juan Pérez')
    expect(customer).toBeInTheDocument()
    // La row NO debe ser un <button> ni tener role button — gate duro.
    expect(customer.closest('button')).toBeNull()
    expect(
      screen.queryByRole('button', { name: /ver detalle de venta/i }),
    ).not.toBeInTheDocument()
  })

  it('WITH pos.sale.read: la row es un button y al hacer tap abre el sheet con "Tu parte"', async () => {
    const saleId = 'sale-abc'
    const repos = createMockRepositories()
    // Override getSaleDetail para que el sheet tenga contenido.
    repos.checkout.getSaleDetail = async () => saleDetail(saleId, 'Juan Pérez', 'Corte clásico')

    renderMyDay({
      repos,
      auth: authRepoWithPermissions(['pos.sale.create', 'pos.sale.read']),
      mocks: [earningsMock({ perSale: [saleEntry({ saleId, customerName: 'Juan Pérez' })] })],
    })

    const trigger = await screen.findByRole('button', { name: /ver detalle de venta/i })
    await userEvent.click(trigger)

    // El sheet abre con el desglose + "Tu parte". Scope al dialog para no
    // colisionar con la sublabel "Tu parte" / monto de la propia row.
    const dialog = await screen.findByRole('dialog', { name: /detalle de venta/i })
    const inDialog = within(dialog)
    expect(inDialog.getByText(/tu parte/i)).toBeInTheDocument()
    // $120 (12000 cents) — earningsCents (tuParteCents) del perSale entry.
    expect(inDialog.getByText('$120')).toBeInTheDocument()
    // El cuerpo compartido (SaleTicketBody) renderiza el item de la venta.
    expect(inDialog.getByText(/corte clásico/i)).toBeInTheDocument()
  })

  // ── Carrera A→B (fast-tap) ─────────────────────────────────────────────
  //
  // El cajero abre la venta A y, antes de que su getSaleDetail resuelva, abre
  // la venta B. El effect cleanup del sheet marca `cancelled=true` para la
  // request de A, así que cuando A resuelve TARDE su resultado se descarta y
  // el sheet termina mostrando B. Sin ese cleanup, la resolución stale de A
  // pisaría a B (last-write-wins en el orden equivocado).
  it('A→B fast-tap: si A resuelve después de abrir B, el sheet muestra B (no A stale)', async () => {
    const saleA = 'sale-A'
    const saleB = 'sale-B'
    const deferredById: Record<string, Deferred<SaleDetail | null>> = {
      [saleA]: deferred<SaleDetail | null>(),
      [saleB]: deferred<SaleDetail | null>(),
    }

    const repos = createMockRepositories()
    // Resolución controlada por id: el test decide el orden de resolución.
    repos.checkout.getSaleDetail = (id: string) => deferredById[id].promise

    renderMyDay({
      repos,
      auth: authRepoWithPermissions(['pos.sale.create', 'pos.sale.read']),
      mocks: [
        earningsMock({
          perSale: [
            saleEntry({
              saleId: saleA,
              customerName: 'Cliente Alpha',
              soldAt: new Date(Date.now() - 1000).toISOString(),
            }),
            saleEntry({
              saleId: saleB,
              customerName: 'Cliente Beta',
              earningsCents: 9000,
              itemLabels: ['Barba'],
            }),
          ],
        }),
      ],
    })

    // Tap A → abre el sheet con A en vuelo (sin resolver todavía).
    const triggerA = await screen.findByRole('button', { name: /ver detalle de venta de cliente alpha/i })
    await userEvent.click(triggerA)

    // Tap B → re-targetea el sheet a B (B también en vuelo).
    const triggerB = await screen.findByRole('button', { name: /ver detalle de venta de cliente beta/i })
    await userEvent.click(triggerB)

    // B resuelve PRIMERO (el caso feliz), luego A resuelve TARDE.
    deferredById[saleB].resolve(saleDetail(saleB, 'Cliente Beta', 'Barba'))
    deferredById[saleA].resolve(saleDetail(saleA, 'Cliente Alpha', 'Corte clásico'))

    // El sheet debe mostrar B (Barba), nunca el item de A (Corte clásico).
    const dialog = await screen.findByRole('dialog', { name: /detalle de venta/i })
    const inDialog = within(dialog)
    expect(await inDialog.findByText(/barba/i)).toBeInTheDocument()
    expect(inDialog.queryByText(/corte clásico/i)).not.toBeInTheDocument()
  })

  // ── Error path ─────────────────────────────────────────────────────────
  //
  // Cuando getSaleDetail rechaza, el sheet muestra su estado de error
  // (role="alert") en vez de quedarse en loading o crashear.
  it('error path: si getSaleDetail rechaza, el sheet muestra el estado de error', async () => {
    const saleId = 'sale-err'
    const repos = createMockRepositories()
    repos.checkout.getSaleDetail = async () => {
      throw new Error('boom')
    }

    renderMyDay({
      repos,
      auth: authRepoWithPermissions(['pos.sale.create', 'pos.sale.read']),
      mocks: [earningsMock({ perSale: [saleEntry({ saleId, customerName: 'Juan Pérez' })] })],
    })

    const trigger = await screen.findByRole('button', { name: /ver detalle de venta/i })
    await userEvent.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: /detalle de venta/i })
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent(/no se pudo cargar/i)
  })
})

describe('computeWorkedMinutes', () => {
  const NOW = new Date('2026-05-06T10:00:00Z')

  it('returns 0 for empty events', () => {
    expect(computeWorkedMinutes([], NOW)).toBe(0)
  })

  it('counts a single closed IN/OUT span', () => {
    const events = [evt('2026-05-06T08:00:00Z', 'CLOCK_IN'), evt('2026-05-06T09:30:00Z', 'CLOCK_OUT')]
    expect(computeWorkedMinutes(events, NOW)).toBe(90)
  })

  it('keeps an open span running up to "now"', () => {
    const events = [evt('2026-05-06T09:00:00Z', 'CLOCK_IN')]
    expect(computeWorkedMinutes(events, NOW)).toBe(60)
  })

  it('ignores duplicate CLOCK_IN events (real bug from the field)', () => {
    // 4 ENTRADAs in a row, then SALIDA, then ENTRADA — the historical case
    // that surfaced the original "0h 0m" bug.
    const events = [
      evt('2026-05-06T00:45:00Z', 'CLOCK_IN'),
      evt('2026-05-06T00:45:30Z', 'CLOCK_IN'),
      evt('2026-05-06T00:48:00Z', 'CLOCK_IN'),
      evt('2026-05-06T00:48:30Z', 'CLOCK_IN'),
      evt('2026-05-06T01:17:00Z', 'CLOCK_OUT'),
      evt('2026-05-06T01:17:30Z', 'CLOCK_IN'),
    ]
    // First IN at 00:45 → OUT at 01:17 = 32 minutes. Re-IN at 01:17:30 still
    // open at NOW (10:00) ≈ 522.5 minutes. Total ≈ 554.5.
    const result = computeWorkedMinutes(events, NOW)
    expect(result).toBeGreaterThan(550)
    expect(result).toBeLessThan(560)
  })

  it('drops orphan CLOCK_OUT events', () => {
    const events = [evt('2026-05-06T08:00:00Z', 'CLOCK_OUT'), evt('2026-05-06T09:00:00Z', 'CLOCK_IN')]
    expect(computeWorkedMinutes(events, NOW)).toBe(60)
  })

  it('handles events delivered out of order', () => {
    const events = [
      evt('2026-05-06T09:30:00Z', 'CLOCK_OUT'),
      evt('2026-05-06T08:00:00Z', 'CLOCK_IN'),
    ]
    expect(computeWorkedMinutes(events, NOW)).toBe(90)
  })
})
