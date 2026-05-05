import { screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WalkInsPage } from './WalkInsPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() { return MOCK_VIEWER }
}

const PENDING_WALKIN = {
  id: 'w1',
  status: 'PENDING' as const,
  customerName: 'Carlos Méndez',
  customerPhone: null,
  customerEmail: null,
  createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  assignedStaffUser: null,
  customer: null,
}

describe('WalkInsPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('renders empty state when no walk-ins', async () => {
    const repos = createMockRepositories()
    repos.walkins.getWalkIns = vi.fn().mockResolvedValue([])
    renderWithProviders(<WalkInsPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/aún no hay clientes esperando|sin clientes/i)).toBeInTheDocument()
  })

  it('renders pending walk-in row with name + wait time', async () => {
    const repos = createMockRepositories()
    repos.walkins.getWalkIns = vi.fn().mockResolvedValue([PENDING_WALKIN])
    renderWithProviders(<WalkInsPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/carlos méndez/i)).toBeInTheDocument()
    expect(screen.getByText(/5 min/i)).toBeInTheDocument()
  })

  it('renders Tomar action for pending walk-ins', async () => {
    const repos = createMockRepositories()
    repos.walkins.getWalkIns = vi.fn().mockResolvedValue([PENDING_WALKIN])
    renderWithProviders(<WalkInsPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByRole('button', { name: /tomar/i })).toBeInTheDocument()
  })
})
