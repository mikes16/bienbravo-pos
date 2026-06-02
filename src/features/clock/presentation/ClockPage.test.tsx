import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClockPage } from './ClockPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() { return MOCK_VIEWER }
}

function makeRepos(opts?: { events?: any[]; templates?: any[] }) {
  const repos = createMockRepositories()
  repos.clock.getEvents = vi.fn().mockResolvedValue(opts?.events ?? [])
  repos.clock.getShiftTemplates = vi.fn().mockResolvedValue(opts?.templates ?? [])
  repos.clock.clockIn = vi.fn().mockResolvedValue(true)
  repos.clock.clockOut = vi.fn().mockResolvedValue(true)
  return repos
}

describe('ClockPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('renders "Listo para empezar" status when no events and no shift today', async () => {
    renderWithProviders(<ClockPage />, {
      repos: { ...makeRepos(), auth: new TestAuthRepo() },
    })
    // Sin shift asignado + sin eventos → status card neutral "Listo para
    // empezar". El nombre del barbero no se duplica en la página (ya está
    // en el header global del PosShell con avatar + iniciales).
    expect(await screen.findByText(/listo para empezar/i)).toBeInTheDocument()
  })

  it('renders "Estás trabajando" status when last event is CLOCK_IN', async () => {
    renderWithProviders(<ClockPage />, {
      repos: {
        ...makeRepos({ events: [{ id: 'e1', type: 'CLOCK_IN', at: '2026-05-04T10:00:00Z' }] }),
        auth: new TestAuthRepo(),
      },
    })
    // Cuando está clocked-in la status card dice "Estás trabajando." en
    // prosa natural, no en eyebrows de mono uppercase.
    expect(await screen.findByText(/estás trabajando/i)).toBeInTheDocument()
  })

  it('CTA shows "Entrar" when not clocked in', async () => {
    renderWithProviders(<ClockPage />, {
      repos: { ...makeRepos(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('CTA shows "Salir" when clocked in', async () => {
    renderWithProviders(<ClockPage />, {
      repos: {
        ...makeRepos({ events: [{ id: 'e1', type: 'CLOCK_IN', at: '2026-05-04T10:00:00Z' }] }),
        auth: new TestAuthRepo(),
      },
    })
    expect(await screen.findByRole('button', { name: /salir/i })).toBeInTheDocument()
  })

  it('tapping Entrar calls clockIn with locationId', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<ClockPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await user.click(await screen.findByRole('button', { name: /entrar/i }))
    expect(repos.clock.clockIn).toHaveBeenCalledWith('loc1')
  })

  it('renders empty history state when no events', async () => {
    renderWithProviders(<ClockPage />, {
      repos: { ...makeRepos(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/sin movimientos/i)).toBeInTheDocument()
  })

  it('renders events list directly (no accordion)', async () => {
    renderWithProviders(<ClockPage />, {
      repos: {
        ...makeRepos({
          events: [
            { id: 'e1', type: 'CLOCK_IN', at: '2026-05-04T10:00:00Z' },
            { id: 'e2', type: 'CLOCK_OUT', at: '2026-05-04T20:30:00Z' },
          ],
        }),
        auth: new TestAuthRepo(),
      },
    })
    // El historial ahora vive siempre visible. Para barberos non-tech-savvy
    // tener que tappear "ver historial" era una capa de fricción extra
    // sin valor — la lista cabe sin problema en la pantalla.
    expect(await screen.findByText('Entrada')).toBeInTheDocument()
    expect(screen.getByText('Salida')).toBeInTheDocument()
  })
})
