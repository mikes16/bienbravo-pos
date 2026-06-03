import { describe, it, expect } from 'vitest'
import {
  computeCouponDiscount,
  recomputeAppliedCoupons,
  cartLinesToDiscountItems,
  type DiscountItem,
} from './coupon-compute'
import type { AppliedCouponPreview, AppliedCouponRule } from '../data/checkout.repository'
import type { CartLine } from './cart'

// Factories cortas para que cada test sea legible.

function rule(overrides: Partial<AppliedCouponRule> = {}): AppliedCouponRule {
  return {
    type: 'PERCENT',
    discountBps: 1000, // 10%
    discountAmountCents: null,
    stackable: false,
    targetServiceIds: [],
    targetProductIds: [],
    targetCategoryIds: [],
    ...overrides,
  }
}

function preview(
  code: string,
  scope: string,
  r: AppliedCouponRule,
  discountAmountCents = 0,
): AppliedCouponPreview {
  return { code, name: code, scope, discountAmountCents, rule: r }
}

function svc(id: string, totalCents: number, categoryId: string | null = null): DiscountItem {
  return { serviceId: id, productId: null, categoryId, totalCents }
}

function prod(id: string, totalCents: number, categoryId: string | null = null): DiscountItem {
  return { serviceId: null, productId: id, categoryId, totalCents }
}

describe('computeCouponDiscount', () => {
  it('PERCENT scope CART aplica al subtotal completo', () => {
    const coupon = preview('TEST', 'CART', rule({ discountBps: 1000 }))
    const items = [svc('s1', 100_00), prod('p1', 50_00)]
    expect(computeCouponDiscount(coupon, items)).toBe(15_00) // 10% de 150
  })

  it('AMOUNT scope CART aplica monto fijo', () => {
    const coupon = preview(
      'TEST',
      'CART',
      rule({ type: 'AMOUNT', discountBps: null, discountAmountCents: 25_00 }),
    )
    expect(computeCouponDiscount(coupon, [svc('s1', 100_00)])).toBe(25_00)
  })

  it('AMOUNT capea al subtotal cuando excede', () => {
    const coupon = preview(
      'TEST',
      'CART',
      rule({ type: 'AMOUNT', discountBps: null, discountAmountCents: 200_00 }),
    )
    expect(computeCouponDiscount(coupon, [svc('s1', 50_00)])).toBe(50_00)
  })

  it('scope SERVICE solo descuenta servicios target', () => {
    const coupon = preview(
      'CORTE10',
      'SERVICE',
      rule({ discountBps: 1000, targetServiceIds: ['s-corte'] }),
    )
    const items = [svc('s-corte', 200_00), svc('s-barba', 100_00), prod('p1', 50_00)]
    expect(computeCouponDiscount(coupon, items)).toBe(20_00) // 10% de 200 (solo corte)
  })

  it('scope PRODUCT solo descuenta productos target', () => {
    const coupon = preview(
      'POMADA',
      'PRODUCT',
      rule({ discountBps: 1500, targetProductIds: ['p-pomada'] }),
    )
    const items = [svc('s1', 200_00), prod('p-pomada', 100_00), prod('p-otro', 80_00)]
    expect(computeCouponDiscount(coupon, items)).toBe(15_00) // 15% de 100
  })

  it('scope CATEGORY mira categoryId del item', () => {
    const coupon = preview(
      'BARBA20',
      'CATEGORY',
      rule({ discountBps: 2000, targetCategoryIds: ['cat-barba'] }),
    )
    const items = [
      svc('s1', 100_00, 'cat-barba'),
      svc('s2', 50_00, 'cat-corte'),
      prod('p1', 30_00, 'cat-barba'),
    ]
    expect(computeCouponDiscount(coupon, items)).toBe(26_00) // 20% de 130 (s1 + p1)
  })

  it('devuelve 0 si ningún item entra en scope', () => {
    const coupon = preview(
      'NADA',
      'SERVICE',
      rule({ discountBps: 1000, targetServiceIds: ['s-nope'] }),
    )
    expect(computeCouponDiscount(coupon, [svc('s1', 100_00)])).toBe(0)
  })

  it('floor (no round) en PERCENT — match al Math.floor del backend', () => {
    const coupon = preview('TEST', 'CART', rule({ discountBps: 1234 })) // 12.34%
    const items = [svc('s1', 99_99)] // base = 9999 cents
    // 9999 * 1234 = 12,338,766 → /10000 = 1233.8766 → floor 1233
    expect(computeCouponDiscount(coupon, items)).toBe(1233)
  })
})

