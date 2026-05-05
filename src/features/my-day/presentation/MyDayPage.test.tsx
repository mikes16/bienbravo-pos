import { screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { MyDayPage } from './MyDayPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() { return MOCK_VIEWER }
}

describe('MyDayPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('renders heading "Mi Día"', async () => {
    renderWithProviders(<MyDayPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/mi día/i)).toBeInTheDocument()
  })

  it('renders staff name in viewer-aware copy', async () => {
    renderWithProviders(<MyDayPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(MOCK_VIEWER.staff.fullName)).toBeInTheDocument()
  })

  it('renders KPI sections', async () => {
    renderWithProviders(<MyDayPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/ventas/i)).toBeInTheDocument()
  })
})
