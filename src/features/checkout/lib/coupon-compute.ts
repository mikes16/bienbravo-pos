// Compute local del descuento por cupón. Debe quedar idéntico a
// bienbravo-api/src/modules/coupons/coupons.service.ts:calculateDiscount
// para que el preview en el POS coincida con lo que el backend va a aplicar
// al cerrar la venta. Hay un test de paridad en coupon-compute.test.ts.
//
// El backend SIGUE siendo source of truth — recomputa en `submit` y rechaza
// si el cliente intentó pasarse. Esta función existe solo para evitar el
// round trip mientras el carrito está vivo.

import type { AppliedCouponPreview, AppliedCouponRule } from '../data/checkout.repository'
import type { CartLine } from './cart'

/**
 * Item del carrito en el shape que el compute necesita. Solo los campos
 * que afectan la math: identidad para scope match, categoría y total bruto.
 */
export interface DiscountItem {
  serviceId: string | null
  productId: string | null
  categoryId: string | null
  totalCents: number
}

/** Mapea CartLine al shape de compute. Combos no entran (no participan
 *  en cupones según la regla actual del backend). */
export function cartLinesToDiscountItems(lines: CartLine[]): DiscountItem[] {
  return lines
    .filter((l) => l.kind === 'service' || l.kind === 'product')
    .map((l) => ({
      serviceId: l.kind === 'service' ? l.itemId : null,
      productId: l.kind === 'product' ? l.itemId : null,
      categoryId: l.categoryId ?? null,
      totalCents: l.unitPriceCents * l.qty,
    }))
}

/** Filtra los items que matchean el scope del cupón. Mismo orden de checks
 *  que el backend (CART > SERVICE > PRODUCT > CATEGORY). */
function filterByScope(
  scope: string,
  rule: AppliedCouponRule,
  items: DiscountItem[],
): DiscountItem[] {
  if (scope === 'CART') return items
  if (scope === 'SERVICE') {
    const targets = new Set(rule.targetServiceIds)
    return items.filter((it) => it.serviceId != null && targets.has(it.serviceId))
  }
  if (scope === 'PRODUCT') {
    const targets = new Set(rule.targetProductIds)
    return items.filter((it) => it.productId != null && targets.has(it.productId))
  }
  if (scope === 'CATEGORY') {
    const targets = new Set(rule.targetCategoryIds)
    return items.filter((it) => it.categoryId != null && targets.has(it.categoryId))
  }
  return []
}

/**
 * Calcula el descuento en cents para UN cupón contra los items dados.
 * Mirror exacto de coupons.service.ts:calculateDiscount. Devuelve 0 si
 * ningún item entra en scope o el descuento computado es ≤ 0.
 */
export function computeCouponDiscount(
  coupon: { scope: string; rule: AppliedCouponRule },
  items: DiscountItem[],
): number {
  const scopeItems = filterByScope(coupon.scope, coupon.rule, items)
  if (scopeItems.length === 0) return 0
  const base = scopeItems.reduce((s, it) => s + it.totalCents, 0)
  if (base <= 0) return 0
  const raw =
    coupon.rule.type === 'PERCENT'
      ? Math.floor((base * (coupon.rule.discountBps ?? 0)) / 10000)
      : (coupon.rule.discountAmountCents ?? 0)
  return Math.min(raw, base)
}

/**
 * Recompute todos los cupones aplicados contra el carrito nuevo.
 * - Mantiene el orden original (estable para el UI)
 * - Drop in-place los cupones cuyo descuento queda en 0 (no aplican al
 *   carrito actual) — el caller decide si avisar o reaplicar después
 * - Devuelve el subtotal cap aplicado al total agregado de descuentos
 */
export interface RecomputeResult {
  appliedCoupons: AppliedCouponPreview[]
  droppedCodes: string[]
  totalDiscountCents: number
  subtotalCents: number
}

export function recomputeAppliedCoupons(
  coupons: AppliedCouponPreview[],
  items: DiscountItem[],
): RecomputeResult {
  const subtotalCents = items.reduce((s, it) => s + it.totalCents, 0)
  const updated: AppliedCouponPreview[] = []
  const droppedCodes: string[] = []
  for (const c of coupons) {
    const amount = computeCouponDiscount(c, items)
    if (amount <= 0) {
      droppedCodes.push(c.code)
      continue
    }
    updated.push({ ...c, discountAmountCents: amount })
  }
  const rawDiscount = updated.reduce((s, c) => s + c.discountAmountCents, 0)
  const totalDiscountCents = Math.min(rawDiscount, subtotalCents)
  return { appliedCoupons: updated, droppedCodes, totalDiscountCents, subtotalCents }
}
