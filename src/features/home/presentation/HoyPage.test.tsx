import { screen, waitFor, act } from '@testing-library/react'
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
})
