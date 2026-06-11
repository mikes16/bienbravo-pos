import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { MyDayPage, computeWorkedMinutes } from './MyDayPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'
import type { PosViewer } from '@/core/auth/auth.types'
import type { SaleDetail } from '@/features/checkout/data/checkout.repository'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository'
import { POS_MY_DAY_EARNINGS } from '@/features/home/data/home.queries'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() { return MOCK_VIEWER }
}

/** AuthRepo que devuelve un viewer con permisos arbitrarios — para probar el
 *  gate de `pos.sale.read`. */
function authRepoWithPermissions(permissions: string[]): InMemoryAuthRepository {
  const viewer: PosViewer = { ...MOCK_VIEWER, permissions }
  return new (class extends InMemoryAuthRepository {
    override async getViewer() { return viewer }
  })()
}

/** Mock Apollo del query de earnings con una venta directa atribuida al viewer
 *  (sin walk-in ni appointment linkados → aparece como row de "Venta"). */
function earningsMockWithOneSale(saleId: string) {
  return {
    request: {
      query: POS_MY_DAY_EARNINGS,
      variables: {
        staffUserId: MOCK_VIEWER.staff.id,
        locationId: 'loc1',
        date: new Date(
          `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
        )
          .toISOString()
          .slice(0, 10),
      },
    },
    // Variables se matchean por igualdad profunda; usamos el mismo todayISO.
    variableMatcher: () => true,
    result: {
      data: {
        staffDayEarnings: {
          __typename: 'StaffDayEarnings',
          serviceCommissionCents: 12000,
          productCommissionCents: 0,
          tipsCents: 0,
          totalCommissionCents: 12000,
          serviceRevenueCents: 30000,
          productRevenueCents: 0,
          perSale: [
            {
              __typename: 'StaffDaySaleEarning',
              saleId,
              commissionCents: 12000,
              tipCents: 0,
              earningsCents: 12000,
              soldAt: new Date().toISOString(),
              customerName: 'Juan Pérez',
              linkedWalkInId: null,
              linkedAppointmentId: null,
              itemLabels: ['Corte clásico'],
              attributedRevenueCents: 30000,
            },
          ],
        },
      },
    },
  }
}

/** Mock de earnings con DOS ventas directas atribuidas al viewer → dos rows de
 *  "Venta". Cada una con su propio cliente para distinguir los botones. */
function earningsMockWithTwoSales(a: { saleId: string; customerName: string }, b: { saleId: string; customerName: string }) {
  const base = earningsMockWithOneSale(a.saleId)
  return {
    ...base,
    result: {
      data: {
        staffDayEarnings: {
          ...base.result.data.staffDayEarnings,
          perSale: [
            {
              __typename: 'StaffDaySaleEarning',
              saleId: a.saleId,
              commissionCents: 12000,
              tipCents: 0,
              earningsCents: 12000,
              soldAt: new Date(Date.now() - 1000).toISOString(),
              customerName: a.customerName,
              linkedWalkInId: null,
              linkedAppointmentId: null,
              itemLabels: ['Corte clásico'],
              attributedRevenueCents: 30000,
            },
            {
              __typename: 'StaffDaySaleEarning',
              saleId: b.saleId,
              commissionCents: 9000,
              tipCents: 0,
              earningsCents: 9000,
              soldAt: new Date().toISOString(),
              customerName: b.customerName,
              linkedWalkInId: null,
              linkedAppointmentId: null,
              itemLabels: ['Barba'],
              attributedRevenueCents: 20000,
            },
          ],
        },
      },
    },
  }
}

/** Construye un SaleDetail mínimo pero válido para el id/cliente dados. */
function saleDetail(saleId: string, customerName: string, itemName: string): SaleDetail {
  return {
    id: saleId,
    createdAt: new Date().toISOString(),
    subtotalCents: 30000,
    taxTotalCents: 0,
    totalCents: 30000,
    customer: { id: `c-${saleId}`, fullName: customerName },
    payments: [{ provider: 'CASH', amountCents: 30000 }],
    items: [
      {
        id: `${saleId}-item-0`,
        name: itemName,
        qty: 1,
        unitPriceCents: 30000,
        totalCents: 30000,
        staffUser: { id: MOCK_VIEWER.staff.id, fullName: MOCK_VIEWER.staff.fullName },
      },
    ],
    discounts: [],
  }
}

/** Promesa controlable: el test decide cuándo (y con qué) resuelve. */
interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function evt(at: string, type: 'CLOCK_IN' | 'CLOCK_OUT'): TimeClockEvent {
  return { id: at, type, at }
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
    // Con el mock vacío (sin ventas) el subtitle "en ventas" del hero no se
    // renderiza (grossRevenue=0), así que afirmamos sobre un KPI que SIEMPRE
    // está presente: la sección de operación.
    expect(await screen.findByText(/citas completadas/i)).toBeInTheDocument()
    expect(screen.getByText(/tiempo trabajado/i)).toBeInTheDocument()
  })

  // ── Gate de pos.sale.read ──────────────────────────────────────────────

  it('WITHOUT pos.sale.read: la row de venta NO es clickable (sin button)', async () => {
    const saleId = 'sale-abc'
    renderWithProviders(<MyDayPage />, {
      // MOCK_VIEWER no incluye pos.sale.read por default.
      repos: { ...createMockRepositories(), auth: authRepoWithPermissions(['pos.sale.create']) },
      apolloMocks: [earningsMockWithOneSale(saleId)],
    })
    // La venta aparece como row con el nombre del cliente.
    const customer = await screen.findByText('Juan Pérez')
    expect(customer).toBeInTheDocument()
    // La row NO debe ser un <button> ni tener role button — gate duro.
    const row = customer.closest('button')
    expect(row).toBeNull()
    expect(
      screen.queryByRole('button', { name: /ver detalle de venta/i }),
    ).not.toBeInTheDocument()
  })

  it('WITH pos.sale.read: la row es un button y al hacer tap abre el sheet con "Tu parte"', async () => {
    const saleId = 'sale-abc'
    const checkout = createMockRepositories().checkout
    // Override getSaleDetail para que el sheet tenga contenido.
    checkout.getSaleDetail = async () => ({
      id: saleId,
      createdAt: new Date().toISOString(),
      subtotalCents: 30000,
      taxTotalCents: 0,
      totalCents: 30000,
      customer: { id: 'c1', fullName: 'Juan Pérez' },
      payments: [{ provider: 'CASH', amountCents: 30000 }],
      items: [
        {
          id: `${saleId}-item-0`,
          name: 'Corte clásico',
          qty: 1,
          unitPriceCents: 30000,
          totalCents: 30000,
          staffUser: { id: MOCK_VIEWER.staff.id, fullName: MOCK_VIEWER.staff.fullName },
        },
      ],
      discounts: [],
    })

    renderWithProviders(<MyDayPage />, {
      repos: {
        ...createMockRepositories(),
        checkout,
        auth: authRepoWithPermissions(['pos.sale.create', 'pos.sale.read']),
      },
      apolloMocks: [earningsMockWithOneSale(saleId)],
    })

    const trigger = await screen.findByRole('button', { name: /ver detalle de venta/i })
    await userEvent.click(trigger)

    // El sheet abre con el desglose + "Tu parte". Scope al dialog para no
    // colisionar con la sublabel "Tu parte" / monto de la propia row.
    const dialog = await screen.findByRole('dialog', { name: /detalle de venta/i })
    const inDialog = within(dialog)
    expect(inDialog.getByText(/tu parte/i)).toBeInTheDocument()
    // $120 (12000 cents) — earningsCents (tuParteCents) del perSale entry.
    expect(inDialog.getByText('$120')).toBeInTheDocument()
    // El cuerpo compartido (SaleTicketBody) renderiza el item de la venta.
    expect(inDialog.getByText(/corte clásico/i)).toBeInTheDocument()
  })

  // ── Carrera A→B (fast-tap) ─────────────────────────────────────────────
  //
  // El cajero abre la venta A y, antes de que su getSaleDetail resuelva, abre
  // la venta B. El effect cleanup del sheet marca `cancelled=true` para la
  // request de A, así que cuando A resuelve TARDE su resultado se descarta y
  // el sheet termina mostrando B. Sin ese cleanup, la resolución stale de A
  // pisaría a B (last-write-wins en el orden equivocado).
  it('A→B fast-tap: si A resuelve después de abrir B, el sheet muestra B (no A stale)', async () => {
    const saleA = 'sale-A'
    const saleB = 'sale-B'
    const deferredById: Record<string, Deferred<SaleDetail | null>> = {
      [saleA]: deferred<SaleDetail | null>(),
      [saleB]: deferred<SaleDetail | null>(),
    }

    const checkout = createMockRepositories().checkout
    // Resolución controlada por id: el test decide el orden de resolución.
    checkout.getSaleDetail = (id: string) => deferredById[id].promise

    renderWithProviders(<MyDayPage />, {
      repos: {
        ...createMockRepositories(),
        checkout,
        auth: authRepoWithPermissions(['pos.sale.create', 'pos.sale.read']),
      },
      apolloMocks: [
        earningsMockWithTwoSales(
          { saleId: saleA, customerName: 'Cliente Alpha' },
          { saleId: saleB, customerName: 'Cliente Beta' },
        ),
      ],
    })

    // Tap A → abre el sheet con A en vuelo (sin resolver todavía).
    const triggerA = await screen.findByRole('button', { name: /ver detalle de venta de cliente alpha/i })
    await userEvent.click(triggerA)

    // Tap B → re-targetea el sheet a B (B también en vuelo).
    const triggerB = await screen.findByRole('button', { name: /ver detalle de venta de cliente beta/i })
    await userEvent.click(triggerB)

    // B resuelve PRIMERO (el caso feliz), luego A resuelve TARDE.
    deferredById[saleB].resolve(saleDetail(saleB, 'Cliente Beta', 'Barba'))
    deferredById[saleA].resolve(saleDetail(saleA, 'Cliente Alpha', 'Corte clásico'))

    // El sheet debe mostrar B (Barba), nunca el item de A (Corte clásico).
    const dialog = await screen.findByRole('dialog', { name: /detalle de venta/i })
    const inDialog = within(dialog)
    expect(await inDialog.findByText(/barba/i)).toBeInTheDocument()
    expect(inDialog.queryByText(/corte clásico/i)).not.toBeInTheDocument()
  })

  // ── Error path ─────────────────────────────────────────────────────────
  //
  // Cuando getSaleDetail rechaza, el sheet muestra su estado de error
  // (role="alert") en vez de quedarse en loading o crashear.
  it('error path: si getSaleDetail rechaza, el sheet muestra el estado de error', async () => {
    const saleId = 'sale-err'
    const checkout = createMockRepositories().checkout
    checkout.getSaleDetail = async () => {
      throw new Error('boom')
    }

    renderWithProviders(<MyDayPage />, {
      repos: {
        ...createMockRepositories(),
        checkout,
        auth: authRepoWithPermissions(['pos.sale.create', 'pos.sale.read']),
      },
      apolloMocks: [earningsMockWithOneSale(saleId)],
    })

    const trigger = await screen.findByRole('button', { name: /ver detalle de venta/i })
    await userEvent.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: /detalle de venta/i })
    const alert = await within(dialog).findByRole('alert')
    expect(alert).toHaveTextContent(/no se pudo cargar/i)
  })
})

describe('computeWorkedMinutes', () => {
  const NOW = new Date('2026-05-06T10:00:00Z')

  it('returns 0 for empty events', () => {
    expect(computeWorkedMinutes([], NOW)).toBe(0)
  })

  it('counts a single closed IN/OUT span', () => {
    const events = [evt('2026-05-06T08:00:00Z', 'CLOCK_IN'), evt('2026-05-06T09:30:00Z', 'CLOCK_OUT')]
    expect(computeWorkedMinutes(events, NOW)).toBe(90)
  })

  it('keeps an open span running up to "now"', () => {
    const events = [evt('2026-05-06T09:00:00Z', 'CLOCK_IN')]
    expect(computeWorkedMinutes(events, NOW)).toBe(60)
  })

  it('ignores duplicate CLOCK_IN events (real bug from the field)', () => {
    // 4 ENTRADAs in a row, then SALIDA, then ENTRADA — the historical case
    // that surfaced the original "0h 0m" bug.
    const events = [
      evt('2026-05-06T00:45:00Z', 'CLOCK_IN'),
      evt('2026-05-06T00:45:30Z', 'CLOCK_IN'),
      evt('2026-05-06T00:48:00Z', 'CLOCK_IN'),
      evt('2026-05-06T00:48:30Z', 'CLOCK_IN'),
      evt('2026-05-06T01:17:00Z', 'CLOCK_OUT'),
      evt('2026-05-06T01:17:30Z', 'CLOCK_IN'),
    ]
    // First IN at 00:45 → OUT at 01:17 = 32 minutes. Re-IN at 01:17:30 still
    // open at NOW (10:00) ≈ 522.5 minutes. Total ≈ 554.5.
    const result = computeWorkedMinutes(events, NOW)
    expect(result).toBeGreaterThan(550)
    expect(result).toBeLessThan(560)
  })

  it('drops orphan CLOCK_OUT events', () => {
    const events = [evt('2026-05-06T08:00:00Z', 'CLOCK_OUT'), evt('2026-05-06T09:00:00Z', 'CLOCK_IN')]
    expect(computeWorkedMinutes(events, NOW)).toBe(60)
  })

  it('handles events delivered out of order', () => {
    const events = [
      evt('2026-05-06T09:30:00Z', 'CLOCK_OUT'),
      evt('2026-05-06T08:00:00Z', 'CLOCK_IN'),
    ]
    expect(computeWorkedMinutes(events, NOW)).toBe(90)
  })
})
