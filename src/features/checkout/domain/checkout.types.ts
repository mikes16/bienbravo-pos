/* ── Catalog items (services + products the POS can sell) ── */

export interface CatalogCategory {
  id: string
  name: string
  slug: string
  sortOrder: number
  appliesTo: string
}

export interface ResolvedExtra {
  serviceId: string
  name: string
  priceCents: number
  durationMin: number
}

export interface CatalogService {
  id: string
  name: string
  // Resolved para (locationId, staffUserId actual). Respeta override por sucursal
  // y excepciones de staff (caso Javi). Los extras NO están sumados aquí — se
  // muestran como line items separados al agregar al carrito.
  priceCents: number
  durationMin: number
  isAddOn: boolean
  imageUrl: string | null
  categoryId: string | null
  sortOrder: number
  extras: ResolvedExtra[]
  // IDs de barberos que NO realizan este servicio (StaffServicePrice.isExcluded).
  // Se lee del catálogo STATIC para ocultarlos proactivamente del picker de la
  // línea. Vacío = todos los barberos pueden realizar el servicio.
  excludedStaffIds: string[]
}

export interface CatalogProduct {
  id: string
  name: string
  sku: string | null
  priceCents: number
  imageUrl: string | null
  categoryId: string | null
  sortOrder: number
}

export interface CatalogComboItem {
  serviceId: string | null
  productId: string | null
  serviceName: string | null
  productName: string | null
  qty: number
}

export interface CatalogCombo {
  id: string
  name: string
  // Precio BASE estático del combo. El precio REAL a mostrar/cobrar se resuelve
  // por (locationId, staffUserId) vía el overlay de combos (getComboPricing) y
  // la ruta única de precio de línea (resolveComboPriceForBarber): barbero >
  // sucursal > base. Nunca mandes este base a la venta si hay overlay/resuelto.
  priceCents: number
  imageUrl: string | null
  effectiveCategoryIds: string[]
  categoryId: string | null
  sortOrder: number
  items: CatalogComboItem[]
  // IDs de barberos que NO ofrecen este combo (StaffComboPrice.isExcluded). Se
  // lee del catálogo STATIC para ocultarlo proactivamente del grid/búsqueda y
  // del picker de la línea. Vacío = todos los barberos pueden ofrecer el combo.
  excludedStaffIds: string[]
}

export interface StockLevel {
  productId: string
  quantity: number
}

export type CatalogItem =
  | { kind: 'service'; item: CatalogService }
  | { kind: 'product'; item: CatalogProduct }
  | { kind: 'combo'; item: CatalogCombo }

/* ── Cart ── */

export interface CartLine {
  id: string
  catalogItem: CatalogItem
  qty: number
  unitPriceCents: number
}

export interface Cart {
  lines: CartLine[]
  tipCents: number
}

/* ── Sale / Payment ── */

// Mantiene la lista de métodos UI-friendly. Mapea 1:1 a PaymentProvider
// del API (CASH, CARD_TERMINAL, TRANSFER) — la conversión vive en el
// repository.
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER'

/** Un componente del array de pagos enviado al API. */
export interface CheckoutPayment {
  /** Provider del API (PaymentProvider enum). 'CARD' del UI → 'CARD_TERMINAL'. */
  provider: 'CASH' | 'CARD_TERMINAL' | 'TRANSFER'
  amountCents: number
}

export interface CreateSaleInput {
  locationId: string
  registerSessionId: string | null
  customerId: string | null
  staffUserId: string | null
  completeWalkInId?: string | null
  completeAppointmentId?: string | null
  items: SaleItemInput[]
  tipCents: number
  /** Pagos que cubren items + tax + tip. La suma debe igualar el total. */
  payments: CheckoutPayment[]
  /**
   * Códigos de cupones aplicados al draft (preview vía applyCouponToDraftSale)
   * que el API debe persistir al crear el Sale. El API recalcula descuentos
   * server-side — el cliente solo manda los códigos, nunca los montos.
   */
  appliedCouponCodes?: string[]
}

export interface SaleItemInput {
  serviceId: string | null
  productId: string | null
  catalogComboId: string | null
  qty: number
  unitPriceCents: number
  /**
   * Barber attributed to this specific line. Required for commission math:
   * the dashboard reads commissions from DailyStaffMetrics which is
   * populated per (staffUserId, locationId, date). Without this, every
   * SaleItem lands with staffUserId=null and commissions stay $0 even
   * though sales are recorded.
   */
  staffUserId: string | null
}

/**
 * Entrada para `addItemsToAppointmentSale`: extras cobrados SOBRE una cita ya
 * prepagada. `items` son las líneas nuevas (mismo shape que createPOSSale),
 * `payments` cubren EXACTAMENTE el delta (bruto de extras + propina), NO el
 * total de la venta. `saleId` es la venta prepagada objetivo.
 */
export interface AddItemsToAppointmentSaleInput {
  saleId: string
  items: SaleItemInput[]
  /** Pagos que cubren SOLO el delta (extras + propina). */
  payments: CheckoutPayment[]
  tipCents: number
  /** Caja abierta a la que se atribuye el delta cobrado (espejo de createSale). */
  registerSessionId: string | null
}

export interface SaleResult {
  id: string
  status: string
  paymentStatus: string
  totalCents: number
  paidTotalCents: number
}
