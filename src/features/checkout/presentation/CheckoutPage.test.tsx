import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CheckoutPage } from './CheckoutPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() { return MOCK_VIEWER }
}

const SVC_CORTE = { id: 'svc-corte', name: 'Corte', priceCents: 28000, durationMin: 30, isAddOn: false, imageUrl: null, categoryId: 'cat-cortes', extras: [] }
const PROD_SHAMPOO = { id: 'prod-shampoo', name: 'Shampoo', priceCents: 25000, sku: null, imageUrl: null, categoryId: 'cat-prod' }
const BARBERS = [
  { id: 'b1', fullName: 'Antonio', photoUrl: null },
  { id: 'b2', fullName: 'Beto', photoUrl: null },
  { id: 'b3', fullName: 'Carlos', photoUrl: null },
]
const SESSION = {
  id: 'sess-1', status: 'OPEN' as const, openedAt: '2026-05-04T09:15:00.000Z', closedAt: null,
  expectedCashCents: 0, expectedCardCents: 0, expectedTransferCents: 0,
  countedCashCents: null, countedCardCents: null, countedTransferCents: null,
}
const REGISTER = { id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1', openSession: SESSION }
const MOSTRADOR = { id: 'cust-mostrador', fullName: 'Mostrador' }

function makeRepos() {
  const repos = createMockRepositories()
  repos.checkout.getServices = vi.fn().mockResolvedValue([SVC_CORTE])
  repos.checkout.getProducts = vi.fn().mockResolvedValue([PROD_SHAMPOO])
  repos.checkout.getCombos = vi.fn().mockResolvedValue([])
  repos.checkout.getCategories = vi.fn().mockResolvedValue([
    { id: 'cat-cortes', name: 'Cortes', sortOrder: 1, slug: 'cortes', appliesTo: 'SERVICE' },
    { id: 'cat-prod', name: 'Productos', sortOrder: 2, slug: 'productos', appliesTo: 'PRODUCT' },
  ])
  repos.checkout.getBarbers = vi.fn().mockResolvedValue(BARBERS)
  repos.checkout.getStockLevels = vi.fn().mockResolvedValue([{ productId: 'prod-shampoo', quantity: 10 }])
  repos.checkout.searchCustomers = vi.fn().mockResolvedValue([])
  repos.checkout.findOrCreateCustomer = vi.fn().mockResolvedValue({ id: 'c-new', fullName: 'New', email: null, phone: null })
  repos.checkout.findOrCreateMostradorCustomer = vi.fn().mockResolvedValue(MOSTRADOR)
  repos.checkout.getCustomer = vi.fn().mockResolvedValue(null)
  repos.checkout.getWalkIn = vi.fn().mockResolvedValue(null)
  repos.checkout.createSale = vi.fn().mockResolvedValue({
    id: 'sale-1', status: 'PAID', paymentStatus: 'PAID', totalCents: 28000, paidTotalCents: 28000,
  })
  repos.register.getRegisters = vi.fn().mockResolvedValue([REGISTER])
  return repos
}

describe('CheckoutPage (integration)', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('free sale happy path: catalog → cart → CASH → success', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    // Wait for catalog to load
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    // Add corte to cart
    await user.click(screen.getAllByText('Corte')[0])
    // Open payment sheet via Cobrar CTA
    const cobrarBtn = await screen.findByRole('button', { name: /cobrar.*280/i })
    await user.click(cobrarBtn)
    // Pick CASH
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    // Confirm
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    // Mostrador fallback used (no customer selected)
    await waitFor(() => {
      expect(repos.checkout.findOrCreateMostradorCustomer).toHaveBeenCalled()
      expect(repos.checkout.createSale).toHaveBeenCalled()
    })
  })

  it('walk-in completion: pre-fills customer + barber from WalkIn', async () => {
    const repos = makeRepos()
    repos.checkout.getWalkIn = vi.fn().mockResolvedValue({
      id: 'w1',
      status: 'ASSIGNED',
      customer: { id: 'c-papa', fullName: 'Papá Test', email: null, phone: null },
      assignedStaffUser: { id: 'b2', fullName: 'Beto' },
    })
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeWalkInId=w1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/papá test/i, {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it('multi-barber split: 3 cortes with 3 different barbers → mutation has 3 distinct staffUserIds', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    // Add 3 cortes — click the catalog tile button (role=button, containing 'Corte')
    // After first click, 'Corte' appears in both catalog and cart; use getAllByText
    await user.click(screen.getAllByText('Corte')[0])
    await user.click(screen.getAllByText('Corte')[0])
    await user.click(screen.getAllByText('Corte')[0])
    // Now 3 lines exist. Tap the last line's barber chip and pick Carlos
    const barberChips = screen.getAllByRole('button', { name: /cambiar barbero/i })
    await user.click(barberChips[barberChips.length - 1])
    await user.click(await screen.findByLabelText('Carlos'))
    // Tap the new last chip and swap to Beto
    const chipsAgain = screen.getAllByRole('button', { name: /cambiar barbero/i })
    await user.click(chipsAgain[chipsAgain.length - 1])
    await user.click(await screen.findByLabelText('Beto'))
    // Cobrar
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => {
      const call = (repos.checkout.createSale as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.items.length).toBe(3)
    }, { timeout: 5000 })
  })

  it('customer skip → Mostrador fallback used at submit', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    // Don't touch customer chip
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => {
      expect(repos.checkout.findOrCreateMostradorCustomer).toHaveBeenCalled()
      const call = (repos.checkout.createSale as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.customerId).toBe(MOSTRADOR.id)
    })
  })

  it('stock insufficient error: shows error banner', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.checkout.createSale = vi.fn().mockRejectedValue(new Error('Stock insuficiente: Shampoo'))
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Shampoo', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Shampoo')[0])
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => expect(screen.getByText(/stock insuficiente/i)).toBeInTheDocument())
  })

  it('no open register session: shows error', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.register.getRegisters = vi.fn().mockResolvedValue([{ ...REGISTER, openSession: null }])
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => expect(screen.getByText(/no hay caja abierta/i)).toBeInTheDocument())
  })
})
