import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RepositoryProvider } from '@/core/repositories/RepositoryProvider'
import { LocationProvider } from '@/core/location/LocationProvider'
import { PosAuthProvider } from '@/core/auth/PosAuthProvider'
import { ToastProvider } from '@/core/toast/ToastProvider'
import type { PosViewer } from '@/core/auth/auth.types'
import type { Repositories } from '@/core/repositories/registry'
import { createMockRepositories, InMemoryCheckoutRepository, MOCK_VIEWER } from '@/test/mocks/repositories'
import { CheckoutRejectedError } from '../domain/checkout.types'
import type { CatalogProduct, SaleResult as ApiSaleResult } from '../domain/checkout.types'
import { useCheckout } from './useCheckout'
import type { AddCatalogItemResult } from './useCheckout'

/**
 * Modo "venta a staff" del cobro (spec `docs/superpowers/specs/
 * 2026-09-18-venta-a-staff-design.md` §4.3 y §4.5): quién compra para quién,
 * sin cupones, precio staff por variante y cupo del mes visible ANTES de
 * cobrar. Nada de esto decide — el API vuelve a medirlo todo en la transacción
 * del cobro; aquí se prueba que el POS no mande un ticket que ya sabe que va a
 * ser rechazado, y que nunca cobre un precio staff que no pueda sostener.
 */

const SESSION = {
  id: 'sess-1',
  status: 'OPEN' as const,
  openedAt: '2026-09-22T15:00:00.000Z',
  closedAt: null,
  openingCashCents: 0,
  expectedCashCents: 0,
  expectedCardCents: 0,
  expectedTransferCents: 0,
  countedCashCents: null,
  countedCardCents: null,
  countedTransferCents: null,
}
const REGISTER = { id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1', openSession: SESSION }

/** Una sola variante: no hay presentación que elegir. */
const CERA: CatalogProduct = {
  id: 'prod-cera', name: 'Cera', sku: null, priceCents: 25000, imageUrl: null, categoryId: null, sortOrder: 0,
  staffSaleEligible: true, staffPriceCents: 12000,
  variants: [{ id: 'var-cera', priceCents: 25000, staffPriceCents: 12000 }],
}
/** Dos presentaciones con precio staff distinto → la línea debe elegir una. */
const SPRAY: CatalogProduct = {
  id: 'prod-spray', name: 'Spray', sku: null, priceCents: 18000, imageUrl: null, categoryId: null, sortOrder: 1,
  staffSaleEligible: true, staffPriceCents: 9000,
  variants: [
    { id: 'var-chico', priceCents: 18000, staffPriceCents: 9000 },
    { id: 'var-grande', priceCents: 30000, staffPriceCents: 15000 },
  ],
}
/** El admin lo sacó de la venta a staff. */
const POMADA: CatalogProduct = {
  id: 'prod-pomada', name: 'Pomada', sku: null, priceCents: 20000, imageUrl: null, categoryId: null, sortOrder: 2,
  staffSaleEligible: false, staffPriceCents: 10000,
  variants: [{ id: 'var-pomada', priceCents: 20000, staffPriceCents: 10000 }],
}
const CATALOG = [CERA, SPRAY, POMADA]

/** Lo que el grid manda a `addCatalogItem` (card del catálogo). */
const tile = (p: CatalogProduct, productVariantId?: string) => ({
  kind: 'product' as const, id: p.id, name: p.name, priceCents: p.priceCents, categoryId: null,
  ...(productVariantId ? { productVariantId } : {}),
})
const CORTE_TILE = { kind: 'service' as const, id: 'svc-1', name: 'Corte Clásico', priceCents: 35000, categoryId: null }

const CASH = { payments: [{ provider: 'CASH' as const, amountCents: 12000 }], tipCents: 0 }
const SALE_OK: ApiSaleResult = { id: 'sale-1', status: 'PAID', paymentStatus: 'PAID', totalCents: 12000, paidTotalCents: 12000 }

const withoutPermissions = (...denied: string[]): PosViewer => ({
  ...MOCK_VIEWER,
  permissions: MOCK_VIEWER.permissions.filter((p) => !denied.includes(p)),
})

function makeRepos(viewer: PosViewer = MOCK_VIEWER) {
  const checkout = new InMemoryCheckoutRepository()
  checkout.getProducts = vi.fn().mockResolvedValue(CATALOG)
  checkout.createSale = vi.fn().mockResolvedValue(SALE_OK)
  const repos: Repositories = createMockRepositories({ checkout })
  // Sin caja abierta el cobro ni siquiera arranca.
  repos.register.getRegisters = vi.fn().mockResolvedValue([REGISTER])
  // El comprador por default sale de la SESIÓN: el viewer tiene que resolver.
  repos.auth.getViewer = vi.fn().mockResolvedValue(viewer)
  return { repos, checkout }
}

function renderCheckout(repos: Repositories) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={['/checkout']}>
        <RepositoryProvider value={repos}>
          <LocationProvider>
            <PosAuthProvider>
              <ToastProvider>{children}</ToastProvider>
            </PosAuthProvider>
          </LocationProvider>
        </RepositoryProvider>
      </MemoryRouter>
    )
  }
  return renderHook(() => useCheckout(), { wrapper: Wrapper })
}

