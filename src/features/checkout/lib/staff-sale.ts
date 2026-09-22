// Reglas de PRESENTACIÓN del modo "venta a staff" en el carrito (spec
// `docs/superpowers/specs/2026-09-18-venta-a-staff-design.md` §4.2, §4.3, §4.5).
//
// Este módulo NO decide nada: la autoridad es el API. El precio staff ya viene
// resuelto (`staffPriceResolvedCents`), la elegibilidad la marca el admin y los
// topes los vuelve a medir `createPOSSale` dentro de su transacción. Aquí solo
// se calcula QUÉ PINTAR y QUÉ AVISAR antes de cobrar, para que el operador no
// se entere del rechazo después de haber cobrado.
//
// Funciones puras, sin dependencias de UI ni de red (ni componentes ni cliente
// de datos): se prueban sin montar nada. Todo el dinero es entero en centavos;
// ninguna operación introduce flotantes.

import type { CartLineKind } from './cart'
import type { CatalogProduct, CatalogProductVariant, StaffSaleQuota } from '../domain/checkout.types'

/* ── Textos (es-MX) ── */

/** Por qué una línea no se puede vender a staff tal como está. */
export type StaffLineBlockReason = 'NOT_ELIGIBLE' | 'NEEDS_VARIANT'

/**
 * Mensajes listos para pintar. Son los del POS (aviso ANTES de cobrar); el
 * texto de un rechazo real llega del API y se muestra tal cual.
 */
export const STAFF_SALE_MESSAGES = {
  NOT_ELIGIBLE: 'Este producto no está disponible para venta a staff',
  NEEDS_VARIANT: 'Elige la presentación',
} as const satisfies Record<StaffLineBlockReason, string>

/* ── 1. Vista de una línea de producto en modo staff ── */

export interface StaffLineView {
  /** true = se puede agregar al carrito en modo staff con `unitPriceCents`. */
  eligible: boolean
  /** Ausente cuando `eligible`. Llave de `STAFF_SALE_MESSAGES`. */
  reason?: StaffLineBlockReason
  /**
   * Precio staff a cobrar. `null` cuando no hay precio que mostrar (no
   * elegible, o falta elegir presentación): **nunca 0**, que sería regalar el
   * producto por falta de dato.
   */
  unitPriceCents: number | null
  /** Precio público (el tachado). Es lo que consume el tope de monto. */
  listUnitPriceCents: number
}

/**
 * ¿La línea DEBE traer `productVariantId`? Sí cuando el producto tiene más de
 * una variante y éstas no son intercambiables para la venta a staff: difieren
 * en precio staff (el API rechaza pidiendo elegir, §4.2) o en precio público
 * (elegir mal falsearía el tope de monto y el descuento del reporte).
 *
 * Con una sola variante —o con todas iguales— no hay nada que preguntar.
 */
export function needsVariant(product: CatalogProduct): boolean {
  const variants = product.variants
  if (variants.length <= 1) return false
  const first = variants[0]
  return variants.some(
    (v) => v.staffPriceCents !== first.staffPriceCents || v.priceCents !== first.priceCents,
  )
}

function findVariant(
  product: CatalogProduct,
  variantId: string | null,
): CatalogProductVariant | null {
  if (variantId === null) return null
  return product.variants.find((v) => v.id === variantId) ?? null
}

/**
 * Cómo se pinta un producto del catálogo con el interruptor de venta a staff
 * encendido. `variantId` = la presentación elegida por el operador (`null` =
 * ninguna todavía; un id desconocido cuenta igual que ninguna).
 *
 * El precio staff sale de la variante elegida y, si no hay, del producto — el
 * API ya aplicó la precedencia variante > producto > costo en ambos niveles.
 * El precio público sale de la variante elegida; sin variante se usa el del
 * producto, que el repositorio llena con el de la primera variante.
 */
export function staffLineView(product: CatalogProduct, variantId: string | null = null): StaffLineView {
  const variant = findVariant(product, variantId)
  const listUnitPriceCents = variant ? variant.priceCents : product.priceCents

  if (!product.staffSaleEligible) {
    return { eligible: false, reason: 'NOT_ELIGIBLE', unitPriceCents: null, listUnitPriceCents }
  }
  if (variant === null && needsVariant(product)) {
    // Sin presentación elegida el precio es indeterminado: no se pinta ninguno.
    return { eligible: false, reason: 'NEEDS_VARIANT', unitPriceCents: null, listUnitPriceCents }
  }

  const staffPriceCents = variant?.staffPriceCents ?? product.staffPriceCents
  if (staffPriceCents === null) {
    // Sin precio staff capturado en ningún nivel: no vendible a staff (§4.2).
    return { eligible: false, reason: 'NOT_ELIGIBLE', unitPriceCents: null, listUnitPriceCents }
  }
  return { eligible: true, unitPriceCents: staffPriceCents, listUnitPriceCents }
}

/** Mensaje a pintar bajo la línea, o `null` si no hay nada que avisar. */
export function staffLineMessage(view: StaffLineView): string | null {
  return view.reason === undefined ? null : STAFF_SALE_MESSAGES[view.reason]
}

/* ── 2. Resumen del carrito ── */

/**
 * Lo que el resumen necesita de una línea del carrito. Un `CartLine` con
 * `listUnitPriceCents` encaja estructuralmente.
 *
 * `listUnitPriceCents` es la marca de "esta línea va en modo staff", igual que
 * en el API (`SaleItem.listUnitPriceCents` solo se llena en venta a staff,
 * §4.1). Ausente o `null` = línea normal y no entra a ningún cálculo de aquí.
 */
