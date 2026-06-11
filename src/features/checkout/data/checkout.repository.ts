import { type ApolloClient, gql } from '@apollo/client'
import { graphql } from '@/core/graphql/generated'
import { PaymentProvider } from '@/core/graphql/generated/graphql'
import type { PosSaleDetailQuery } from '@/core/graphql/generated/graphql'
import type {
  CatalogCategory,
  CatalogService,
  CatalogProduct,
  CatalogCombo,
  StockLevel,
  CreateSaleInput,
  SaleResult,
} from '../domain/checkout.types.ts'

/* ── GraphQL Documents ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FIND_OR_CREATE_MOSTRADOR_CUSTOMER = graphql(`
  mutation PosFindOrCreateMostradorCustomer {
    findOrCreateMostradorCustomer {
      id
      fullName
    }
  }
`) as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BARBERS_QUERY = graphql(`
  query PosCheckoutBarbers($locationId: ID!) {
    barbers(locationId: $locationId) {
      id
      fullName
      photoUrl
    }
  }
`) as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const POS_AVAILABLE_BARBERS_QUERY = graphql(`
  query PosAvailableBarbers($locationId: ID!) {
    posAvailableBarbers(locationId: $locationId) {
      id
      fullName
      photoUrl
      hasClockedIn
      isOccupied
    }
  }
`) as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CUSTOMER_QUERY = graphql(`
  query PosCustomer($id: ID!) {
    customer(id: $id) {
      id
      fullName
      email
      phone
    }
  }
`) as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WALKINS_FOR_LOOKUP_QUERY = graphql(`
  query PosWalkInsForLookup($locationId: ID!) {
    walkIns(locationId: $locationId) {
      id
      status
      assignedStaffUser { id fullName }
      customer { id fullName email phone }
      requestedServices { id name baseDurationMin basePriceCents categoryId }
      requestedCatalogCombo { id name }
    }
  }
`) as any

// Carga el appointment + su sale asociado para detectar estado prepago en el
// checkout (Task 15 del plan "Prepago de cita"). El POS solo necesita el
// sale derivado (paymentStatus + source + primer payment) — no la lista
// completa de items/payments. CheckoutScreen consume los flags derivados.
const APPOINTMENT_CHECKOUT_INFO_QUERY = graphql(`
  query PosAppointmentCheckoutInfo($id: ID!) {
    appointment(id: $id) {
      id
      sale {
        id
        source
        paymentStatus
        paidTotalCents
        totalCents
        payments {
          provider
          processedAt
          createdAt
          note
        }
      }
    }
  }
`)

const CATEGORIES_QUERY = graphql(`
  query PosCatalogCategories {
    catalogCategories {
      id
      name
      slug
      sortOrder
      appliesTo
    }
  }
`)

const SERVICES_QUERY = graphql(`
  query PosServices($locationId: ID!, $staffUserId: ID) {
    services(locationId: $locationId) {
      id
      name
      basePriceCents
      baseDurationMin
      isActive
      isAddOn
      imageUrl
      categoryId
      pricingFor(locationId: $locationId, staffUserId: $staffUserId) {
        priceCents
        durationMin
        extras {
          serviceId
          name
          priceCents
          durationMin
        }
      }
    }
  }
`)

// Use gql directly here (not the codegen graphql() tag) so the query parses at
// runtime even when client-preset codegen hasn't been re-run. After the next
// `npm run codegen`, this can be migrated back to graphql() for typed variables.
const RESOLVE_SERVICE_PRICE_QUERY = gql`
  query PosResolveServicePrice($id: ID!, $locationId: ID!, $staffUserId: ID) {
    service(id: $id) {
      id
      basePriceCents
      pricingFor(locationId: $locationId, staffUserId: $staffUserId) {
        priceCents
      }
    }
  }
`

const CUSTOMER_HISTORY_QUERY = gql`
  query PosCustomerHistory($customerId: ID!, $limit: Int) {
    customerAppointments(customerId: $customerId, limit: $limit) {
      id
      status
      startAt
      items { label }
    }
  }
`

const PRODUCTS_QUERY = graphql(`
  query PosProducts($locationId: ID!) {
    products(locationId: $locationId) {
      id
      name
      sku
      imageUrl
      categoryId
      isActive
      variants {
        id
        priceCents
      }
    }
  }
`)

const POS_INVENTORY_LEVELS_QUERY = graphql(`
  query PosInventoryLevels($locationId: ID!) {
    posInventoryLevels(locationId: $locationId) {
      productId
      quantity
    }
  }
`)

const COMBOS_QUERY = graphql(`
  query PosCatalogCombos {
    catalogCombos(activeOnly: true) {
      id
      name
      priceCents
      imageUrl
      effectiveCategoryIds
      items {
        serviceId
        productId
        serviceName
        productName
        qty
        sortOrder
      }
    }
  }
`)

const SEARCH_CUSTOMERS_QUERY = graphql(`
  query PosSearchCustomers($query: String!, $limit: Int) {
    searchCustomers(query: $query, limit: $limit) {
      id
      fullName
      email
      phone
    }
  }
`)

const FIND_OR_CREATE_CUSTOMER = graphql(`
  mutation FindOrCreateCustomer($name: String!, $email: String, $phone: String) {
    findOrCreateCustomer(name: $name, email: $email, phone: $phone) {
      id fullName email phone
    }
  }
`)

const CREATE_POS_SALE = graphql(`
  mutation CreatePosSale($input: CreatePOSSaleInput!) {
    createPOSSale(input: $input) {
      id
      status
      paymentStatus
      totalCents
      paidTotalCents
    }
  }
`)

// Cierra una venta prepagada (paymentStatus=PAID): el cajero solo confirma
// que el servicio se entregó, no se vuelve a cobrar. Mutation expuesta por el
// API en el plan "Prepago de cita" (task 13).
export const CLOSE_APPOINTMENT_SALE_MUTATION = graphql(`
  mutation CloseAppointmentSale($saleId: ID!) {
    closeAppointmentSale(saleId: $saleId)
  }
`)

// Cancela un link de prepago pendiente cuando el cajero decide cobrar en
// persona. Namespaced FromPos para evitar colisión con el equivalente del
// admin si algún día comparten Apollo cache.
export const CANCEL_APPOINTMENT_PREPAY_LINK_MUTATION = graphql(`
  mutation CancelAppointmentPrepayLinkFromPos($saleId: ID!) {
    cancelAppointmentPrepayLink(saleId: $saleId)
  }
`)

// Cupones de descuento: el API valida el código contra el draft sale del POS
// y devuelve los totales actualizados + la lista de cupones aplicados. Si el
// cupón es inválido para este draft (expired, scope no match, etc.) devuelve
// `validationError` con un mensaje en español listo para mostrar.
export const APPLY_COUPON_TO_DRAFT_SALE_MUTATION = graphql(`
  mutation ApplyCouponToDraftSale($input: ApplyCouponToDraftSaleInput!) {
    applyCouponToDraftSale(input: $input) {
      subtotalCents
      taxTotalCents
      totalCents
      appliedCoupons {
        code
        name
        scope
        discountAmountCents
        rule {
          type
          discountBps
          discountAmountCents
          stackable
          targetServiceIds
          targetProductIds
          targetCategoryIds
        }
      }
      validationError {
        valid
        reason
        message
        computedDiscountCents
      }
    }
  }
`)

export const REMOVE_COUPON_FROM_DRAFT_SALE_MUTATION = graphql(`
  mutation RemoveCouponFromDraftSale($input: RemoveCouponFromDraftSaleInput!) {
    removeCouponFromDraftSale(input: $input) {
      subtotalCents
      taxTotalCents
      totalCents
      appliedCoupons {
        code
        name
        scope
        discountAmountCents
        rule {
          type
          discountBps
          discountAmountCents
          stackable
          targetServiceIds
          targetProductIds
          targetCategoryIds
        }
      }
    }
  }
`)

/**
 * Detalle completo de una venta para el bottom sheet de "Mi Día".
 *
 * Gated por el permiso `pos.sale.read` en el API — el resolver `sale(id)`
 * rechaza viewers sin ese permiso. El POS además gatea el tap client-side
 * (MyDayPage no hace la row clickable si el viewer no tiene el permiso),
 * pero la barrera real es server-side.
 *
 * Co-localizado aquí (no en el feature my-day) porque su único consumidor es
 * `getSaleDetail` de este repo. El repo se instancia eager en boot vía
 * registry, así que importar desde my-day creaba un back-edge core→feature.
 *
 * Los nombres de campo se verificaron contra `schema.graphql` tras
 * `sync-schema`:
 *   - `Sale.payments` es `[PaymentTransaction!]` → `{ provider, amountCents }`
 *   - `Sale.couponApplications` es `[SaleCouponApplication!]`
 *     → `{ code, name, discountAmountCents }` (name nullable)
 *   - `SaleItem.name` es el ResolveField nuevo (String nullable)
 */
