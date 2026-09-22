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

/**
 * Variante de un producto del catálogo. `staffPriceCents` es el precio de
 * venta a staff YA RESUELTO por el API para esta variante (variante >
 * producto > costo, spec venta a staff §4.2): el POS nunca ve el costo crudo
 * ni re-deriva la precedencia. `null` = esta variante no se puede vender a
 * staff (no hay precio staff capturado en ningún nivel).
 */
export interface CatalogProductVariant {
  id: string
  /** Precio público de la variante (el que se cobra a un cliente normal). */
  priceCents: number
  staffPriceCents: number | null
}

export interface CatalogProduct {
  id: string
  name: string
  sku: string | null
  priceCents: number
  imageUrl: string | null
  categoryId: string | null
  sortOrder: number
  /**
   * El admin marcó el producto como vendible a staff (`staffSaleEligible`).
   * `false` = el API rechaza la línea en modo venta a staff; el POS solo lo
   * pinta como no elegible, no decide.
   */
  staffSaleEligible: boolean
  /**
   * Precio staff resuelto a nivel producto (producto > costo). `null` = no hay
   * precio staff capturado ⇒ no se puede vender a staff. Cuando las variantes
   * tienen precios staff distintos, el precio real de la línea es el de la
   * variante elegida (`variants[].staffPriceCents`) y el API exige
   * `productVariantId`.
   */
  staffPriceCents: number | null
  variants: CatalogProductVariant[]
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

/**
 * Modo "venta a staff" del cobro (spec venta a staff §4.3): la barbería le
 * vende productos a un barbero a precio especial. Solo viaja el COMPRADOR — el
 * precio, los topes y los permisos los resuelve el API dentro de la misma
 * transacción del cobro. Ausente = venta normal.
 */
export interface StaffSaleInput {
  buyerStaffUserId: string
}

export interface CreateSaleInput {
  locationId: string
  registerSessionId: string | null
  customerId: string | null
  staffUserId: string | null
  /** Ausente/null = venta normal: el input que viaja al API no cambia. */
  staffSale?: StaffSaleInput | null
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
   * Variante elegida de la línea de producto. Solo hace falta cuando las
   * variantes del producto tienen precio staff distinto: sin ella el API
   * rechaza la venta a staff pidiendo elegir variante. Ausente = el API
   * resuelve como siempre (la línea no la lleva hoy en venta normal).
   */
  productVariantId?: string | null
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

/* ── Cupo de venta a staff (spec venta a staff §4.3) ── */

/** Unidades que el comprador lleva este mes de UN producto. */
export interface StaffSaleProductUnits {
  productId: string
  units: number
}

/**
 * Cupo del mes del comprador, tal como lo devuelve el API. **El POS solo lo
 * muestra**: no decide, no acumula y no lo re-mide — la autoridad es
 * `createPOSSale`, que lo vuelve a medir dentro de su transacción. Un `null`
 * en un límite/restante significa "sin tope", nunca cero.
 *
 * El mes se mide en la tz de la SUCURSAL desde la que se cobraría, por eso el
 * `locationId` es obligatorio aunque el cupo sume todas las sucursales.
 */
export interface StaffSaleQuota {
  /** La política de venta a staff está activa para el tenant. */
  enabled: boolean
  /** La política permite servicios/combos en el mismo ticket. */
  allowServicesInTicket: boolean
  unitsUsed: number
  unitsLimit: number | null
  unitsRemaining: number | null
  /** Consumo medido a precio PÚBLICO (cuánto inventario salió). */
  listAmountCentsUsed: number
  listAmountCentsLimit: number | null
  listAmountCentsRemaining: number | null
  /** Tope de unidades por producto por mes; null = sin tope. */
  perProductLimit: number | null
  unitsByProduct: StaffSaleProductUnits[]
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
 * Rechazos propios del modo VENTA A STAFF (spec venta a staff §4.3). Van en su
 * propia unión —y no dentro de `CheckoutRejectionCode`— porque la recuperación
 * de un rechazo por datos viejos (`useCheckout`) y su aviso en pantalla
 * enumeran exhaustivamente los códigos que saben manejar: meterlos ahí los
 * obligaría a tratarlos como recuperables, y no lo son. **Ninguno se arregla
 * recargando el catálogo**: los resuelve el operador (elegir variante, quitar
 * la línea) o el dueño (subir el tope en Ajustes).
 *
 *  - `STAFF_SALE_QUOTA_EXCEEDED`: el comprador ya se pasó de su tope del mes
 *    (unidades, monto a precio público, o unidades de un producto). El API
 *    manda el texto listo para mostrar ("Kevin lleva 5 de 6 productos este
 *    mes") y el detalle de cada tope rebasado en `extensions.violations`.
 *  - `STAFF_SALE_NOT_ELIGIBLE`: el producto no se vende a staff (marcado como
 *    no elegible, o sin precio staff capturado en ningún nivel).
 *  - `STAFF_SALE_VARIANT_REQUIRED`: el producto tiene variantes con precio
 *    staff distinto y la línea no eligió cuál.
 */
export type StaffSaleRejectionCode =
  | 'STAFF_SALE_QUOTA_EXCEEDED'
  | 'STAFF_SALE_NOT_ELIGIBLE'
  | 'STAFF_SALE_VARIANT_REQUIRED'

/** Todo lo que puede traer un rechazo de cobro: recuperables + venta a staff. */
export type AnyCheckoutRejectionCode = CheckoutRejectionCode | StaffSaleRejectionCode

/**
 * Error tipado del dominio: lo que el repositorio lanza cuando la mutation de
 * cobro falla. `message` es el texto del API (ya viene en español y accionable)
 * y se muestra tal cual al operador.
 */
export class CheckoutRejectedError extends Error {
  readonly code: AnyCheckoutRejectionCode
  constructor(code: AnyCheckoutRejectionCode, message: string) {
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
 * Venta a staff: el API lanza el tope excedido con código propio
 * (`STAFF_SALE_QUOTA_EXCEEDED`), pero "no elegible" y "falta elegir variante"
 * salen como `BAD_USER_INPUT` — el mismo código que cualquier otro input malo,
 * así que hay que mirar el texto. A diferencia del caso STOCK, aquí SÍ es
 * seguro en producción: son `GraphQLError` con `extensions.code` explícito y
 * el filtro de excepciones del API los devuelve intactos (solo enmascara los
 * `Error` pelones). El día que el API les dé código propio, el switch de abajo
 * ya los reconoce sin tocar esto.
 */
const STAFF_SALE_NOT_ELIGIBLE_PATTERN = /no est[áa] disponible para venta a staff/i
const STAFF_SALE_VARIANT_REQUIRED_PATTERN = /elige la variante/i

/** Clasificación por texto, cuando el código del API no alcanza. */
function rejectionCodeFromMessage(message: string): AnyCheckoutRejectionCode {
  if (STOCK_MESSAGE_PATTERN.test(message)) return 'STOCK'
  if (STAFF_SALE_NOT_ELIGIBLE_PATTERN.test(message)) return 'STAFF_SALE_NOT_ELIGIBLE'
  if (STAFF_SALE_VARIANT_REQUIRED_PATTERN.test(message)) return 'STAFF_SALE_VARIANT_REQUIRED'
  return 'UNKNOWN'
}

/**
 * Traduce el `extensions.code` de un GraphQLError (o su mensaje, cuando el API
 * no manda código) al código de dominio. Función pura: quien lee el error de
 * Apollo es el repositorio. El `message` del API viaja intacto en el error —
 * ya viene en español y accionable.
 */
export function checkoutRejectionCodeFrom(
  code: string | null | undefined,
  message: string,
): AnyCheckoutRejectionCode {
  switch (code) {
    case 'PRICE_MISMATCH':
      return 'PRICE_MISMATCH'
    case 'BARBER_EXCLUDED':
      return 'BARBER_EXCLUDED'
    case 'REGISTER_SESSION_STALE':
      return 'REGISTER_SESSION_STALE'
    case 'INSUFFICIENT_STOCK':
      return 'STOCK'
    case 'STAFF_SALE_QUOTA_EXCEEDED':
      return 'STAFF_SALE_QUOTA_EXCEEDED'
    case 'STAFF_SALE_NOT_ELIGIBLE':
      return 'STAFF_SALE_NOT_ELIGIBLE'
    case 'STAFF_SALE_VARIANT_REQUIRED':
      return 'STAFF_SALE_VARIANT_REQUIRED'
    default:
      return rejectionCodeFromMessage(message)
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
