import { screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CajaPage } from './CajaPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

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
})