const POS_SALE_DETAIL = graphql(`
  query PosSaleDetail($id: ID!) {
    sale(id: $id) {
      id
      createdAt
      subtotalCents
      taxTotalCents
      totalCents
      customer { id fullName }
      payments { provider amountCents }
      items { itemType qty unitPriceCents totalCents name staffUser { id fullName } }
      couponApplications { code name discountAmountCents }
    }
  }
`)

/* ── Interface ── */

export interface CustomerResult {
  id: string
  fullName: string
  email: string | null
  phone: string | null
}

export interface BarberResult {
  id: string
  fullName: string
  photoUrl: string | null
  // Set by getAvailableBarbers (walk-in modal). The base getBarbers leaves
  // these undefined so callers using the legacy shape keep working.
  hasClockedIn?: boolean
  isOccupied?: boolean
}

export interface WalkInLite {
  id: string
  status: string
  assignedStaffUser: { id: string; fullName: string } | null
  customer: CustomerResult | null
  /**
   * Servicios solicitados al registrar el walk-in. Cuando el cajero abre el
   * checkout desde un walk-in (botón "Cobrar"), el carrito se pre-llena con
   * estos servicios para ahorrarle el re-tipeo. Si el cliente cambió de
   * opinión, el cajero los quita y agrega otros.
   */
  requestedServices?: Array<{
    id: string
    name: string
    baseDurationMin?: number | null
    basePriceCents?: number | null
    categoryId?: string | null
  }>
  requestedCatalogCombo?: { id: string; name: string } | null
}

