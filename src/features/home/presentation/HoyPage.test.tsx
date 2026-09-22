import { screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApolloClient } from '@apollo/client'
import type { MockedProviderProps } from '@apollo/client/testing/react'
import { HoyPage } from './HoyPage'
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
import { POS_HOME_CAJA_STATUS, POS_MY_DAY_EARNINGS } from '../data/home.queries'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

/** Nombre accesible de la cifra de comisiones (MoneyValue, [D-006]). */
const COMMISSION_LABEL = 'Comisiones hoy'

// Repos with the operator already clocked-in. Pair this with the default mocks
// to drive HoyPage past both prerequisite gates and exercise the normal view.
function makeClockedInRepos() {
  const repos = createMockRepositories()
  repos.clock.getEvents = vi.fn().mockResolvedValue([
    { id: 'evt-1', type: 'CLOCK_IN', at: new Date().toISOString() },
  ])
  return repos
}

type Mocks = MockedProviderProps['mocks']

function cajaMock(isOpen = true) {
  return {
    request: { query: POS_HOME_CAJA_STATUS, variables: { locationId: 'loc1' } },
    // La pantalla re-consulta en cada refresco: el mock tiene que aguantar
    // varias pasadas o el segundo refetch "apagaría" la caja.
    maxUsageCount: 20,
    result: {
      data: {
        posCajaStatusHome: { isOpen, accumulatedCents: 0, openedAt: new Date().toISOString() },
      },
    },
  }
}

/**
 * Comisiones del día. Las variables se matchean con función: la fecha la
 * calcula la pantalla en la tz de la sucursal y no queremos que el test se
 * rompa por el reloj de la máquina.
 */
function earningsMock(totalCommissionCents = 66000, extra: { maxUsageCount?: number } = {}) {
  return {
    request: { query: POS_MY_DAY_EARNINGS, variables: () => true },
    maxUsageCount: extra.maxUsageCount ?? 20,
    result: {
      data: {
        staffDayEarnings: {
          __typename: 'StaffDayEarnings',
          serviceCommissionCents: totalCommissionCents,
          productCommissionCents: 0,
          tipsCents: 0,
          totalCommissionCents,
          serviceRevenueCents: 0,
          productRevenueCents: 0,
          perSale: [],
        },
      },
    },
  }
}

