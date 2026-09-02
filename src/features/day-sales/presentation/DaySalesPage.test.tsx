import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DaySalesPage } from './DaySalesPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, InMemoryDaySalesRepository, MOCK_VIEWER } from '@/test/mocks/repositories'
import type { DaySale } from '../domain/day-sales.types'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

const ANA = { id: 'b-ana', fullName: 'Ana' }
const BETO = { id: 'b-beto', fullName: 'Beto' }

function sale(over: Partial<DaySale> & { id: string }): DaySale {
  return {
    createdAt: new Date().toISOString(),
    status: 'PAID',
    subtotalCents: 10000,
    taxTotalCents: 0,
    totalCents: 10000,
    tipCents: 0,
    customer: null,
    sellerStaffUserId: null,
    items: [],
    payments: [{ provider: 'CASH', amountCents: 10000 }],
    discounts: [],
    barbers: [],
    ...over,
  }
}

const MULTI = sale({
  id: 's-multi',
  customer: { id: 'c1', fullName: 'Pedro Multi' },
  items: [
    { id: 'i1', name: 'Corte', qty: 1, unitPriceCents: 20000, totalCents: 20000, staffUser: BETO },
    { id: 'i2', name: 'Ceja', qty: 1, unitPriceCents: 7000, totalCents: 7000, staffUser: ANA },
  ],
  barbers: [BETO, ANA],
  totalCents: 27000,
})
const ONLY_BETO = sale({
  id: 's-beto',
  customer: { id: 'c2', fullName: 'Luis Solo' },
  items: [{ id: 'i3', name: 'Barba', qty: 1, unitPriceCents: 9000, totalCents: 9000, staffUser: BETO }],
  barbers: [BETO],
  totalCents: 9000,
})
const VOIDED = sale({
  id: 's-void',
  status: 'VOID',
  customer: { id: 'c3', fullName: 'Anulado Pérez' },
  items: [{ id: 'i4', name: 'Corte', qty: 1, unitPriceCents: 50000, totalCents: 50000, staffUser: ANA }],
  barbers: [ANA],
  totalCents: 50000,
})

function setup(sales: DaySale[]) {
  const repos = createMockRepositories()
  const daySales = new InMemoryDaySalesRepository()
  daySales.sales = sales
  const spy = vi.spyOn(daySales, 'getDaySales')
  renderWithProviders(<DaySalesPage />, { repos: { ...repos, daySales, auth: new TestAuthRepo() } })
  return { spy }
}

describe('DaySalesPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
    window.print = vi.fn()
  })
  afterEach(() => vi.restoreAllMocks())

  it('lists every sale of the day and sums PAID only', async () => {
    setup([MULTI, ONLY_BETO, VOIDED])
    expect(await screen.findByText('Pedro Multi')).toBeInTheDocument()
    expect(screen.getByText('Luis Solo')).toBeInTheDocument()
    expect(screen.getByText('Anulado Pérez')).toBeInTheDocument()
    // 27000 + 9000 = $360; la anulada ($500) no cuenta.
    expect(screen.getByText('$360')).toBeInTheDocument()
    expect(screen.getByText(/2 ventas cobradas · 1 anulada/i)).toBeInTheDocument()
    expect(screen.getByText('Anulada')).toBeInTheDocument()
  })

  it('filtering by a barber keeps multi-barber tickets they took part in', async () => {
    const user = userEvent.setup()
    setup([MULTI, ONLY_BETO, VOIDED])
    await screen.findByText('Pedro Multi')
    const chips = screen.getByRole('group', { name: /filtrar por barbero/i })
    await user.click(within(chips).getByRole('button', { name: 'Ana' }))
    // Ana hizo la ceja del ticket multi y el corte anulado; no tocó el de Luis.
    expect(screen.getByText('Pedro Multi')).toBeInTheDocument()
    expect(screen.getByText('Anulado Pérez')).toBeInTheDocument()
    expect(screen.queryByText('Luis Solo')).not.toBeInTheDocument()
    await user.click(within(chips).getByRole('button', { name: 'Beto' }))
    expect(screen.getByText('Pedro Multi')).toBeInTheDocument()
    expect(screen.getByText('Luis Solo')).toBeInTheDocument()
    expect(screen.queryByText('Anulado Pérez')).not.toBeInTheDocument()
    await user.click(within(chips).getByRole('button', { name: 'Todos' }))
    expect(screen.getByText('Anulado Pérez')).toBeInTheDocument()
  })

  it('opens the ticket and reprints it with the reprint mark', async () => {
    const user = userEvent.setup()
    setup([MULTI])
    await user.click(await screen.findByRole('button', { name: /ver ticket de pedro multi/i }))
    const dialog = await screen.findByRole('dialog', { name: /ticket de venta/i })
    expect(within(dialog).getByText('Ceja')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /reimprimir ticket/i }))
    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1))
    expect(document.querySelector('.bb-print-reprint')?.textContent).toMatch(/reimpresión/i)
  })

  it('does not reprint a voided sale', async () => {
    const user = userEvent.setup()
    setup([VOIDED])
    await user.click(await screen.findByRole('button', { name: /ver ticket de anulado pérez/i }))
    const dialog = await screen.findByRole('dialog', { name: /ticket de venta/i })
    expect(within(dialog).getByRole('button', { name: /reimprimir ticket/i })).toBeDisabled()
  })

  it('shows an error banner instead of a silent empty list when loading fails', async () => {
    const repos = createMockRepositories()
    repos.daySales.getDaySales = vi.fn().mockRejectedValue(new Error('boom'))
    renderWithProviders(<DaySalesPage />, { repos: { ...repos, auth: new TestAuthRepo() } })
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar/i)
  })
})