/**
 * Estado prepago derivado del `appointment.sale` para el contexto de checkout.
 *
 * - `isPrepaid`: la venta ya está pagada (cliente prepagó por link Stripe o
 *   manual en admin). El cajero solo confirma entrega vía `closeAppointmentSale`.
 * - `hasPendingLink`: existe un Sale en estado UNPAID con source BOOKING_PREPAY_LINK
 *   (el cliente no ha pagado el link). El cajero puede cancelar el link y cobrar
 *   en persona vía `cancelAppointmentPrepayLink` + flujo normal de POS.
 * - `prepaidSaleId`: ID del Sale asociado cuando aplica (para llamar las mutations).
 * - `prepaidMethod`: provider del primer payment (Stripe, Cash, Transfer, etc).
 * - `prepaidAt`: ISO timestamp del primer payment (processedAt o createdAt fallback).
 *
 * Los flags son mutuamente excluyentes: si `isPrepaid=true` entonces
 * `hasPendingLink=false` y viceversa. Ambos `false` indica checkout normal.
 */
export interface AppointmentPrepayState {
  isPrepaid: boolean
  hasPendingLink: boolean
  prepaidSaleId: string | null
  prepaidMethod: PaymentProvider | null
  prepaidAt: string | null
}

/* ── Coupon DTOs ── */

export interface DraftSaleItemArg {
  serviceId?: string | null
  productId?: string | null
  qty: number
  unitPriceCents: number
}