/** Monta el cobro con catálogo, caja y SESIÓN ya resueltos. */
async function mountLoaded(repos: Repositories) {
  const view = renderCheckout(repos)
  await waitFor(() => expect(view.result.current.loaded).toBe(true))
  // El viewer resuelve en un efecto y vuelve a disparar la carga del catálogo.
  await waitFor(() => expect(view.result.current.staffSale.buyerStaffUserId).toBe('staff-1'))
  await act(async () => {})
  return view
}

type Hook = { current: ReturnType<typeof useCheckout> }

async function enable(result: Hook, on = true) {
  await act(async () => {
    await result.current.setStaffSaleEnabled(on)
  })
}

describe('useCheckout · venta a staff', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  /* ── 1. Permisos y comprador (spec §4.5, §5) ── */

  it('sin permiso de venta a staff el modo no se ofrece ni se puede encender', async () => {
    const { repos, checkout } = makeRepos(
      withoutPermissions('pos.staff_sale.create', 'pos.staff_sale.create_for_others'),
    )
    const quota = vi.spyOn(checkout, 'getStaffSaleQuota')
    const { result } = await mountLoaded(repos)

    expect(result.current.staffSale.available).toBe(false)
    await enable(result)
    expect(result.current.staffSale.enabled).toBe(false)
    // Ni siquiera se le pregunta el cupo al API: el modo no existe para él.
    expect(quota).not.toHaveBeenCalled()
  })

  it('el comprador por default es el barbero de la sesión y el cupo se pide para él', async () => {
    const { repos, checkout } = makeRepos()
    const quota = vi.spyOn(checkout, 'getStaffSaleQuota')
    const { result } = await mountLoaded(repos)

    await enable(result)
    expect(result.current.staffSale.enabled).toBe(true)
    expect(result.current.staffSale.buyerStaffUserId).toBe('staff-1')
    expect(quota).toHaveBeenCalledWith('loc1', 'staff-1')
  })

  it('sin create_for_others elegir a otro comprador se ignora', async () => {
    const { repos, checkout } = makeRepos(withoutPermissions('pos.staff_sale.create_for_others'))
    const quota = vi.spyOn(checkout, 'getStaffSaleQuota')
    const { result } = await mountLoaded(repos)

    await enable(result)
    expect(result.current.staffSale.canSellForOthers).toBe(false)
    await act(async () => {
      await result.current.setStaffSaleBuyer('staff-2')
    })
    expect(result.current.staffSale.buyerStaffUserId).toBe('staff-1')
    // Y tampoco se pide el cupo del otro barbero (que el API le negaría).
    expect(quota).toHaveBeenCalledTimes(1)
  })

  it('con create_for_others el comprador cambia y su cupo se vuelve a pedir', async () => {
    const { repos, checkout } = makeRepos()
    const quota = vi.spyOn(checkout, 'getStaffSaleQuota')
    const { result } = await mountLoaded(repos)

    await enable(result)
    await act(async () => {
      await result.current.setStaffSaleBuyer('staff-2')
    })
    expect(result.current.staffSale.buyerStaffUserId).toBe('staff-2')
    expect(quota).toHaveBeenLastCalledWith('loc1', 'staff-2')
    expect(quota).toHaveBeenCalledTimes(2)
  })

  /* ── 2. Cupones y política (spec §4.3.1, §4.3.4, §4.3.5) ── */

  it('encender el modo quita los cupones y deshabilita el bloque', async () => {
    const { repos, checkout } = makeRepos()
    const applyCoupon = vi.fn().mockResolvedValue({
      validationError: null,
      appliedCoupons: [{ code: 'BBV10', name: '10%', scope: 'ALL', discountAmountCents: 2500, rule: null }],
    })
    checkout.applyCoupon = applyCoupon
    const { result } = await mountLoaded(repos)

    await act(async () => {
      await result.current.applyCoupon('BBV10')
    })
    expect(result.current.appliedCoupons).toHaveLength(1)

    await enable(result)
    expect(result.current.appliedCoupons).toHaveLength(0)
    expect(result.current.couponsDisabled).toBe(true)
    expect(result.current.couponsDisabledMessage).toBe('Una venta a staff no admite cupones')

    // Y aplicar otro ya no llega al API.
    await act(async () => {
      await result.current.applyCoupon('BBV20')
    })
    expect(result.current.couponError).toBe('Una venta a staff no admite cupones')
    expect(applyCoupon).toHaveBeenCalledTimes(1)
  })

  it('con la política apagada el modo no se puede encender', async () => {
    const { repos, checkout } = makeRepos()
    checkout.setStaffSaleQuota({ enabled: false })
    const { result } = await mountLoaded(repos)

    await enable(result)
    expect(result.current.staffSale.enabled).toBe(false)
    expect(result.current.staffSale.error).toBe('La venta a staff está desactivada.')
  })

  it('si el cupo se relee con la política apagada, el modo encendido ya no puede cobrar', async () => {
    const { repos, checkout } = makeRepos()
    const { result } = await mountLoaded(repos)
    await enable(result)

    act(() => {
      result.current.addCatalogItem(tile(CERA))
    })
    // Con la política encendida el ticket se puede cobrar.
    expect(result.current.staffSale.canCharge).toBe(true)
    expect(result.current.staffSale.blockMessage).toBeNull()

    // El admin apaga la venta a staff entre el encendido y el cobro: el cupo
    // del nuevo comprador ya llega deshabilitado.
    checkout.setStaffSaleQuota({ enabled: false })
    await act(async () => {
      await result.current.setStaffSaleBuyer('staff-2')
    })

    // El modo sigue encendido (nadie lo apagó), pero el cobro está bloqueado y
    // la barra explica por qué.
    expect(result.current.staffSale.enabled).toBe(true)
    expect(result.current.staffSale.quota?.enabled).toBe(false)
    expect(result.current.staffSale.canCharge).toBe(false)
    expect(result.current.staffSale.blockMessage).toBe('La venta a staff está desactivada.')

    await act(async () => {
      await result.current.submit(CASH)
    })
    // El cobro ni sale: el API lo rechazaría después de cobrar.
    expect(checkout.createSale).not.toHaveBeenCalled()
    expect(result.current.error).toBe('La venta a staff está desactivada.')
  })

  it('si el cupo releído sigue habilitado, el cobro no cambia', async () => {
    const { repos, checkout } = makeRepos()
    const { result } = await mountLoaded(repos)
    await enable(result)

    act(() => {
      result.current.addCatalogItem(tile(CERA))
    })
    await act(async () => {
      await result.current.setStaffSaleBuyer('staff-2')
    })

    expect(result.current.staffSale.quota?.enabled).toBe(true)
    expect(result.current.staffSale.canCharge).toBe(true)
    expect(result.current.staffSale.blockMessage).toBeNull()

    await act(async () => {
      await result.current.submit(CASH)
    })
    expect(checkout.createSale).toHaveBeenCalledTimes(1)
  })

  it('con servicios no admitidos en el ticket el servicio no entra', async () => {
    const { repos, checkout } = makeRepos()
    checkout.setStaffSaleQuota({ allowServicesInTicket: false })
    const { result } = await mountLoaded(repos)
    await enable(result)

    let outcome: AddCatalogItemResult | undefined
    act(() => {
      outcome = result.current.addCatalogItem(CORTE_TILE)
    })
    expect(outcome).toEqual({
      added: false,
      reason: 'SERVICES_NOT_ALLOWED',
      message: 'Una venta a staff no admite servicios ni combos en este ticket',
    })
    expect(result.current.cartState.lines).toHaveLength(0)
  })

  it('con servicios admitidos el servicio entra a precio normal y no descuenta', async () => {
    const { repos } = makeRepos()
    const { result } = await mountLoaded(repos)
    await enable(result)

    act(() => {
      result.current.addCatalogItem(CORTE_TILE)
    })
    expect(result.current.cartState.lines[0].unitPriceCents).toBe(35000)
    // El descuento staff sólo cuenta líneas de PRODUCTO (spec §4.3.4).
    expect(result.current.staffSale.summary?.discountCents).toBe(0)
  })

  /* ── 3. Precios staff por línea (spec §4.2, §4.3.3) ── */

  it('las líneas de producto pasan a precio staff y vuelven al público al apagar', async () => {
    const { repos } = makeRepos()
    const { result } = await mountLoaded(repos)

    act(() => {
      result.current.addCatalogItem(tile(CERA))
    })
    expect(result.current.cartState.lines[0].unitPriceCents).toBe(25000)

    await enable(result)
    expect(result.current.cartState.lines[0].unitPriceCents).toBe(12000)
    expect(result.current.staffSale.lines[0].listUnitPriceCents).toBe(25000)
    expect(result.current.staffSale.summary).toEqual({
      listTotalCents: 25000,
      staffTotalCents: 12000,
      discountCents: 13000,
    })

    await enable(result, false)
    expect(result.current.cartState.lines[0].unitPriceCents).toBe(25000)
    expect(result.current.staffSale.enabled).toBe(false)
    expect(result.current.staffSale.lines).toHaveLength(0)
  })

  it('un producto no elegible no entra al ticket y devuelve el motivo', async () => {
    const { repos } = makeRepos()
    const { result } = await mountLoaded(repos)
    await enable(result)

    let outcome: AddCatalogItemResult | undefined
    act(() => {
      outcome = result.current.addCatalogItem(tile(POMADA))
    })
    expect(outcome).toEqual({
      added: false,
      reason: 'NOT_ELIGIBLE',
      message: 'Este producto no está disponible para venta a staff',
    })
    expect(result.current.cartState.lines).toHaveLength(0)
  })

  it('un producto con presentaciones exige elegir una para entrar', async () => {
    const { repos } = makeRepos()
    const { result } = await mountLoaded(repos)
    await enable(result)

    let outcome: AddCatalogItemResult | undefined
    act(() => {
      outcome = result.current.addCatalogItem(tile(SPRAY))
    })
    expect(outcome).toEqual({
      added: false,
      reason: 'NEEDS_VARIANT',
      // INTERINO (T-050): sin selector de presentación, el aviso manda a cobrar
      // fuera del modo staff. Vuelve a "Elige la presentación" con T-033.
      message: 'Aún no hay selector de presentación — cóbralo fuera del modo staff',
    })
    expect(result.current.cartState.lines).toHaveLength(0)

    act(() => {
      result.current.addCatalogItem(tile(SPRAY, 'var-grande'))
    })
    // Precio staff Y precio público de ESA presentación, no los del producto.
    expect(result.current.cartState.lines[0].unitPriceCents).toBe(15000)
    expect(result.current.staffSale.lines[0]).toMatchObject({
      productVariantId: 'var-grande',
      listUnitPriceCents: 30000,
      blockReason: null,
    })
    expect(result.current.staffSale.canCharge).toBe(true)
  })

  it('una línea ya capturada sin presentación bloquea el cobro hasta elegirla', async () => {
    const { repos } = makeRepos()
    const { result } = await mountLoaded(repos)

    // Capturada en venta normal y después se enciende el modo.
    act(() => {
      result.current.addCatalogItem(tile(SPRAY))
    })
    await enable(result)

    expect(result.current.staffSale.canCharge).toBe(false)
    expect(result.current.staffSale.blockMessage).toBe('Aún no hay selector de presentación — cóbralo fuera del modo staff')
    // Sin presentación no se inventa un precio staff ([D-042]).
    expect(result.current.cartState.lines[0].unitPriceCents).toBe(18000)
    expect(result.current.staffSale.lines[0].listUnitPriceCents).toBeNull()

    const lineId = result.current.cartState.lines[0].id
    act(() => {
      result.current.setStaffSaleLineVariant(lineId, 'var-chico')
    })
    expect(result.current.cartState.lines[0].unitPriceCents).toBe(9000)
    expect(result.current.staffSale.lines[0].listUnitPriceCents).toBe(18000)
    expect(result.current.staffSale.canCharge).toBe(true)
  })

  /* ── 4. Cupo del mes (spec §4.3.6) ── */

  it('el tope del mes bloquea el cobro con el mensaje del cupo', async () => {
    const { repos, checkout } = makeRepos()
    checkout.setStaffSaleQuota({ unitsUsed: 5, unitsLimit: 6, unitsRemaining: 1 })
    const { result } = await mountLoaded(repos)
    await enable(result)

    act(() => {
      result.current.addCatalogItem(tile(CERA))
      result.current.addCatalogItem(tile(CERA))
    })
    expect(result.current.staffSale.quotaView?.units.remaining).toBe(-1)
    expect(result.current.staffSale.canCharge).toBe(false)
    expect(result.current.staffSale.blockMessage).toBe('Llevas 7 de 6 productos este mes')

    await act(async () => {
      await result.current.submit(CASH)
    })
    // El cobro ni sale: el API lo rechazaría después de cobrar.
    expect(checkout.createSale).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Llevas 7 de 6 productos este mes')
  })

  /* ── 5. Cobro (spec §4.3) ── */

  it('el cobro manda el comprador y la presentación de cada línea', async () => {
    const { repos, checkout } = makeRepos()
    const { result } = await mountLoaded(repos)
    await enable(result)

    act(() => {
      result.current.addCatalogItem(tile(SPRAY, 'var-chico'))
    })
    await act(async () => {
      await result.current.submit(CASH)
    })

    const createSale = vi.mocked(checkout.createSale)
    expect(createSale).toHaveBeenCalledTimes(1)
    const input = createSale.mock.calls[0][0]
    expect(input.staffSale).toEqual({ buyerStaffUserId: 'staff-1' })
    expect(input.items).toEqual([
      expect.objectContaining({
        productId: 'prod-spray',
        productVariantId: 'var-chico',
        unitPriceCents: 9000,
      }),
    ])
    expect(input.appliedCouponCodes).toEqual([])
  })

  it('tras cobrar una venta a staff el modo se apaga y el cupo se invalida', async () => {
    const { repos, checkout } = makeRepos()
    const quota = vi.spyOn(checkout, 'getStaffSaleQuota')
    const { result } = await mountLoaded(repos)
    await enable(result)

    act(() => {
      result.current.addCatalogItem(tile(CERA))
    })
    await act(async () => {
      await result.current.submit(CASH)
    })

    expect(result.current.successSale).not.toBeNull()
    expect(result.current.staffSale.enabled).toBe(false)
    expect(result.current.staffSale.quota).toBeNull()

    // Volver a encenderlo lo vuelve a pedir a la red: esa compra ya consumió cupo.
    await enable(result)
    expect(quota).toHaveBeenCalledTimes(2)
  })

  /* ── 6. Re-precio tras un rechazo del API ([D-036], spec frescura §3.5) ── */

  it('re-preciar tras un rechazo conserva el precio staff de la variante', async () => {
    const { repos, checkout } = makeRepos()
    let catalog = CATALOG
    checkout.getProducts = vi.fn(async () => catalog)
    checkout.createSale = vi
      .fn()
      .mockRejectedValue(new CheckoutRejectedError('PRICE_MISMATCH', 'El precio cambió.'))
    const { result } = await mountLoaded(repos)
    await enable(result)

    act(() => {
      result.current.addCatalogItem(tile(SPRAY, 'var-chico'))
    })
    expect(result.current.cartState.lines[0].unitPriceCents).toBe(9000)

    // El admin sube ambos precios de la presentación chica mientras el carrito
    // está armado: el cobro se rechaza y el POS se pone al día.
    catalog = [
      CERA,
      {
        ...SPRAY,
        variants: [
          { id: 'var-chico', priceCents: 20000, staffPriceCents: 10000 },
          { id: 'var-grande', priceCents: 30000, staffPriceCents: 15000 },
        ],
      },
      POMADA,
    ]
    await act(async () => {
      await result.current.submit(CASH)
    })

    expect(result.current.rejectionNotice?.code).toBe('PRICE_MISMATCH')
    // Precio staff de SU variante, nunca el público (que sería cobrarle el
    // doble al barbero) ni el del producto.
    expect(result.current.cartState.lines[0].unitPriceCents).toBe(10000)
    expect(result.current.staffSale.lines[0]).toMatchObject({
      productVariantId: 'var-chico',
      listUnitPriceCents: 20000,
      blockReason: null,
    })
    expect(result.current.staffSale.canCharge).toBe(true)
  })

  /* ── 7. Vista del GRID: qué pinta cada card del catálogo (spec §4.5) ── */

  it('con el modo apagado el grid no recibe ninguna vista staff', async () => {
    const { repos } = makeRepos()
    const { result } = await mountLoaded(repos)

    // El catálogo SÍ está cargado (la línea entra a precio público): el mapa
    // está vacío porque no hay modo que pintar, no porque falten productos.
    act(() => {
      result.current.addCatalogItem(tile(CERA))
    })
    expect(result.current.cartState.lines[0].unitPriceCents).toBe(25000)
    expect(result.current.staffSale.catalogViews.size).toBe(0)
  })

  it('encendido, un producto elegible trae su precio staff y su precio público', async () => {
    const { repos } = makeRepos()
    const { result } = await mountLoaded(repos)
    await enable(result)

    // Una vista por producto del catálogo, aunque el carrito esté vacío: el
    // grid se pinta antes de tocar nada.
    expect(result.current.staffSale.catalogViews.size).toBe(3)
    expect(result.current.staffSale.catalogViews.get('prod-cera')).toEqual({
      eligible: true,
      reason: null,
      unitPriceCents: 12000,
      listUnitPriceCents: 25000,
      message: null,
    })
  })

  it('los no elegibles vienen marcados con su motivo y sin precio staff', async () => {
    const { repos } = makeRepos()
    const { result } = await mountLoaded(repos)
    await enable(result)

    // El admin lo sacó de la venta a staff.
    expect(result.current.staffSale.catalogViews.get('prod-pomada')).toEqual({
      eligible: false,
      reason: 'NOT_ELIGIBLE',
      unitPriceCents: null,
      listUnitPriceCents: 20000,
      message: 'Este producto no está disponible para venta a staff',
    })
    // Presentaciones con precio staff distinto: hasta que el operador elija
    // una no hay precio que pintar ([D-042]), así que la card no es elegible.
    expect(result.current.staffSale.catalogViews.get('prod-spray')).toEqual({
      eligible: false,
      reason: 'NEEDS_VARIANT',
      unitPriceCents: null,
      listUnitPriceCents: 18000,
      message: 'Aún no hay selector de presentación — cóbralo fuera del modo staff',
    })

    await enable(result, false)
    expect(result.current.staffSale.catalogViews.size).toBe(0)
  })
})
