import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { OpenCajaPage } from './OpenCajaPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

describe('OpenCajaPage', () => {
  it('renders the title and FONDO INICIAL label', () => {
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(screen.getByText(/abrir caja/i)).toBeInTheDocument()
    expect(screen.getByText(/fondo inicial/i)).toBeInTheDocument()
  })

  it('preset $500 fills the amount and CTA shows it', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    await user.click(screen.getByRole('button', { name: /^\$500$/ }))
    expect(screen.getByRole('button', { name: /abrir caja · \$500/i })).toBeInTheDocument()
  })

  it('Numpad digit "5" appends to amount', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getByRole('button', { name: '0' }))
    await user.click(screen.getByRole('button', { name: '0' }))
    expect(screen.getByRole('button', { name: /abrir caja · \$5/i })).toBeInTheDocument()
  })

  it('keyboard "5" digit also appends to amount', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    await user.keyboard('500')
    expect(screen.getByRole('button', { name: /abrir caja · \$5/i })).toBeInTheDocument()
  })

  it('CTA disabled when amount is 0 / empty', () => {
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    // When no amount entered and explicitZero not set, CTA reads "Selecciona el fondo →"
    const cta = screen.getByRole('button', { name: /selecciona el fondo/i })
    expect(cta).toBeDisabled()
  })

  it('explicit $0 preset enables CTA', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    await user.click(screen.getByRole('button', { name: /sin fondo/i }))
    const cta = screen.getByRole('button', { name: /abrir caja sin fondo/i })
    expect(cta).not.toBeDisabled()
  })

  it('typing on Numpad resets explicit zero state', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    await user.click(screen.getByRole('button', { name: /sin fondo/i }))
    // Press 5, 0, 0 → 500 cents = $5.00
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getByRole('button', { name: '0' }))
    await user.click(screen.getByRole('button', { name: '0' }))
    // After typing, the CTA reflects the amount, not the zero state
    expect(screen.getByRole('button', { name: /abrir caja · \$5/i })).toBeInTheDocument()
  })
})