// La "rule" cruda del cupón viaja junto al preview para que el cliente
// recompute el descuento localmente cuando cambia el carrito (cero round
// trips). El backend sigue siendo source of truth — re-valida en submit.
export interface AppliedCouponRule {
  type: 'PERCENT' | 'AMOUNT'
  discountBps: number | null
  discountAmountCents: number | null
  stackable: boolean
  targetServiceIds: string[]
  targetProductIds: string[]
  targetCategoryIds: string[]
}

export interface AppliedCouponPreview {
  code: string
  name: string
  scope: string
  discountAmountCents: number
  rule: AppliedCouponRule
}

/**
 * Resultado de `applyCouponToDraftSale` / `removeCouponFromDraftSale`.
 *
 * Cuando el cupón no es válido para el draft (expirado, scope no match,
 * etc.) el API devuelve `validationError` y la lista `appliedCoupons` no
 * incluye el cupón rechazado. El consumidor debe verificar `validationError`
 * antes de mutar el estado local.
 */
export interface DraftSaleWithDiscount {
  subtotalCents: number
  taxTotalCents: number
  totalCents: number
  appliedCoupons: AppliedCouponPreview[]
  validationError: {
    valid: boolean
    reason: string | null
    message: string
    computedDiscountCents: number
  } | null
}

export interface ApplyCouponArgs {
  code: string
  items: DraftSaleItemArg[]
  customerId?: string | null
  existingAppliedCouponCodes: string[]
}

export interface RemoveCouponArgs {
  code: string
  items: DraftSaleItemArg[]
  customerId?: string | null
  remainingAppliedCouponCodes: string[]
}

export interface CheckoutRepository {
  getCategories(): Promise<CatalogCategory[]>
  getServices(locationId: string, staffUserId?: string | null): Promise<CatalogService[]>
  getProducts(locationId: string): Promise<CatalogProduct[]>
  getCombos(): Promise<CatalogCombo[]>
  resolveServicePriceForBarber(serviceId: string, locationId: string, staffUserId: string): Promise<number>
  getStockLevels(locationId: string): Promise<StockLevel[]>
  createSale(input: CreateSaleInput): Promise<SaleResult>
  searchCustomers(query: string, limit?: number): Promise<CustomerResult[]>
  findOrCreateCustomer(name: string, email?: string | null, phone?: string | null): Promise<CustomerResult | null>
  findOrCreateMostradorCustomer(): Promise<{ id: string; fullName: string }>
  getBarbers(locationId: string): Promise<BarberResult[]>
  getAvailableBarbers(locationId: string): Promise<BarberResult[]>
  getCustomer(id: string): Promise<CustomerResult | null>
  getCustomerHistory(customerId: string, limit?: number): Promise<CustomerHistoryEntry[]>
  getWalkIn(walkInId: string, locationId: string): Promise<WalkInLite | null>
  /**
   * Devuelve el estado prepago derivado de `appointment.sale`. Cuando no hay
   * appointment, o no tiene sale, devuelve el "default state" (ambos flags
   * false) — el CheckoutScreen entonces sigue el flujo normal de cobro.
   */
  getAppointmentPrepayState(appointmentId: string): Promise<AppointmentPrepayState>
  /**
   * Aplica un cupón al draft del checkout. Devuelve los totales recalculados
   * + la lista de cupones aplicados, o `validationError` cuando el código
   * no es válido para este draft.
   */
  applyCoupon(args: ApplyCouponArgs): Promise<DraftSaleWithDiscount | null>
  /** Quita un cupón ya aplicado del draft y devuelve los totales actualizados. */
  removeCoupon(args: RemoveCouponArgs): Promise<DraftSaleWithDiscount | null>
  /**
   * Detalle completo de una venta para el bottom sheet de "Mi Día". El API
   * gatea este resolver con el permiso `pos.sale.read`; si el viewer no lo
   * tiene, la query falla. El POS además no abre el sheet sin ese permiso.
   * Devuelve `null` si la venta no existe.
   */
  getSaleDetail(id: string): Promise<SaleDetail | null>
}

export interface CustomerHistoryEntry {
  id: string
  status: string
  startAt: string
  itemLabels: string[]
}

/* ── Sale detail (Mi Día → tap en venta) ── */

