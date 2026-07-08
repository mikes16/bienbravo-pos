import { act, screen, waitFor } from '@testing-library/react'
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

  // FIX 8: shiftTemplates/latenessRule son config del admin (plantilla de
  // turno, tolerancia de tardanza) sin eviction local — si cambian a mitad
  // del día, el indicador de "tarde" se quedaba stale hasta un hard reload.
  // ClockPage debe refetchear ambas con force:true (network-only) en focus
  // y visibilitychange, mismo patrón dual que CajaPage/MyDayPage.
  it('reloads shiftTemplates/latenessRule with force:true on window focus and visibilitychange', async () => {
    const repos = makeRepos()
    const getShiftTemplates = repos.clock.getShiftTemplates as ReturnType<typeof vi.fn>
    const getLatenessThresholdMin = vi.fn().mockResolvedValue(10)
    repos.clock.getLatenessThresholdMin = getLatenessThresholdMin
    renderWithProviders(<ClockPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })

    await screen.findByText(/listo para empezar/i)

    // Mount inicial es cache-first (force:false) — arranca en 0 llamadas forzadas.
    const forcedTemplatesBefore = getShiftTemplates.mock.calls.filter((c: unknown[]) => (c[2] as { force?: boolean } | undefined)?.force === true).length
    const forcedLatenessBefore = getLatenessThresholdMin.mock.calls.filter((c: unknown[]) => (c[1] as { force?: boolean } | undefined)?.force === true).length
    expect(forcedTemplatesBefore).toBe(0)
    expect(forcedLatenessBefore).toBe(0)

    act(() => { window.dispatchEvent(new Event('focus')) })
    await waitFor(() => {
      expect(getShiftTemplates.mock.calls.filter((c: unknown[]) => (c[2] as { force?: boolean } | undefined)?.force === true).length).toBeGreaterThan(forcedTemplatesBefore)
      expect(getLatenessThresholdMin.mock.calls.filter((c: unknown[]) => (c[1] as { force?: boolean } | undefined)?.force === true).length).toBeGreaterThan(forcedLatenessBefore)
    })
    const forcedTemplatesAfterFocus = getShiftTemplates.mock.calls.filter((c: unknown[]) => (c[2] as { force?: boolean } | undefined)?.force === true).length
    const forcedLatenessAfterFocus = getLatenessThresholdMin.mock.calls.filter((c: unknown[]) => (c[1] as { force?: boolean } | undefined)?.force === true).length

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => {
      expect(getShiftTemplates.mock.calls.filter((c: unknown[]) => (c[2] as { force?: boolean } | undefined)?.force === true).length).toBeGreaterThan(forcedTemplatesAfterFocus)
      expect(getLatenessThresholdMin.mock.calls.filter((c: unknown[]) => (c[1] as { force?: boolean } | undefined)?.force === true).length).toBeGreaterThan(forcedLatenessAfterFocus)
    })
  })
})
