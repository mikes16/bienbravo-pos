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

/* ── Rechazos del API al cobrar (spec frescura § 3.5, principio P5) ── */

/**
 * Por qué el servidor rechazó un cobro. El API decide al cobrar y un rechazo
 * por datos viejos tiene que poder recuperarse solo — para eso el POS
 * necesita distinguirlos, no un texto suelto:
 *
 *  - `PRICE_MISMATCH`: el precio de una línea ya no es el que resuelve el
 *    motor de precios (el admin publicó otro mientras el carrito estaba armado).
 *  - `BARBER_EXCLUDED`: el barbero acreditado en una línea ya no realiza ese
 *    servicio/combo (override con `isExcluded`). Se recupera igual que el
 *    anterior: el catálogo del POS está viejo y hay que re-preciar.
 *  - `REGISTER_SESSION_STALE`: la caja abierta es de un día anterior; el API
 *    no acepta cobros hasta que se haga el corte.
 *  - `STOCK`: no alcanza el inventario de la sucursal para los productos del
 *    carrito.
 *  - `UNKNOWN`: cualquier otra cosa (red, permisos, bug). Se muestra tal cual.
 */
export type CheckoutRejectionCode =
  | 'PRICE_MISMATCH'
  | 'BARBER_EXCLUDED'
  | 'REGISTER_SESSION_STALE'
  | 'STOCK'
  | 'UNKNOWN'

/**
 * Error tipado del dominio: lo que el repositorio lanza cuando la mutation de
 * cobro falla. `message` es el texto del API (ya viene en español y accionable)
 * y se muestra tal cual al operador.
 */
export class CheckoutRejectedError extends Error {
  readonly code: CheckoutRejectionCode
  constructor(code: CheckoutRejectionCode, message: string) {
    super(message)
    this.name = 'CheckoutRejectedError'
    this.code = code
  }
}

/**
 * Faltante de stock: el API NO manda código propio para este caso — lo lanza
 * como `Error` plano desde `assertStockAvailable` (pos.resolver.ts), así que el
 * filtro de excepciones lo normaliza a `INTERNAL_SERVER_ERROR` y lo único
 * estable es el encabezado del mensaje ("Stock insuficiente en esta
 * sucursal: …"). Se reconoce por ese patrón Y por un código explícito, para
 * que el día que el API lo tipe (`INSUFFICIENT_STOCK`) esto siga funcionando
 * sin tocar el POS. Ojo: con `NODE_ENV=production` el filtro reemplaza el
 * mensaje por uno genérico, así que ahí el caso cae en `UNKNOWN` hasta que el
 * API mande el código.
 */
const STOCK_MESSAGE_PATTERN = /stock insuficiente/i

/**
 * Traduce el `extensions.code` de un GraphQLError (o su mensaje, cuando el API
 * no manda código) al código de dominio. Función pura: quien lee el error de
 * Apollo es el repositorio.
 */
export function checkoutRejectionCodeFrom(
  code: string | null | undefined,
  message: string,
): CheckoutRejectionCode {
  switch (code) {
    case 'PRICE_MISMATCH':
      return 'PRICE_MISMATCH'
    case 'BARBER_EXCLUDED':
      return 'BARBER_EXCLUDED'
    case 'REGISTER_SESSION_STALE':
      return 'REGISTER_SESSION_STALE'
    case 'INSUFFICIENT_STOCK':
      return 'STOCK'
    default:
      return STOCK_MESSAGE_PATTERN.test(message) ? 'STOCK' : 'UNKNOWN'
  }
}

/**
 * Normaliza cualquier cosa lanzada por un repositorio de cobro a
 * `CheckoutRejectedError`. Lo usa la capa de aplicación: el repositorio de
 * Apollo ya lanza el error tipado, pero un repositorio de test (o un fallo
 * antes de la mutation) puede lanzar un `Error` pelón y el cobro no puede
 * quedarse sin clasificar.
 */
export function toCheckoutRejection(err: unknown): CheckoutRejectedError {
  if (err instanceof CheckoutRejectedError) return err
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  return new CheckoutRejectedError(checkoutRejectionCodeFrom(null, message), message)
}