export interface SaleDetailItem {
  id: string
  name: string
  qty: number
  unitPriceCents: number
  totalCents: number
  staffUser: { id: string; fullName: string } | null
}

export interface SaleDetailPayment {
  provider: string
  amountCents: number
}

export interface SaleDetailDiscount {
  code: string
  name: string | null
  discountAmountCents: number
}

/**
 * Forma mapeada que consume `SaleTicketBody` (vía `SaleDetailSheet`). Es
 * compatible con `SaleTicketData` del componente compartido — mismos campos
 * `id/totalCents/payments/customer/items` — más `subtotalCents`,
 * `taxTotalCents`, `createdAt` y la lista de `discounts` (couponApplications).
 */
export interface SaleDetail {
  id: string
  createdAt: string
  subtotalCents: number
  taxTotalCents: number
  totalCents: number
  customer: { id: string; fullName: string } | null
  payments: SaleDetailPayment[]
  items: SaleDetailItem[]
  discounts: SaleDetailDiscount[]
}

/** Fallback legible cuando `SaleItem.name` viene null (item sin nombre
 *  resuelto en el API). No debería pasar en la práctica, pero el campo es
 *  nullable en el schema, así que cubrimos el caso. */
const ITEM_TYPE_FALLBACK: Record<string, string> = {
  PRODUCT: 'Producto',
  SERVICE: 'Servicio',
  TIP: 'Propina',
}

/* ── Apollo Implementation ── */

interface RawPricingExtra {
  serviceId: string
  name: string
  priceCents: number
  durationMin: number
}

interface RawPricing {
  priceCents: number
  durationMin: number
  extras: RawPricingExtra[]
}

interface RawService {
  id: string
  name: string
  basePriceCents: number
  baseDurationMin: number
  isActive: boolean
  isAddOn: boolean
  imageUrl: string | null
  categoryId: string | null
  pricingFor: RawPricing | null
}

interface RawProduct {
  id: string
  name: string
  sku: string | null
  imageUrl: string | null
  categoryId: string | null
  isActive: boolean
  variants: { id: string; priceCents: number }[]
}

export class ApolloCheckoutRepository implements CheckoutRepository {
  #client: ApolloClient
  constructor(client: ApolloClient) {
    this.#client = client
  }

