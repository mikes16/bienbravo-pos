import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CloseCajaWizard } from './CloseCajaWizard'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

const SESSION = {
  id: 'sess-1',
  status: 'OPEN' as const,
  openedAt: '2026-05-04T09:15:00.000Z',
  closedAt: null,
  expectedCashCents: 184000,
  expectedCardCents: 254000,
  expectedTransferCents: 126000,
  countedCashCents: null,
  countedCardCents: null,
  countedTransferCents: null,
}

function makeRepos() {
  const repos = createMockRepositories()
  repos.register.getRegisters = vi.fn().mockResolvedValue([
    { id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1', openSession: SESSION },
  ])
  repos.register.closeSession = vi.fn().mockResolvedValue({ ...SESSION, status: 'CLOSED' })
  return repos
}

describe('CloseCajaWizard', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('starts at step 1 (count cash)', async () => {
    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...makeRepos(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/cuenta el efectivo/i)).toBeInTheDocument()
  })

  it('next button advances to step 2', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...makeRepos(), auth: new TestAuthRepo() },
    })
    // Wait for step 1 to be visible, then click the wizard CTA
    await screen.findByText(/cuenta el efectivo/i)
    const next = screen.getByRole('button', { name: /siguiente/i })
    await user.click(next)
    expect(await screen.findByText(/confirma los totales digitales/i)).toBeInTheDocument()
  })

  it('completing all steps invokes closeSession', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...repos, auth: new TestAuthRepo() },
    })

    // Step 1 → Step 2
    await screen.findByText(/cuenta el efectivo/i)
    await user.click(screen.getByRole('button', { name: /siguiente/i }))

    // Step 2: confirm tarjeta + stripe
    await screen.findByText(/confirma los totales digitales/i)
    await user.click(screen.getByRole('button', { name: /sí, \$2,540/i }))
    await user.click(screen.getByRole('button', { name: /sí, \$1,260/i }))
    // Advance to step 3
    await user.click(screen.getByRole('button', { name: /revisar/i }))

    // Step 3: ack large diff (cash counted = 0, expected = 184000 → big faltante)
    await screen.findByText(/revisa el resumen/i)
    await user.click(screen.getByRole('checkbox'))

    // Click final close
    await user.click(screen.getByRole('button', { name: /cerrar caja/i }))

    await waitFor(() => {
      expect(repos.register.closeSession).toHaveBeenCalled()
    })
  })
})
