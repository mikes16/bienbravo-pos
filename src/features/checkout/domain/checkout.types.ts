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
  extras: ResolvedExtra[]
}

export interface CatalogProduct {
  id: string
  name: string
  sku: string | null
  priceCents: number
  imageUrl: string | null
  categoryId: string | null
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
  priceCents: number
  imageUrl: string | null
  effectiveCategoryIds: string[]
  items: CatalogComboItem[]
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

export interface SaleResult {
  id: string
  status: string
  paymentStatus: string
  totalCents: number
  paidTotalCents: number
}
