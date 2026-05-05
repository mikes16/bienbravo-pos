import { screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HoyPage } from './HoyPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

describe('HoyPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('renders the greeting after data load', async () => {
    renderWithProviders(<HoyPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/hola/i)).toBeInTheDocument()
  })

  it('renders the contextual CTA', async () => {
    renderWithProviders(<HoyPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    // Empty day, caja state from mocks → some CTA renders
    expect(await screen.findByRole('button', { name: /nueva venta|abrir caja|atender|cobrar/i })).toBeInTheDocument()
  })

  it('refetches on window focus', async () => {
    const repos = createMockRepositories()
    const getAppointments = vi.fn().mockResolvedValue([])
    repos.agenda.getAppointments = getAppointments
    renderWithProviders(<HoyPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
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
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/todavía no tienes movimiento/i)).toBeInTheDocument()
  })
})