function defaultMocks(): Mocks {
  return [cajaMock(), earningsMock()]
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

function renderHoy(
  options: { repos?: Repositories; mocks?: Mocks; connection?: FreshnessConnection } = {},
) {
  const fresh = createFreshnessStub(options.connection)
  renderWithProviders(
    <FreshnessContext.Provider value={fresh.value}>
      <HoyPage />
    </FreshnessContext.Provider>,
    {
      repos: { ...(options.repos ?? makeClockedInRepos()), auth: new TestAuthRepo() },
      apolloMocks: options.mocks ?? defaultMocks(),
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

function commissionFigure() {
  return screen.getByRole('group', { name: COMMISSION_LABEL })
}

describe('HoyPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })
  afterEach(() => vi.restoreAllMocks())

  // R9 movió la identidad del operador a la barra superior: Hoy ya no
  // saluda, así que el humo de "cargó la vista" ahora lo da el bloque de
  // comisiones (primer contenido propio de la pantalla).
  it('renders the day view after data load', async () => {
    renderHoy()
    expect(await screen.findByText(/comisiones hoy/i)).toBeInTheDocument()
    expect(screen.queryByText(/hola/i)).toBeNull()
    await waitFor(() => expect(commissionFigure()).toHaveTextContent('$660'))
  })

  it('shows the clock-in gate when the operator has not started their day', async () => {
    // Default repo has getEvents() returning [] → not clocked in → gate kicks in.
    renderHoy({ repos: createMockRepositories() })
    expect(await screen.findByText(/inicia tu día/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reloj/i })).toBeInTheDocument()
  })

  it('shows the caja gate when clocked-in but caja is closed', async () => {
    // Sin mock de caja la query no resuelve dato → se asume cerrada.
    renderHoy({ mocks: [earningsMock()] })
    expect(await screen.findByText(/abre la caja/i)).toBeInTheDocument()
  })

  it('renders the contextual CTA when prerequisites are met', async () => {
    renderHoy()
    expect(
      await screen.findByRole('button', { name: /nueva venta|atender|cobrar/i }),
    ).toBeInTheDocument()
  })

  // Regla del dueño (18 sep 2026): el dinero nunca se muestra desde caché.
  it('asks the network for the commission on mount, never the cache', async () => {
    const queries = spyOnQueries()
    renderHoy()
    await waitFor(() => expect(commissionFigure()).toHaveTextContent('$660'))
    const calls = queries.earningsCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0].fetchPolicy).toBe('network-only')
  })

  it('a "sales" announcement reloads the commission and not the queue', async () => {
    const repos = makeClockedInRepos()
    const getAppointments = vi.fn().mockResolvedValue([])
    repos.agenda.getAppointments = getAppointments
    const queries = spyOnQueries()
    const fresh = renderHoy({ repos })

    await waitFor(() => expect(commissionFigure()).toHaveTextContent('$660'))
    await waitFor(() => expect(getAppointments).toHaveBeenCalled())
    const apptCalls = getAppointments.mock.calls.length

    // Otra iPad cobró: el servidor avisa por el tema `sales`.
    await fresh.announce('sales')

    expect(queries.earningsCalls()).toHaveLength(2)
    expect(getAppointments.mock.calls.length).toBe(apptCalls)
  })

  it('a "walkins" announcement reloads the queue and not the money', async () => {
    const repos = makeClockedInRepos()
    const getAppointments = vi.fn().mockResolvedValue([])
    repos.agenda.getAppointments = getAppointments
    const queries = spyOnQueries()
    const fresh = renderHoy({ repos })

    await waitFor(() => expect(commissionFigure()).toHaveTextContent('$660'))
    await waitFor(() => expect(getAppointments).toHaveBeenCalled())
    const apptCalls = getAppointments.mock.calls.length

    await fresh.announce('walkins')

    expect(getAppointments.mock.calls.length).toBeGreaterThan(apptCalls)
    expect(queries.earningsCalls()).toHaveLength(1)
  })

  it('does not open live connections of its own (the channel is shared)', async () => {
    const subscribeSpy = vi.spyOn(ApolloClient.prototype, 'subscribe')
    const fresh = renderHoy()
    await waitFor(() => expect(commissionFigure()).toHaveTextContent('$660'))
    expect(subscribeSpy).not.toHaveBeenCalled()
    // Y sí quedó registrada en el canal único, con sus temas.
    const topics = [...fresh.registrations].flatMap((r) => [...r.topics])
    expect(topics).toEqual(expect.arrayContaining(['sales', 'walkins', 'appointments']))
  })

  it('shows a skeleton — no digits — while the commission is in flight', async () => {
    // La respuesta de comisiones nunca llega; la lista sí.
    renderHoy({ mocks: [cajaMock(), { request: { query: POS_MY_DAY_EARNINGS, variables: () => true }, delay: Infinity }] })
    const figure = await screen.findByRole('group', { name: COMMISSION_LABEL })
    expect(figure).toHaveAttribute('aria-busy', 'true')
    expect(figure.textContent ?? '').not.toMatch(/\d/)
    expect(figure.textContent ?? '').not.toContain('$')
  })

  it('a failed refresh drops the figure instead of showing the previous one', async () => {
    const fresh = renderHoy({
      mocks: [
        cajaMock(),
        earningsMock(66000, { maxUsageCount: 1 }),
        { request: { query: POS_MY_DAY_EARNINGS, variables: () => true }, error: new Error('boom') },
        earningsMock(71000, { maxUsageCount: 1 }),
      ],
    })
    await waitFor(() => expect(commissionFigure()).toHaveTextContent('$660'))

    await fresh.announce('sales')

    // [D-018]: nada de cifra vieja haciéndose pasar por la de ahora.
    const figure = commissionFigure()
    expect(figure).toHaveTextContent(/no se pudo cargar/i)
    expect(figure.textContent ?? '').not.toMatch(/\d/)

    // Y la salida es tocar Reintentar, no recargar la app.
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    await waitFor(() => expect(commissionFigure()).toHaveTextContent('$710'))
  })

  it('with the live channel down the figure says "sin conexión", not a stale amount', async () => {
    renderHoy({
      connection: 'offline',
      mocks: [
        cajaMock(),
        { request: { query: POS_MY_DAY_EARNINGS, variables: () => true }, error: new Error('offline') },
      ],
    })
    const figure = await screen.findByRole('group', { name: COMMISSION_LABEL })
    await waitFor(() => expect(figure).toHaveTextContent(/sin conexión/i))
    expect(figure.textContent ?? '').not.toMatch(/\d/)
  })

  it('renders empty list message when no rows', async () => {
    renderHoy()
    expect(await screen.findByText(/todavía no tienes movimiento/i)).toBeInTheDocument()
  })

  it('tomar una cita "Sin barbero" llama agenda.reassignAppointment (no walkins.assign)', async () => {
    const repos = makeClockedInRepos()
    repos.agenda.getAppointments = vi.fn().mockResolvedValue([
      {
        id: 'appt-1',
        status: 'CONFIRMED',
        salePaymentStatus: null,
        startAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        endAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        totalCents: 0,
        customer: { id: 'c1', fullName: 'Ana Ruiz', phone: null },
        staffUser: null,
        items: [{ label: 'Corte', serviceId: 's1', qty: 1, unitPriceCents: 0 }],
        locationId: 'loc1',
        locationName: 'Centro',
      },
    ])
    const reassignAppointment = vi.fn().mockResolvedValue(undefined)
    const walkinsAssign = vi.fn()
    repos.agenda.reassignAppointment = reassignAppointment
    repos.walkins.assign = walkinsAssign

    const user = userEvent.setup()
    renderHoy({ repos })

    expect(await screen.findByText(/sin barbero/i)).toBeInTheDocument()
    // Target the row specifically. La cita "Sin barbero" tiene staffUser=null
    // ⇒ isMine=false, así que el CTA por-operador ya NO la ofrece como
    // "Atender a Ana Ruiz" (se corrigió el gap de nextMine): la barra de abajo
    // dice "Nueva venta". La fila se toma por su propio tap; el pill "Sin
    // barbero" es texto único de la fila.
    await user.click(screen.getByRole('button', { name: /sin barbero/i }))

    expect(await screen.findByText(/¿atender a ana ruiz ahora\?/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /sí, tomar a ana/i }))

    await waitFor(() => expect(reassignAppointment).toHaveBeenCalledWith('appt-1', MOCK_VIEWER.staff.id))
    expect(walkinsAssign).not.toHaveBeenCalled()
  })

  it('CTA atender: si startService falla, muestra toast en español y refresca la lista (no lo traga)', async () => {
    const repos = makeClockedInRepos()
    // Cita propia y pendiente → el CTA por-operador es "Atender a Ramiro".
    const getAppointments = vi.fn().mockResolvedValue([
      {
        id: 'appt-mine',
        status: 'CONFIRMED',
        salePaymentStatus: null,
        startAt: new Date(Date.now() + 20 * 60_000).toISOString(),
        endAt: new Date(Date.now() + 50 * 60_000).toISOString(),
        totalCents: 0,
        customer: { id: 'c1', fullName: 'Ramiro Vega', phone: null },
        staffUser: { id: MOCK_VIEWER.staff.id, fullName: MOCK_VIEWER.staff.fullName },
        items: [{ label: 'Corte', serviceId: 's1', qty: 1, unitPriceCents: 0 }],
        locationId: 'loc1',
        locationName: 'Centro',
      },
    ])
    repos.agenda.getAppointments = getAppointments
    repos.agenda.checkIn = vi.fn().mockResolvedValue(undefined)
    // Data stale: el server ya tiene la cita IN_SERVICE, así que startService la
    // rechaza. Antes esto era un no-op absoluto (solo console.error en DEV).
    const startService = vi
      .fn()
      .mockRejectedValue(new Error('Appointment must be CHECKED_IN to start'))
    repos.agenda.startService = startService

    const user = userEvent.setup()
    renderHoy({ repos })

    const cta = await screen.findByRole('button', { name: /atender a ramiro/i })
    await waitFor(() => expect(getAppointments).toHaveBeenCalled())
    const callsBefore = getAppointments.mock.calls.length

    await user.click(cta)

    // (a) Toast claro en español (fallback, porque el error del server es
    // técnico en inglés y readableSpanishError lo descarta).
    expect(await screen.findByText(/no se pudo iniciar la cita/i)).toBeInTheDocument()
    // (b) Re-sincroniza la vista stale: reload() vuelve a pedir citas.
    await waitFor(() => expect(getAppointments.mock.calls.length).toBeGreaterThan(callsBefore))
    expect(startService).toHaveBeenCalledWith('appt-mine')
  })
})
