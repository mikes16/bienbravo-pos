import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
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

  it('renders all 6 denomination rows (NOT the legacy Numpad)', () => {
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(screen.getByText('$500')).toBeInTheDocument()
    expect(screen.getByText('$200')).toBeInTheDocument()
    expect(screen.getByText('$100')).toBeInTheDocument()
    expect(screen.getByText('$50')).toBeInTheDocument()
    expect(screen.getByText('$20')).toBeInTheDocument()
    expect(screen.getByText('MONEDAS')).toBeInTheDocument()
    // Numpad ('7') should not be on screen — there is no Numpad anymore
    expect(screen.queryByRole('button', { name: '7' })).toBeNull()
  })

  it('tapping + on $500 row enables CTA and shows the amount', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    const plusButtons = screen.getAllByRole('button', { name: /aumentar/i })
    await user.click(plusButtons[0]) // $500 row
    expect(screen.getByRole('button', { name: /abrir caja · \$500/i })).toBeInTheDocument()
  })

  it('CTA disabled when counts empty AND Sin fondo not checked', () => {
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    const cta = screen.getByRole('button', { name: /selecciona el fondo|abrir caja/i })
    expect(cta).toBeDisabled()
  })

  it('checking "Sin fondo" enables CTA with empty counts', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    const toggle = screen.getByRole('checkbox', { name: /sin fondo/i })
    await user.click(toggle)
    const cta = screen.getByRole('button', { name: /abrir sin fondo|abrir caja sin fondo/i })
    expect(cta).not.toBeDisabled()
  })

  it('submitting calls register.openSession with summed total in cents', async () => {
    const repos = createMockRepositories()
    const openSessionSpy = vi.spyOn(repos.register, 'openSession')
    const user = userEvent.setup()
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    const plusButtons = screen.getAllByRole('button', { name: /aumentar/i })
    // 2 × $500 = 100000 cents
    await user.click(plusButtons[0])
    await user.click(plusButtons[0])
    const cta = screen.getByRole('button', { name: /abrir caja · \$1,000/i })
    await user.click(cta)
    expect(openSessionSpy).toHaveBeenCalledWith('reg-a', 100000)
  })

  it('CTA stays disabled when registerId is missing from the URL', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    // Even after tapping a denomination, no registerId means the CTA must not enable
    const plusButtons = screen.getAllByRole('button', { name: /aumentar/i })
    await user.click(plusButtons[0])
    const cta = screen.getByRole('button', { name: /abrir caja · \$500/i })
    expect(cta).toBeDisabled()
  })
})
