import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApolloClient } from '@apollo/client'
import { DaySalesPage } from './DaySalesPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, InMemoryDaySalesRepository, MOCK_VIEWER } from '@/test/mocks/repositories'
import {
  FreshnessContext,
  type FreshnessContextValue,
  type FreshnessLoader,
  type FreshnessTopic,
} from '@/core/freshness/FreshnessProvider'
import type { DaySalesRepository } from '../data/day-sales.repository'
import type { DaySale } from '../domain/day-sales.types'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

const ANA = { id: 'b-ana', fullName: 'Ana' }
const BETO = { id: 'b-beto', fullName: 'Beto' }

const TOTAL_LABEL = 'Total cobrado del día'

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

interface Registration {
  load: FreshnessLoader
  topics: readonly FreshnessTopic[]
}

/**
 * Canal de frescura de mentira: la pantalla ya no escucha el socket por su
 * cuenta, así que el test hace de servidor avisando por el tema `sales`.
 * El objeto es estable (se crea una vez) para no re-registrar en cada render.
 */
function createFreshnessStub() {
  const registrations = new Set<Registration>()
  const value: FreshnessContextValue = {
    connection: 'connected',
    lastUpdatedAt: null,
    refreshAll: () => {},
    setPaused: () => {},
    register: (load, topics) => {
      const entry: Registration = { load, topics }
      registrations.add(entry)
      return () => {
        registrations.delete(entry)
      }
    },
  }
  /** Avisa del tema y espera a que las cargas registradas terminen. */
  async function announce(topic: FreshnessTopic) {
    await act(async () => {
      await Promise.allSettled(
        [...registrations].filter((r) => r.topics.includes(topic)).map((r) => r.load()),
      )
    })
  }
  return { value, registrations, announce }
}

function renderPage(daySales: DaySalesRepository) {
  const fresh = createFreshnessStub()
  const repos = createMockRepositories({ daySales, auth: new TestAuthRepo() })
  renderWithProviders(
    <FreshnessContext.Provider value={fresh.value}>
      <DaySalesPage />
    </FreshnessContext.Provider>,
    { repos },
  )
  return fresh
}

function setup(sales: DaySale[]) {
  const daySales = new InMemoryDaySalesRepository()
  daySales.sales = sales
  const spy = vi.spyOn(daySales, 'getDaySales')
  const fresh = renderPage(daySales)
  return { spy, daySales, ...fresh }
}

function totalValue() {
  return screen.getByRole('group', { name: TOTAL_LABEL })
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
    expect(totalValue()).toHaveTextContent('$360')
    expect(screen.getByText(/2 ventas cobradas · 1 anulada/i)).toBeInTheDocument()
    expect(screen.getByText('Anulada')).toBeInTheDocument()
  })

  it('asks the network on mount and never with a cache option', async () => {
    const { spy } = setup([MULTI])
    await screen.findByText('Pedro Multi')
    expect(spy).toHaveBeenCalledWith('loc1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
    // La firma ya no admite elegir política: el dinero SIEMPRE va a la red.
    for (const call of spy.mock.calls) expect(call).toHaveLength(2)
  })

  it('refreshes on a "sales" announcement instead of opening its own subscription', async () => {
    const subscribeSpy = vi.spyOn(ApolloClient.prototype, 'subscribe')
    const { spy, daySales, registrations, announce } = setup([ONLY_BETO])
    await screen.findByText('Luis Solo')
    expect(spy).toHaveBeenCalledTimes(1)
    expect([...registrations].some((r) => r.topics.includes('sales'))).toBe(true)

    // Otra terminal cobró: el servidor avisa y la pantalla vuelve a preguntar.
    daySales.sales = [ONLY_BETO, MULTI]
    await announce('sales')

    expect(spy).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('Pedro Multi')).toBeInTheDocument()
    expect(totalValue()).toHaveTextContent('$360')
    // La página no abre suscripciones propias (R8: dependían del foco).
    expect(subscribeSpy).not.toHaveBeenCalled()
  })

  it('shows skeletons instead of $0 or an empty list while the first load is in flight', async () => {
    const daySales = new InMemoryDaySalesRepository()
    vi.spyOn(daySales, 'getDaySales').mockReturnValue(new Promise<DaySale[]>(() => {}))
    renderPage(daySales)

    const total = await screen.findByRole('group', { name: TOTAL_LABEL })
    expect(total).toHaveAttribute('aria-busy', 'true')
    expect(total.textContent).not.toContain('$')
    expect(screen.queryByText(/aún no hay ventas hoy/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/ventas cobradas/i)).not.toBeInTheDocument()
  })

  it('shows a real $0 with the empty state when the day truly has no sales', async () => {
    setup([])
    expect(await screen.findByText(/aún no hay ventas hoy/i)).toBeInTheDocument()
    expect(totalValue()).toHaveTextContent('$0')
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
    const daySales = new InMemoryDaySalesRepository()
    vi.spyOn(daySales, 'getDaySales').mockRejectedValue(new Error('boom'))
    renderPage(daySales)
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar/i)
    expect(totalValue().textContent).not.toContain('$')
  })

  it('drops the previous list when a refresh fails and recovers with Reintentar', async () => {
    const user = userEvent.setup()
    const daySales = new InMemoryDaySalesRepository()
    daySales.sales = [MULTI]
    let fails = false
    vi.spyOn(daySales, 'getDaySales').mockImplementation(async () => {
      if (fails) throw new Error('boom')
      return daySales.sales
    })
    const { announce } = renderPage(daySales)
    await screen.findByText('Pedro Multi')

    fails = true
    await announce('sales')

    // Nada de lista vieja haciéndose pasar por la de ahora, y nada de cifra.
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudieron cargar/i)
    expect(screen.queryByText('Pedro Multi')).not.toBeInTheDocument()
    const total = totalValue()
    expect(total.textContent).not.toContain('$')
    expect(total).toHaveTextContent(/sin conexión/i)

    fails = false
    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(await screen.findByText('Pedro Multi')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
