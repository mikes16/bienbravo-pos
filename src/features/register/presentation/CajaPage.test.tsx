import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CajaPage } from './CajaPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

const OPEN_REGISTER = {
  id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1',
  openSession: {
    id: 'sess-1', status: 'OPEN',
    openedAt: '2026-05-04T09:15:00.000Z', closedAt: null,
    openingCashCents: 50000,
    expectedCashCents: 50000, expectedCardCents: 0, expectedTransferCents: 0,
    countedCashCents: null, countedCardCents: null, countedTransferCents: null,
  },
}

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

describe('CajaPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('renders Sin abrir hero when no open session', async () => {
    const repos = createMockRepositories()
    repos.register.getRegisters = vi.fn().mockResolvedValue([
      { id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1', openSession: null },
    ])
    renderWithProviders(<CajaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/sin abrir/i)).toBeInTheDocument()
  })

  it('renders Caja abierta banner when an open session exists', async () => {
    const repos = createMockRepositories()
    repos.register.getRegisters = vi.fn().mockResolvedValue([
      {
        id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1',
        openSession: {
          id: 'sess-1', status: 'OPEN',
          openedAt: '2026-05-04T09:15:00.000Z', closedAt: null,
          openingCashCents: 50000,
          expectedCashCents: 50000, expectedCardCents: 0, expectedTransferCents: 0,
          countedCashCents: null, countedCardCents: null, countedTransferCents: null,
        },
      },
    ])
    renderWithProviders(<CajaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/caja abierta/i)).toBeInTheDocument()
  })

  it('renders empty state when no registers configured', async () => {
    const repos = createMockRepositories()
    repos.register.getRegisters = vi.fn().mockResolvedValue([])
    renderWithProviders(<CajaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/sin cajas configuradas|no hay cajas/i)).toBeInTheDocument()
  })

  it('Cerrar caja: la revisión de servicios en curso siempre lee de red (force)', async () => {
    const repos = createMockRepositories()
    repos.register.getRegisters = vi.fn().mockResolvedValue([OPEN_REGISTER])
    const getAppointments = vi.fn().mockResolvedValue([])
    const getWalkIns = vi.fn().mockResolvedValue([])
    repos.agenda.getAppointments = getAppointments
    repos.walkins.getWalkIns = getWalkIns
    const user = userEvent.setup()
    renderWithProviders(<CajaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })

    await user.click(await screen.findByText(/cerrar caja/i))

    await waitFor(() => expect(getAppointments).toHaveBeenCalled())
    expect(getAppointments).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), 'loc1', 'IN_SERVICE', { force: true },
    )
    expect(getWalkIns).toHaveBeenCalledWith('loc1', undefined, undefined, { force: true })
  })

  it('refetches registers with force:true on mount, window focus and visibilitychange', async () => {
    const repos = createMockRepositories()
    const getRegisters = vi.fn().mockResolvedValue([OPEN_REGISTER])
    repos.register.getRegisters = getRegisters
    renderWithProviders(<CajaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })

    // Mount fuerza network-only (force:true): entrar a Caja no confía en el
    // snapshot persistido — el cierre remoto desde admin debe reflejarse.
    await waitFor(() => expect(getRegisters).toHaveBeenCalledWith('loc1', { force: true }))

    act(() => { window.dispatchEvent(new Event('focus')) })
    await waitFor(() => expect(getRegisters).toHaveBeenCalledWith('loc1', { force: true }))

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() =>
      expect(getRegisters.mock.calls.filter((c) => c[1]?.force === true).length).toBeGreaterThanOrEqual(2),
    )
  })
})
