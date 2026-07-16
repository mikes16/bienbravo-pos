import { screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HoyPage } from './HoyPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'
import { POS_HOME_CAJA_STATUS, POS_HOME_COMMISSION } from '../data/home.queries'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

function todayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Repos with the operator already clocked-in. Pair this with cajaOpenMocks() to
// drive HoyPage past both prerequisite gates and exercise the normal Hoy view.
function makeClockedInRepos() {
  const repos = createMockRepositories()
  repos.clock.getEvents = vi.fn().mockResolvedValue([
    { id: 'evt-1', type: 'CLOCK_IN', at: new Date().toISOString() },
  ])
  return repos
}

function cajaOpenMocks() {
  return [
    {
      request: {
        query: POS_HOME_CAJA_STATUS,
        variables: { locationId: 'loc1' },
      },
      result: {
        data: {
          posCajaStatusHome: { isOpen: true, accumulatedCents: 0, openedAt: new Date().toISOString() },
        },
      },
    },
    {
      request: {
        query: POS_HOME_COMMISSION,
        variables: { staffUserId: MOCK_VIEWER.staff.id, locationId: 'loc1', date: todayISO() },
      },
      result: {
        data: {
          staffServiceRevenueToday: 0,
          staffProductRevenueToday: 0,
          staffCommissionToday: 0,
        },
      },
    },
  ]
}

describe('HoyPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('renders the greeting after data load', async () => {
    renderWithProviders(<HoyPage />, {
      repos: { ...makeClockedInRepos(), auth: new TestAuthRepo() },
      apolloMocks: cajaOpenMocks(),
    })
    expect(await screen.findByText(/hola/i)).toBeInTheDocument()
  })

  it('shows the clock-in gate when the operator has not started their day', async () => {
    // Default repo has getEvents() returning [] → not clocked in → gate kicks in.
    renderWithProviders(<HoyPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/inicia tu día/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reloj/i })).toBeInTheDocument()
  })

  it('shows the caja gate when clocked-in but caja is closed', async () => {
    renderWithProviders(<HoyPage />, {
      repos: { ...makeClockedInRepos(), auth: new TestAuthRepo() },
      // No apollo mocks → caja status query returns no data → falls back to closed.
    })
    expect(await screen.findByText(/abre la caja/i)).toBeInTheDocument()
  })

  it('renders the contextual CTA when prerequisites are met', async () => {
    renderWithProviders(<HoyPage />, {
      repos: { ...makeClockedInRepos(), auth: new TestAuthRepo() },
      apolloMocks: cajaOpenMocks(),
    })
    expect(
      await screen.findByRole('button', { name: /nueva venta|atender|cobrar/i }),
    ).toBeInTheDocument()
  })

  it('refetches on window focus', async () => {
    const repos = makeClockedInRepos()
    const getAppointments = vi.fn().mockResolvedValue([])
    repos.agenda.getAppointments = getAppointments
    renderWithProviders(<HoyPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
      apolloMocks: cajaOpenMocks(),
    })
    await waitFor(() => expect(getAppointments).toHaveBeenCalled())
    const initial = getAppointments.mock.calls.length
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(getAppointments.mock.calls.length).toBeGreaterThan(initial))
  })

  it('renders empty list message when no rows', async () => {
    renderWithProviders(<HoyPage />, {
      repos: { ...makeClockedInRepos(), auth: new TestAuthRepo() },
      apolloMocks: cajaOpenMocks(),
    })
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
    renderWithProviders(<HoyPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
      apolloMocks: cajaOpenMocks(),
    })

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
    renderWithProviders(<HoyPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
      apolloMocks: cajaOpenMocks(),
    })

    const cta = await screen.findByRole('button', { name: /atender a ramiro/i })
    await waitFor(() => expect(getAppointments).toHaveBeenCalled())
    const callsBefore = getAppointments.mock.calls.length

    await user.click(cta)

    // (a) Toast claro en español (fallback, porque el error del server es
    // técnico en inglés y readableSpanishError lo descarta).
    expect(await screen.findByText(/no se pudo iniciar la cita/i)).toBeInTheDocument()
    // (b) Re-sincroniza la vista stale: refetch({force}) vuelve a pedir citas.
    await waitFor(() => expect(getAppointments.mock.calls.length).toBeGreaterThan(callsBefore))
    expect(startService).toHaveBeenCalledWith('appt-mine')
  })
})