  async getCategories(): Promise<CatalogCategory[]> {
    const { data } = await this.#client.query<{ catalogCategories: CatalogCategory[] }>({
      query: CATEGORIES_QUERY,
      fetchPolicy: 'cache-first',
    })
    return data!.catalogCategories
  }

  async getServices(locationId: string, staffUserId?: string | null): Promise<CatalogService[]> {
    const { data } = await this.#client.query<{ services: RawService[] }>({
      query: SERVICES_QUERY,
      variables: { locationId, staffUserId: staffUserId ?? null },
      fetchPolicy: 'cache-first',
    })
    return data!.services
      .filter((s: RawService) => s.isActive)
      .map((s: RawService) => ({
        id: s.id,
        name: s.name,
        // Precio/duración resueltos por sucursal (y staff si aplica). Fallback a base
        // si pricingFor no vino por alguna razón (e.g. schema parcial en dev).
        priceCents: s.pricingFor?.priceCents ?? s.basePriceCents,
        durationMin: s.pricingFor?.durationMin ?? s.baseDurationMin,
        isAddOn: s.isAddOn,
        imageUrl: s.imageUrl ?? null,
        categoryId: s.categoryId ?? null,
        extras: s.pricingFor?.extras ?? [],
      }))
  }

  async resolveServicePriceForBarber(serviceId: string, locationId: string, staffUserId: string): Promise<number> {
    const { data } = await this.#client.query<{
      service: { id: string; basePriceCents: number; pricingFor: { priceCents: number } | null } | null
    }>({
      query: RESOLVE_SERVICE_PRICE_QUERY,
      variables: { id: serviceId, locationId, staffUserId },
      fetchPolicy: 'cache-first',
    })
    const svc = data?.service
    if (!svc) throw new Error(`Service ${serviceId} not found`)
    return svc.pricingFor?.priceCents ?? svc.basePriceCents
  }

  async getStockLevels(locationId: string): Promise<StockLevel[]> {
    // cache-first: el snapshot cached del checkout previo pinta el grid al
    // instante. Stock se decrementa con cache.modify en createSale, y la
    // próxima entrada al checkout fuerza network-only via Promise.all del
    // useCheckout para garantizar freshness.
    const { data } = await this.#client.query<{ posInventoryLevels: StockLevel[] }>({
      query: POS_INVENTORY_LEVELS_QUERY,
      variables: { locationId },
      fetchPolicy: 'cache-first',
    })
    return data!.posInventoryLevels
  }

  async getCombos(): Promise<CatalogCombo[]> {
    const { data } = await this.#client.query<{ catalogCombos: CatalogCombo[] }>({
      query: COMBOS_QUERY,
      fetchPolicy: 'cache-first',
    })
    return data!.catalogCombos
  }

  async getProducts(locationId: string): Promise<CatalogProduct[]> {
    const { data } = await this.#client.query<{ products: RawProduct[] }>({
      query: PRODUCTS_QUERY,
      variables: { locationId },
      fetchPolicy: 'cache-first',
    })
    return data!.products
      .filter((p: RawProduct) => p.isActive)
      .map((p: RawProduct) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        priceCents: p.variants[0]?.priceCents ?? 0,
        imageUrl: p.imageUrl,
        categoryId: p.categoryId ?? null,
      }))
  }

  async findOrCreateCustomer(name: string, email?: string | null, phone?: string | null): Promise<CustomerResult | null> {
    if (!email && !phone) return null
    const { data } = await this.#client.mutate<{ findOrCreateCustomer: CustomerResult | null }>({
      mutation: FIND_OR_CREATE_CUSTOMER,
      variables: { name, email: email ?? null, phone: phone ?? null },
    })
    return data!.findOrCreateCustomer ?? null
  }

  async searchCustomers(query: string, limit = 10): Promise<CustomerResult[]> {
    if (query.trim().length < 2) return []
    const { data } = await this.#client.query<{ searchCustomers: CustomerResult[] }>({
      query: SEARCH_CUSTOMERS_QUERY,
      variables: { query: query.trim(), limit },
      fetchPolicy: 'network-only',
    })
    return data!.searchCustomers
  }

  async createSale(input: CreateSaleInput): Promise<SaleResult> {
    const { data } = await this.#client.mutate<{
      createPOSSale: SaleResult
    }>({
      mutation: CREATE_POS_SALE,
      variables: {
        input: {
          locationId: input.locationId,
          registerSessionId: input.registerSessionId,
          customerId: input.customerId,
          staffUserId: input.staffUserId,
          completeWalkInId: input.completeWalkInId ?? null,
          completeAppointmentId: input.completeAppointmentId ?? null,
          items: input.items,
          tipCents: input.tipCents,
          payments: input.payments.map((p) => ({
            provider: p.provider,
            amountCents: p.amountCents,
          })),
          // API field tiene defaultValue: [] así que mandar [] es seguro
          // cuando el cajero no aplicó cupones; cuando sí los aplicó, los
          // códigos llegan vía el state del hook.
          appliedCouponCodes: input.appliedCouponCodes ?? [],
        },
      },
    })
    // Una venta cambia datos que se leen cache-first en otras pantallas; los
    // evictamos para que la próxima lectura traiga lo fresco. No rompe el
    // instant-load: solo invalida cuando de verdad hubo una venta.
    //   - staffDayEarnings (A10): la venta no se reflejaba en "Mis Ventas"/Hoy.
    //   - registers + posCajaStatusHome: la venta incrementa los montos
    //     esperados de la caja server-side (efectivo/tarjeta/transfer), pero la
    //     pantalla Caja (getRegisters es cache-first) mostraba el snapshot viejo
    //     — ej. TARJETA $0 tras cobrar con tarjeta. El dinero SÍ estaba en la DB;
    //     era solo el display. Evictar arregla el display al volver a Caja/Hoy.
    const cache = this.#client.cache
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'staffDayEarnings' })
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'registers' })
    cache.evict({ id: 'ROOT_QUERY', fieldName: 'posCajaStatusHome' })
    cache.gc()
    return data!.createPOSSale
  }

  async applyCoupon(args: ApplyCouponArgs): Promise<DraftSaleWithDiscount | null> {
    // `as any` mirror del patrón usado para CLOSE_APPOINTMENT_SALE_MUTATION
    // y CANCEL_APPOINTMENT_PREPAY_LINK_MUTATION arriba — client-preset emite
    // un Document genérico que TS no infiere correctamente sobre el resultado
    // de la mutation. Lo casteamos al shape definido en DraftSaleWithDiscount.
    const { data } = await this.#client.mutate({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mutation: APPLY_COUPON_TO_DRAFT_SALE_MUTATION as any,
      variables: {
        input: {
          code: args.code,
          items: args.items.map((it) => ({
            serviceId: it.serviceId ?? null,
            productId: it.productId ?? null,
            qty: it.qty,
            unitPriceCents: it.unitPriceCents,
          })),
          customerId: args.customerId ?? null,
          existingAppliedCouponCodes: args.existingAppliedCouponCodes,
        },
      },
    })
    const result = (data as { applyCouponToDraftSale?: DraftSaleWithDiscount } | null)?.applyCouponToDraftSale
    return result ?? null
  }

  async removeCoupon(args: RemoveCouponArgs): Promise<DraftSaleWithDiscount | null> {
    const { data } = await this.#client.mutate({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mutation: REMOVE_COUPON_FROM_DRAFT_SALE_MUTATION as any,
      variables: {
        input: {
          code: args.code,
          items: args.items.map((it) => ({
            serviceId: it.serviceId ?? null,
            productId: it.productId ?? null,
            qty: it.qty,
            unitPriceCents: it.unitPriceCents,
          })),
          customerId: args.customerId ?? null,
          remainingAppliedCouponCodes: args.remainingAppliedCouponCodes,
        },
      },
    })
    const result = (data as { removeCouponFromDraftSale?: DraftSaleWithDiscount } | null)?.removeCouponFromDraftSale
    return result ?? null
  }

  async findOrCreateMostradorCustomer(): Promise<{ id: string; fullName: string }> {
    const { data } = await this.#client.mutate({ mutation: FIND_OR_CREATE_MOSTRADOR_CUSTOMER })
    const result = (data as { findOrCreateMostradorCustomer?: { id: string; fullName: string } } | null)?.findOrCreateMostradorCustomer
    if (!result) throw new Error('Mostrador customer not returned')
    return result
  }

  async getBarbers(locationId: string): Promise<BarberResult[]> {
    const { data } = await this.#client.query({
      query: BARBERS_QUERY,
      variables: { locationId },
      fetchPolicy: 'cache-first',
    })
    return (data as { barbers: BarberResult[] }).barbers
  }

  async getAvailableBarbers(locationId: string): Promise<BarberResult[]> {
    // cache-first: pinta el snapshot del modal al instante. Mutaciones de
    // walk-in / clock escriben al cache, así que tras un assign el siguiente
    // open del sheet ve estado actualizado sin round trip.
    const { data } = await this.#client.query({
      query: POS_AVAILABLE_BARBERS_QUERY,
      variables: { locationId },
      fetchPolicy: 'cache-first',
    })
    return (data as { posAvailableBarbers: BarberResult[] }).posAvailableBarbers
  }

  async getCustomer(id: string): Promise<CustomerResult | null> {
    const { data } = await this.#client.query({
      query: CUSTOMER_QUERY,
      variables: { id },
      fetchPolicy: 'network-only',
    })
    return (data as { customer: CustomerResult | null }).customer ?? null
  }

  async getCustomerHistory(customerId: string, limit = 5): Promise<CustomerHistoryEntry[]> {
    const { data } = await this.#client.query<{
      customerAppointments: Array<{ id: string; status: string; startAt: string; items: Array<{ label: string }> }>
    }>({
      query: CUSTOMER_HISTORY_QUERY,
      variables: { customerId, limit },
      fetchPolicy: 'cache-first',
    })
    return (data?.customerAppointments ?? []).map((a) => ({
      id: a.id,
      status: a.status,
      startAt: a.startAt,
      itemLabels: a.items.map((i) => i.label),
    }))
  }

  async getWalkIn(walkInId: string, locationId: string): Promise<WalkInLite | null> {
    const { data } = await this.#client.query({
      query: WALKINS_FOR_LOOKUP_QUERY,
      variables: { locationId },
      fetchPolicy: 'network-only',
    })
    const list = (data as { walkIns: WalkInLite[] }).walkIns
    return list.find((w) => w.id === walkInId) ?? null
  }

  async getAppointmentPrepayState(appointmentId: string): Promise<AppointmentPrepayState> {
    // network-only: el estado de prepago puede cambiar entre cuando el cliente
    // creó el link y cuando el cajero abre el checkout (cliente paga vía Stripe
    // en paralelo). No queremos servir cache stale aquí.
    const { data } = await this.#client.query({
      query: APPOINTMENT_CHECKOUT_INFO_QUERY,
      variables: { id: appointmentId },
      fetchPolicy: 'network-only',
    })
    const appointment = (data as {
      appointment: {
        id: string
        sale: {
          id: string
          source: string
          paymentStatus: string
          paidTotalCents: number
          totalCents: number
          payments: Array<{
            provider: PaymentProvider
            processedAt: string | null
            createdAt: string
            note: string | null
          }> | null
        } | null
      } | null
    }).appointment

    const sale = appointment?.sale ?? null
    const isPrepaid = sale?.paymentStatus === 'PAID'
    const hasPendingLink =
      sale?.paymentStatus === 'UNPAID' && sale?.source === 'BOOKING_PREPAY_LINK'
    const prepaidSaleId = sale && (isPrepaid || hasPendingLink) ? sale.id : null
    const firstPayment = sale?.payments?.[0] ?? null
    const prepaidMethod = firstPayment?.provider ?? null
    const prepaidAt = firstPayment?.processedAt ?? firstPayment?.createdAt ?? null
    return {
      isPrepaid,
      hasPendingLink,
      prepaidSaleId,
      prepaidMethod,
      prepaidAt,
    }
  }

  async getSaleDetail(id: string): Promise<SaleDetail | null> {
    // cache-first: una venta cerrada es inmutable, así que el snapshot del
    // cache es válido. Si el barbero abrió el detalle ya, reabrir es instante.
    const { data } = await this.#client.query<PosSaleDetailQuery>({
      query: POS_SALE_DETAIL,
      variables: { id },
      fetchPolicy: 'cache-first',
    })
    const sale = data?.sale
    if (!sale) return null

    // El query no selecciona `id` por item (no existe necesidad en el API
    // para este caso), así que sintetizamos una key estable por índice para
    // el render. Las ventas son inmutables, el orden no cambia.
    const items: SaleDetailItem[] = sale.items.map((it, idx) => ({
      id: `${sale.id}-item-${idx}`,
      name: it.name ?? ITEM_TYPE_FALLBACK[it.itemType] ?? 'Concepto',
      qty: it.qty,
      unitPriceCents: it.unitPriceCents,
      totalCents: it.totalCents,
      staffUser: it.staffUser
        ? { id: it.staffUser.id, fullName: it.staffUser.fullName }
        : null,
    }))

    const payments: SaleDetailPayment[] = (sale.payments ?? []).map((p) => ({
      provider: p.provider,
      amountCents: p.amountCents,
    }))

    const discounts: SaleDetailDiscount[] = (sale.couponApplications ?? []).map((c) => ({
      code: c.code,
      name: c.name ?? null,
      discountAmountCents: c.discountAmountCents,
    }))

    return {
      id: sale.id,
      createdAt: sale.createdAt,
      subtotalCents: sale.subtotalCents,
      taxTotalCents: sale.taxTotalCents,
      totalCents: sale.totalCents,
      customer: sale.customer
        ? { id: sale.customer.id, fullName: sale.customer.fullName }
        : null,
      payments,
      items,
      discounts,
    }
  }
}