describe('recomputeAppliedCoupons', () => {
  it('actualiza el monto descontado cuando cambian los items', () => {
    const c = preview('PERCENT10', 'CART', rule({ discountBps: 1000 }), 10_00)
    const newItems = [svc('s1', 200_00)] // antes 100, ahora 200
    const result = recomputeAppliedCoupons([c], newItems)
    expect(result.appliedCoupons).toHaveLength(1)
    expect(result.appliedCoupons[0].discountAmountCents).toBe(20_00)
    expect(result.droppedCodes).toEqual([])
    expect(result.subtotalCents).toBe(200_00)
    expect(result.totalDiscountCents).toBe(20_00)
  })

  it('dropea cupones cuyo scope ya no aplica', () => {
    const c = preview(
      'CORTE',
      'SERVICE',
      rule({ discountBps: 1000, targetServiceIds: ['s-corte'] }),
      10_00,
    )
    // Carrito sin el servicio target
    const result = recomputeAppliedCoupons([c], [svc('s-otro', 100_00)])
    expect(result.appliedCoupons).toEqual([])
    expect(result.droppedCodes).toEqual(['CORTE'])
  })

  it('capea total al subtotal cuando dos cupones suman más', () => {
    const c1 = preview(
      'AMT100',
      'CART',
      rule({ type: 'AMOUNT', discountBps: null, discountAmountCents: 100_00, stackable: true }),
    )
    const c2 = preview(
      'AMT80',
      'CART',
      rule({ type: 'AMOUNT', discountBps: null, discountAmountCents: 80_00, stackable: true }),
    )
    const items = [svc('s1', 120_00)]
    const result = recomputeAppliedCoupons([c1, c2], items)
    // Cada cupón cap individual al subtotal 120, suman 200, capeado a 120
    expect(result.totalDiscountCents).toBe(120_00)
  })

  it('preserva orden de cupones aplicados', () => {
    const c1 = preview('FIRST', 'CART', rule({ discountBps: 500 }))
    const c2 = preview('SECOND', 'CART', rule({ discountBps: 500 }))
    const items = [svc('s1', 100_00)]
    const result = recomputeAppliedCoupons([c1, c2], items)
    expect(result.appliedCoupons.map((c) => c.code)).toEqual(['FIRST', 'SECOND'])
  })
})

describe('cartLinesToDiscountItems', () => {
  it('mapea services y products, excluye combos', () => {
    const lines: CartLine[] = [
      { id: '1', kind: 'service', itemId: 's1', name: 'Corte', qty: 1, unitPriceCents: 200_00, staffUserId: null, categoryId: 'cat-1' },
      { id: '2', kind: 'product', itemId: 'p1', name: 'Pomada', qty: 2, unitPriceCents: 50_00, staffUserId: null, categoryId: 'cat-2' },
      { id: '3', kind: 'combo', itemId: 'c1', name: 'Combo', qty: 1, unitPriceCents: 300_00, staffUserId: null },
    ]
    const items = cartLinesToDiscountItems(lines)
    expect(items).toHaveLength(2)
    expect(items[0]).toEqual({ serviceId: 's1', productId: null, categoryId: 'cat-1', totalCents: 200_00 })
    expect(items[1]).toEqual({ serviceId: null, productId: 'p1', categoryId: 'cat-2', totalCents: 100_00 })
  })

  it('multiplica unitPrice × qty para totalCents', () => {
    const lines: CartLine[] = [
      { id: '1', kind: 'service', itemId: 's1', name: 'X', qty: 3, unitPriceCents: 25_00, staffUserId: null },
    ]
    expect(cartLinesToDiscountItems(lines)[0].totalCents).toBe(75_00)
  })
})