export interface StaffSummaryLine {
  kind: CartLineKind
  itemId: string
  qty: number
  unitPriceCents: number
  listUnitPriceCents?: number | null
}

interface StaffProductLine extends StaffSummaryLine {
  listUnitPriceCents: number
}

/** Servicios, combos y líneas normales quedan fuera: solo producto + staff. */
function staffProductLines(lines: readonly StaffSummaryLine[]): StaffProductLine[] {
  return lines.filter(
    (l): l is StaffProductLine => l.kind === 'product' && l.listUnitPriceCents != null,
  )
}

export interface StaffCartSummary {
  /** Valor a precio público de lo que sale del inventario. */
  listTotalCents: number
  /** Lo que se le cobra al barbero por esas mismas líneas. */
  staffTotalCents: number
  /** La diferencia, que el reporte cuenta como "Descuento staff" (§4.4). */
  discountCents: number
}

/**
 * Totales del descuento staff. Servicios y combos del mismo ticket se cobran a
 * precio normal (§4.3.4) y la propina no es una línea: ninguno entra aquí.
 */
export function staffCartSummary(lines: readonly StaffSummaryLine[]): StaffCartSummary {
  let listTotalCents = 0
  let staffTotalCents = 0
  for (const line of staffProductLines(lines)) {
    listTotalCents += line.listUnitPriceCents * line.qty
    staffTotalCents += line.unitPriceCents * line.qty
  }
  return {
    listTotalCents,
    staffTotalCents,
    // Un precio staff por encima del público no es un recargo: es 0 descuento.
    discountCents: Math.max(listTotalCents - staffTotalCents, 0),
  }
}

/* ── 3. Cupo del mes ── */

export interface QuotaTopeView {
  /** Consumido este mes ANTES del carrito, tal como lo reporta el API. */
  used: number
  /** Lo que sumaría el carrito actual si se cobrara. */
  inCart: number
  /** Tope del mes; `null` = sin tope. */
  limit: number | null
  /**
   * Restante DESPUÉS de cobrar el carrito. `null` = sin tope. Negativo = por
   * cuánto se pasa (no se recorta a 0: la UI necesita el excedente).
   */
  remaining: number | null
  /** Sin tope nunca es `true`. */
  exceeded: boolean
}

export interface QuotaProductTopeView extends QuotaTopeView {
  productId: string
}

export interface StaffQuotaView {
  units: QuotaTopeView
  /** Medido a precio PÚBLICO: refleja cuánto inventario salió (§4.3.6). */
  listAmountCents: QuotaTopeView
  /** Un renglón por producto del carrito, en orden de aparición. */
  perProduct: QuotaProductTopeView[]
  /** Cualquier tope rebasado. La UI deshabilita Cobrar; el API revalida. */
  exceeded: boolean
}

function topeView(
  used: number,
  limit: number | null,
  remainingFromApi: number | null,
  inCart: number,
): QuotaTopeView {
  if (limit === null) return { used, inCart, limit: null, remaining: null, exceeded: false }
  const remaining = (remainingFromApi ?? limit - used) - inCart
  return { used, inCart, limit, remaining, exceeded: remaining < 0 }
}

/**
 * Cupo del comprador contrastado contra el carrito, para avisar ANTES de
 * cobrar. El cupo lo mide el API (`staffSaleQuota`) y `createPOSSale` lo vuelve
 * a medir al cerrar: esto es display, no una segunda fuente de verdad.
 *
 * Un tope en `null` es "sin tope", jamás cero.
 */
export function quotaView(
  quota: StaffSaleQuota,
  cartLines: readonly StaffSummaryLine[],
): StaffQuotaView {
  const productLines = staffProductLines(cartLines)

  let unitsInCart = 0
  let listAmountInCart = 0
  const unitsInCartByProduct = new Map<string, number>()
  for (const line of productLines) {
    unitsInCart += line.qty
    listAmountInCart += line.listUnitPriceCents * line.qty
    unitsInCartByProduct.set(line.itemId, (unitsInCartByProduct.get(line.itemId) ?? 0) + line.qty)
  }

  const usedByProduct = new Map(quota.unitsByProduct.map((u) => [u.productId, u.units]))
  const perProduct: QuotaProductTopeView[] = [...unitsInCartByProduct].map(([productId, inCart]) => ({
    productId,
    // El API no manda restante por producto: se deriva del tope y lo usado.
    ...topeView(usedByProduct.get(productId) ?? 0, quota.perProductLimit, null, inCart),
  }))

  const units = topeView(quota.unitsUsed, quota.unitsLimit, quota.unitsRemaining, unitsInCart)
  const listAmountCents = topeView(
    quota.listAmountCentsUsed,
    quota.listAmountCentsLimit,
    quota.listAmountCentsRemaining,
    listAmountInCart,
  )
  return {
    units,
    listAmountCents,
    perProduct,
    exceeded: units.exceeded || listAmountCents.exceeded || perProduct.some((p) => p.exceeded),
  }
}

/**
 * "Llevas 5 de 6 productos este mes" — cuenta lo del mes MÁS lo del carrito,
 * que es lo que quedaría al cobrar (con el carrito vacío coincide con lo que
 * reporta el API). `null` cuando no hay tope de unidades: nada que contar.
 */
export function unitsQuotaMessage(units: QuotaTopeView): string | null {
  if (units.limit === null) return null
  return `Llevas ${units.used + units.inCart} de ${units.limit} productos este mes`
}
