import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { useLocation } from '@/core/location/useLocation'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { resetSaleActivity, setSaleInProgress, setSaleSubmitting } from '@/core/auth/saleActivity'
import {
  FreshnessContext,
  type FreshnessContextValue,
  type FreshnessTopic,
} from '@/core/freshness/FreshnessProvider'
import { useToast } from '@/core/toast/useToast'
import { cartReducer, initialCart, findUnavailableCreditedBarberId, computeTotals } from '../lib/cart'
import type { CartLine } from '../lib/cart'
import { cartLinesToDiscountItems, recomputeAppliedCoupons } from '../lib/coupon-compute'
import { sortCatalogItems, onlyCategorized } from '../lib/sort-catalog'
import {
  STAFF_SALE_MESSAGES,
  quotaView,
  staffCartSummary,
  staffLineMessage,
  staffLineView,
  unitsQuotaMessage,
} from '../lib/staff-sale'
import type {
  StaffCartSummary,
  StaffLineBlockReason,
  StaffQuotaView,
  StaffSummaryLine,
} from '../lib/staff-sale'
import { toCheckoutRejection } from '../domain/checkout.types'
import type {
  AnyCheckoutRejectionCode,
  CheckoutPayment,
  CheckoutRejectionCode,
  CatalogService,
  CatalogProduct,
  CatalogCombo,
  StaffSaleQuota,
} from '../domain/checkout.types'
import { formatMoney } from '@/shared/lib/money'
import type { AppointmentPrepayState, AppliedCouponPreview, DraftSaleItemArg } from '../data/checkout.repository'
import type { CustomerReputationTag } from '@/shared/lib/reputation'

interface Customer {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  reputationTag?: CustomerReputationTag | null
}

interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
  // A1: solo se puede asignar a barberos con turno iniciado (clocked-in).
  hasClockedIn?: boolean
}

interface CatalogItem {
  id: string
  kind: 'service' | 'product' | 'combo'
  name: string
  priceCents: number
  stockQty?: number
  imageUrl?: string | null
  categoryId: string | null
  sortOrder: number
  // Servicios y COMBOS: IDs de barberos que NO realizan/ofrecen este item. El
  // picker de la línea los oculta y el grid oculta la card cuando el atendiendo
  // está excluido. Vacío/undefined para productos.
  excludedStaffIds?: string[]
}

type CheckoutContext =
  | { kind: 'free' }
  | { kind: 'preselected-customer'; customerId: string }
  | { kind: 'walk-in'; walkInId: string }

export interface SaleResult {
  id: string
  totalCents: number
  /** Propina cobrada, ya incluida en `totalCents`. El recibo la desglosa. */
  tipCents: number
  payments: CheckoutPayment[]
  createdAt: string
  customer: Customer | null
  items: Array<{
    id: string
    name: string
    qty: number
    unitPriceCents: number
    totalCents: number
    staffUser: { id: string; fullName: string } | null
  }>
}

/** Faltante de un producto del carrito contra el stock que acaba de responder el API. */
export interface CheckoutStockShortage {
  productId: string
  name: string
  availableQty: number
  requestedQty: number
}

/**
 * Aviso de "el servidor rechazó el cobro por datos viejos, ya me puse al día"
 * (spec § 3.5). Vive separado de `error` a propósito: `error` es el texto
 * suelto de un fallo que el operador no puede resolver, y esto es un estado
 * accionable — el carrito YA se corrigió y falta que el operador confirme.
 * Mientras existe, la hoja de pago no se muestra: cobrar exige otro toque.
 */
export interface CheckoutRejectionNotice {
  code: Exclude<CheckoutRejectionCode, 'UNKNOWN'>
  /** Qué tiene que hacer el operador. */
  message: string
  /** Texto del API (nombra el servicio/barbero/caja). Null si no aporta nada. */
  detail: string | null
  /** Re-precio: total del carrito antes y después. Null en los demás casos. */
  previousTotalCents: number | null
  newTotalCents: number | null
  /** Faltantes de stock por producto. Vacío en los demás casos. */
  shortages: CheckoutStockShortage[]
}

const PRICE_CHANGED_MESSAGE = 'Los precios cambiaron. Revisa el total antes de cobrar.'

/* ── Venta a staff: constantes y tipos del modo (spec venta a staff §4.3/§4.5) ── */

/** Vender a staff. Sin ninguno de los dos el interruptor ni se ofrece (spec §5). */
const STAFF_SALE_CREATE = 'pos.staff_sale.create'
/** Cobrar la compra de OTRO barbero (caso recepción). */
const STAFF_SALE_CREATE_FOR_OTHERS = 'pos.staff_sale.create_for_others'

const STAFF_SALE_MESSAGE = {
  noCoupons: 'Una venta a staff no admite cupones',
  disabled: 'La venta a staff está desactivada.',
  quotaUnavailable: 'No se pudo leer el cupo de venta a staff. Reintenta.',
  noServices: 'Una venta a staff no admite servicios ni combos en este ticket',
  quotaExceeded: 'Se pasó un tope de la venta a staff de este mes.',
  noBuyer: 'No se pudo identificar al comprador de la venta a staff.',
} as const

/** Por qué un concepto no entra al ticket en modo venta a staff. */
export type StaffSaleAddBlockReason = StaffLineBlockReason | 'SERVICES_NOT_ALLOWED'

/** Lo que devuelve `addCatalogItem`: qué pasó y, si no entró, por qué. */
export type AddCatalogItemResult =
  | { added: true }
  | { added: false; reason: StaffSaleAddBlockReason; message: string }

/**
 * Precio staff COMITEADO de una línea de producto. `listUnitPriceCents` es el
 * precio público congelado y es la ÚNICA marca de "esta línea va a precio
 * staff" ([D-041]): no hay bandera paralela por línea. Vive en un mapa del
 * hook (lineId → esto) y no dentro de `CartLine` porque `lib/cart.ts` queda
 * fuera del alcance de esta tarea; el día que la línea gane el campo, el mapa
 * se colapsa sin cambiar ninguna regla de aquí.
 */
interface StaffLinePrice {
  listUnitPriceCents: number
  /** Presentación elegida; `null` = el producto no necesita elegir. */
  productVariantId: string | null
}

/** Resultado de re-preciar UNA línea tras un rechazo del API. */
interface RepricedLine {
  priceCents: number
  /** El barbero de la línea ya no ofrece el item: se queda sin barbero. */
  clearBarber: boolean
  /** Precio staff re-resuelto; `null` = la línea no va a precio staff. */
  staff: StaffLinePrice | null
}

/** Una línea de producto del ticket, vista desde el modo venta a staff. */
export interface StaffSaleCartLine {
  lineId: string
  productId: string
  name: string
  qty: number
  /** Lo que se cobra hoy por unidad (staff si la línea ya se convirtió). */
  unitPriceCents: number
  /** Precio público congelado; `null` = la línea NO tiene precio staff. */
  listUnitPriceCents: number | null
  productVariantId: string | null
  /** Qué falta para poder cobrarla a staff; `null` = lista. */
  blockReason: StaffLineBlockReason | null
  blockMessage: string | null
}

/**
 * Cómo se pinta UN producto del CATÁLOGO (la card del grid) con el modo venta
 * a staff encendido. Es `staffLineView(product, null)` ya resuelto: la card
 * (`catalogItems`) sólo trae id/nombre/precio público/stock, así que sin esto
 * el grid no tiene con qué pintar el precio staff ni marcar a los no elegibles
 * (spec §4.5).
 *
 * **Esto es DISPLAY, no una decisión.** La autoridad sigue siendo el API:
 * `createPOSSale` vuelve a medir precio staff, elegibilidad y topes dentro de
 * su transacción, y su rechazo gana sobre lo que aquí se haya pintado. Lo de
 * aquí sólo evita que el operador se entere después de haber cobrado.
 *
 * Es la vista del producto SIN presentación elegida: un producto que exige
 * elegirla entra como NO elegible (`NEEDS_VARIANT`) y sin precio staff, porque
 * el tile no puede pintar un precio que todavía no existe ([D-042]). El precio
 * de la LÍNEA, una vez capturada, lo lleva `StaffSaleCartLine`.
 */
export interface StaffCatalogView {
  /** true = el producto se puede agregar al ticket a `unitPriceCents`. */
  eligible: boolean
  /** Por qué no; `null` = elegible. */
  reason: StaffLineBlockReason | null
  /** Precio staff a pintar. `null` = no hay ninguno que pintar; nunca 0. */
  unitPriceCents: number | null
  /** Precio público (el que se tacha cuando hay precio staff). */
  listUnitPriceCents: number
  /** Motivo listo para pintar (`staffLineMessage`); `null` = elegible. */
  message: string | null
}

/**
 * Qué tope rebasó el carrito, en texto para el operador. El API vuelve a
 * medirlo al cobrar y su mensaje gana: esto sólo evita que el operador se
 * entere después de haber cobrado.
 */
function staffQuotaBlockMessage(view: StaffQuotaView): string | null {
  if (view.units.exceeded) return unitsQuotaMessage(view.units)
  if (view.listAmountCents.exceeded) {
    return `Esta compra pasa el monto de venta a staff del mes (${formatMoney(view.listAmountCents.limit ?? 0)}).`
  }
  const product = view.perProduct.find((p) => p.exceeded)
  if (product) return `Te pasas del tope de ${product.limit} piezas por producto este mes.`
  return null
}

/**
 * Tema del canal de frescura que obliga a volver a pedir el catálogo: el admin
 * publicó un cambio (`posDataChanged` con `kind: CATALOG`) o el gate de versión
 * evictó el catálogo y avisó ([D-028], que barre todos los temas). UNA clase de
 * dato, un cargador ([D-019]): el dinero y las listas no cuelgan de aquí.
 */
const CATALOG_TOPICS: readonly FreshnessTopic[] = ['catalog']

/**
 * Registra la recarga de catálogo en el canal, TOLERANTE a que no haya canal.
 *
 * No usa `useLiveRefresh` a propósito ([D-030]): ése lanza sin provider arriba y
 * `useCheckout` se monta en tests (y en árboles sin `FreshnessGate`) sin canal.
 * Sin canal simplemente no hay registro.
 *
 * NO invoca `load` al montar — la carga inicial del checkout ya existe y tiene
 * su propia política de fetch; esto sólo conecta la pantalla a los avisos. El
 * cargador va por ref para que el registro no dependa de su identidad.
 */
function useCatalogChannel(
  register: FreshnessContextValue['register'] | undefined,
  load: () => Promise<void>,
): void {
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })
  useEffect(() => {
    if (!register) return
    return register(() => loadRef.current(), CATALOG_TOPICS)
  }, [register])
}

/**
 * Arma las cards del grid a partir del catálogo + el stock conocido. Vive
 * fuera del hook porque la usan DOS caminos: la carga inicial y el re-precio
 * tras un rechazo del API — y el segundo tiene que pintar exactamente lo mismo
 * que el primero, no una versión parecida.
 */
function buildCatalogItems(
  services: CatalogService[],
  products: CatalogProduct[],
  combos: CatalogCombo[],
  stockByProductId: Map<string, number | undefined>,
): CatalogItem[] {
  return [
    ...services.map((s) => ({
      id: s.id,
      kind: 'service' as const,
      name: s.name,
      priceCents: s.priceCents,
      imageUrl: s.imageUrl,
      categoryId: s.categoryId,
      sortOrder: s.sortOrder,
      excludedStaffIds: s.excludedStaffIds ?? [],
    })),
    ...products.map((p) => ({
      id: p.id,
      kind: 'product' as const,
      name: p.name,
      priceCents: p.priceCents,
      stockQty: stockByProductId.get(p.id),
      imageUrl: p.imageUrl,
      categoryId: p.categoryId,
      sortOrder: p.sortOrder,
    })),
    ...combos.map((c) => ({
      id: c.id,
      kind: 'combo' as const,
      name: c.name,
      priceCents: c.priceCents,
      imageUrl: c.imageUrl,
      categoryId: c.categoryId,
      sortOrder: c.sortOrder,
      excludedStaffIds: c.excludedStaffIds ?? [],
    })),
  ]
}

export function useCheckout() {
  const [params] = useSearchParams()
  const { checkout, register } = useRepositories()
  const { locationId } = useLocation()
  const { viewer } = usePosAuth()
  const { addToast } = useToast()
  // Canal de frescura leído DIRECTO del contexto (puede ser null), no con
  // `useFreshness()`: ése lanza cuando no hay canal arriba y este hook tiene
  // que poder montarse en un árbol sin `FreshnessGate` ([D-029] / [D-030]).
  // Dos usos: pausar los refrescos mientras el cobro está en vuelo y registrar
  // la recarga de catálogo en el tema `catalog` (ver `useCatalogChannel` abajo).
  const freshness = useContext(FreshnessContext)

  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  // Productos TAL CUAL los devuelve el API (elegibilidad, precio staff y
  // variantes incluidos). `catalogItems` es la card del grid y no los carga: el
  // modo venta a staff necesita el producto completo para resolver el precio
  // de la línea con `staffLineView`, y el re-precio también.
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string; sortOrder: number }>>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  // Tracks whether the initial Promise.all (catalog + barbers + register) has
  // settled — success OR failure. CheckoutPage was conflating "no default
  // barber" with "still loading", so an empty barbers list left the page on
  // the skeleton forever. With this flag the page can show a real empty
  // state once the load is done, regardless of what the backend returned.
  const [loaded, setLoaded] = useState(false)

  const completeWalkInId = params.get('completeWalkInId')
  const completeAppointmentIdParam = params.get('completeAppointmentId')
  const customerIdParam = params.get('customerId')
  const [context, setContext] = useState<CheckoutContext | null>(null)
  // Tracked separately from `context` because the appointment-completion target
  // composes with a preselected customer (via customerId param) — they're not
  // mutually exclusive the way 'walk-in' vs 'preselected-customer' are.
  const [completeAppointmentId, setCompleteAppointmentId] = useState<string | null>(null)

  const [cartState, dispatch] = useReducer(cartReducer, initialCart(viewer?.staff?.id ?? ''))

  // Las líneas del carrito para leerlas DESPUÉS de un await (encender el modo
  // venta a staff espera al cupo, que va siempre a la red): la clausura del
  // render donde se tocó el interruptor no ve lo que el operador agregó
  // mientras el cupo viajaba, y esa línea se quedaría a precio público dentro
  // de un ticket de staff (PRICE_MISMATCH seguro).
  const cartLinesRef = useRef(cartState.lines)
  useEffect(() => {
    cartLinesRef.current = cartState.lines
  }, [cartState.lines])

  // Barbero atendiendo = default barber real de la venta (no el fallback de
  // display). Alimenta TANTO el filtro de exclusión del grid como el overlay de
  // precios por barbero. Null cuando la venta no tiene default → overlay con
  // staffUserId null = precios de sucursal.
  const attendingBarberId = cartState.defaultBarberId || null

  // Overlay de precios por barbero (capa LIVE sobre el catálogo STATIC). El
  // catálogo STATIC (gated por catalogVersion) resuelve el precio UNA vez para
  // el viewer y no reacciona al cambio de atendiendo — el precio de las cards se
  // quedaba congelado en el del viewer. Esta capa re-consulta un query ligero de
  // SOLO precios al cambiar el atendiendo y lo overlayea en el grid.
  //   - priceOverlay: Map<serviceId, {priceCents,isExcluded}> del ÚLTIMO overlay
  //     resuelto (patrón previousData: seguimos mostrando el anterior mientras
  //     llega el nuevo, atenuado, sin flash de skeletons).
  //   - overlayBarberId: a qué barbero corresponde `priceOverlay`. `undefined` =
  //     nunca ha cargado. `overlayFresh` = corresponde al atendiendo actual.
  const [priceOverlay, setPriceOverlay] = useState<Map<string, { priceCents: number; isExcluded: boolean }> | null>(null)
  const [overlayBarberId, setOverlayBarberId] = useState<string | null | undefined>(undefined)
  const [overlayLoading, setOverlayLoading] = useState(false)

  const [registerSessionId, setRegisterSessionId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Rechazo del API del que el POS YA se recuperó y que espera confirmación
  // explícita del operador (spec § 3.5). Distinto de `error`: aquí el carrito
  // cambió y hay que volver a tocar Cobrar.
  const [rejectionNotice, setRejectionNotice] = useState<CheckoutRejectionNotice | null>(null)
  const [successSale, setSuccessSale] = useState<SaleResult | null>(null)

  const [customerResults, setCustomerResults] = useState<Customer[]>([])

  // Estado prepago derivado del appointment.sale cuando el checkout viene
  // desde una cita ("completeAppointmentId" param). Default = "no prepago",
  // que deja el flujo normal de POS intacto. Se refresca con `refetchPrepayState`
  // después de cancelar un link pendiente, para caer en el flujo normal.
  const DEFAULT_PREPAY_STATE: AppointmentPrepayState = {
    isPrepaid: false,
    hasPendingLink: false,
    prepaidSaleId: null,
    prepaidMethod: null,
    prepaidAt: null,
    staffNote: null,
    prepaidItems: [],
    prepaidTotalCents: null,
  }
  const [prepayState, setPrepayState] = useState<AppointmentPrepayState>(DEFAULT_PREPAY_STATE)

  // Cupones aplicados al draft. La fuente de verdad del descuento la calcula
  // el API en cada llamada a applyCouponToDraftSale (server-side); aquí solo
  // mantenemos el "preview" para renderizar los chips + el total descontado
  // local mientras el cajero no cierre la venta.
  const [appliedCoupons, setAppliedCoupons] = useState<AppliedCouponPreview[]>([])
  const [couponError, setCouponError] = useState<string | null>(null)

  /* ── Estado del modo "venta a staff" (spec venta a staff §4.3 / §4.5) ──
   * El interruptor, a quién se le carga la compra, su cupo del mes y el precio
   * staff comiteado por línea. Nada de esto DECIDE: el API vuelve a resolver
   * precio, elegibilidad y topes dentro de la transacción del cobro.
   */
  const [staffSaleEnabled, setStaffSaleEnabledState] = useState(false)
  /** `null` = el comprador es el barbero de la sesión activa. */
  const [staffSaleBuyerId, setStaffSaleBuyerId] = useState<string | null>(null)
  const [staffQuota, setStaffQuota] = useState<StaffSaleQuota | null>(null)
  const [staffSaleLoading, setStaffSaleLoading] = useState(false)
  const [staffSaleError, setStaffSaleError] = useState<string | null>(null)
  const [staffLinePrices, setStaffLinePrices] = useState<Map<string, StaffLinePrice>>(new Map())

  /* ── Publicación al bloqueo automático (spec § 3.3) ──────────────────────
   *
   * El POS se bloquea solo a los 15 s en reposo y a los 90 s con venta en
   * curso (`core/auth/useAutoLock`). Quién cuenta como "venta en curso" lo
   * decide ESTE feature y lo publica en el store de `core/auth/saleActivity`.
   *
   * DERIVADO, no estado nuevo: el carrito tiene al menos un concepto y todavía
   * no llegamos al recibo. Dos precisiones:
   *
   *  - "o la hoja de pago está abierta" (spec) ya queda cubierto: la hoja sólo
   *    se abre desde el CTA de cobrar, que está deshabilitado con el carrito
   *    vacío (`CheckoutPage`), así que abierta ⟹ hay líneas. No subimos ese
   *    `useState` hasta aquí sólo para repetir una condición implicada.
   *  - El RECIBO cuenta como "sin venta en curso" (spec § 3.3.1, decisión del
   *    dueño: no pedir PIN después de cada venta). Al cobrar, el carrito se
   *    vacía Y `successSale` deja de ser null; el segundo término deja la
   *    regla escrita aunque mañana el recibo conserve las líneas en pantalla.
   *    Efecto buscado: quien cobra y se va deja la tablet bloqueándose con el
   *    plazo corto.
   */
  const saleInProgress = cartState.lines.length > 0 && successSale === null

  // Sincronización hacia un sistema EXTERNO a React (el store vive fuera del
  // árbol): éste es exactamente el caso de uso legítimo de `useEffect`. Los
  // setters del store son idempotentes, así que un render de más no notifica
  // a nadie.
  useEffect(() => {
    setSaleInProgress(saleInProgress)
  }, [saleInProgress])

  // Al desmontar el cobro (salir a otro tab, bloqueo, logout) no queda venta
  // en curso: sin esto el POS se quedaría con el plazo largo para siempre.
  useEffect(() => {
    return () => {
      resetSaleActivity()
    }
  }, [])

  /**
   * Cobro en vuelo: publica la bandera que desarma el bloqueo automático y, a
   * la vez, PAUSA el canal de frescura — un refresco a media mutation
   * repintaría y re-preciaría el carrito justo cuando el operador ya no puede
   * reaccionar. Se llama pegado a cada `setSubmitting`, incluido el del
   * `finally`, para que ningún camino de salida (éxito, error o excepción
   * inesperada) deje la tablet sin bloquearse ni el canal pausado.
   *
   * Imperativo y no derivado de `submitting` con un efecto a propósito: el
   * efecto se agenda para después del render y una mutation rápida podría
   * resolverse antes, dejando la pausa sin aplicar nunca.
   */
  const publishSubmitting = (inFlight: boolean) => {
    setSaleSubmitting(inFlight)
    freshness?.setPaused(inFlight)
  }

  // Resolve entry context from query params
  useEffect(() => {
    if (completeWalkInId) {
      setContext({ kind: 'walk-in', walkInId: completeWalkInId })
    } else if (customerIdParam) {
      setContext({ kind: 'preselected-customer', customerId: customerIdParam })
    } else {
      setContext({ kind: 'free' })
    }
    setCompleteAppointmentId(completeAppointmentIdParam)
  }, [completeWalkInId, customerIdParam, completeAppointmentIdParam])

  // Load catalog + barbers + active register session
  useEffect(() => {
    if (!locationId) return
    let cancelled = false
    Promise.all([
      checkout.getServices(locationId, viewer?.staff?.id ?? null),
      checkout.getProducts(locationId),
      checkout.getCombos(),
      checkout.getCategories(),
      // A1: barberos CON estado de turno (hasClockedIn) — el checkout solo deja
      // asignar a los que ya iniciaron su día.
      checkout.getAvailableBarbers(locationId),
      // force:true — stock es LIVE y correctness-critical (riesgo de
      // sobreventa en el display). No confiamos en el cache-first de una
      // venta anterior en este device u otro tablet de la sucursal.
      checkout.getStockLevels(locationId, { force: true }),
      register.getRegisters(locationId),
    ])
      .then(([services, products, combos, cats, brbs, stock, registers]) => {
        if (cancelled) return
        const stockByProductId = new Map<string, number | undefined>(
          stock.map((s) => [s.productId, s.quantity]),
        )
        const items = buildCatalogItems(services, products, combos, stockByProductId)
        setCatalogItems(sortCatalogItems(onlyCategorized(items), cats))
        setProducts(products)
        setCategories(cats)
        setBarbers(brbs)
        const openSessionRegister = registers.find((r) => r.openSession)
        setRegisterSessionId(openSessionRegister?.openSession?.id ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setError('No se pudo cargar el catálogo. Reintenta.')
      })
      .finally(() => {
        if (cancelled) return
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [locationId, viewer?.staff?.id, checkout, register])

  // Overlay de precios: re-consulta el precio por barbero al cambiar el
  // atendiendo. Query ligero (solo precios), cache-first — regresar a un barbero
  // ya consultado es instantáneo. En la carga inicial `overlayBarberId` es
  // `undefined` y el grid usa el precio estático del viewer como arranque; a
  // partir de ahí cada cambio de atendiendo re-resuelve el precio de las cards.
  //
  // SERVICIOS y COMBOS comparten un solo `priceOverlay` (Map id → precio/excl.):
  // los ids no colisionan (entidades distintas) y el grid resuelve el precio de
  // display de forma agnóstica al kind. Traemos ambos en paralelo (queries
  // hermanas) y los fusionamos; un solo `overlayBarberId` describe a qué barbero
  // corresponde el overlay completo (ambas queries se resuelven para el mismo
  // atendiendo, así que un solo tracking es correcto).
  useEffect(() => {
    if (!locationId) return
    let cancelled = false
    setOverlayLoading(true)
    Promise.all([
      checkout.getServicePricing(locationId, attendingBarberId),
      checkout.getComboPricing(locationId, attendingBarberId),
    ])
      .then(([serviceRows, comboRows]) => {
        if (cancelled) return
        const merged = new Map<string, { priceCents: number; isExcluded: boolean }>()
        for (const r of serviceRows) merged.set(r.id, { priceCents: r.priceCents, isExcluded: r.isExcluded })
        for (const r of comboRows) merged.set(r.id, { priceCents: r.priceCents, isExcluded: r.isExcluded })
        setPriceOverlay(merged)
        setOverlayBarberId(attendingBarberId)
      })
      .catch(() => {
        // Silencioso: si el overlay falla conservamos el previo (o el estático)
        // — no es correctness-critical porque el API valida el precio al cobrar.
      })
      .finally(() => {
        if (!cancelled) setOverlayLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [locationId, attendingBarberId, checkout])

  // Pre-fill customer/barber/services based on context.
  //
  // Gated on `loaded` (catalog + posAvailableBarbers settled) so the barber
  // availability check below always reads a populated `barbers` snapshot —
  // CheckoutPage shows the loading skeleton until `loaded` is true
  // regardless, so delaying this until then has no visible cost.
  useEffect(() => {
    if (!context || !locationId || !loaded) return
    if (context.kind === 'walk-in') {
      checkout.getWalkIn(context.walkInId, locationId).then(async (w) => {
        if (w?.customer) {
          dispatch({
            type: 'setCustomer',
            customer: {
              id: w.customer.id,
              fullName: w.customer.fullName,
              reputationTag: w.customer.reputationTag ?? null,
            },
          })
        }
        // A1: solo pre-llenar el barbero default si sigue con turno
        // iniciado. Un walk-in pudo asignarse hace rato — si ese barbero ya
        // fichó salida, prefilearlo violaría el gate "solo cobrar
        // acreditando a barberos con turno activo". Dejamos el default sin
        // tocar, forzando al cajero a elegir explícitamente en el picker
        // (que ya oculta/bloquea a los barberos sin turno).
        if (w?.assignedStaffUser?.id) {
          const assignedId = w.assignedStaffUser.id
          const isAvailable = barbers.some((b) => b.id === assignedId && b.hasClockedIn !== false)
          if (isAvailable) {
            dispatch({ type: 'setDefaultBarber', staffUserId: assignedId })
          }
        }
        // Multi-servicio: pre-llenar el carrito con los servicios que el
        // cliente pidió al registrarse. Si después cambió de opinión, el
        // cajero los quita y agrega otros. Ahorra ~5-10s por venta.
        if (w?.requestedServices && w.requestedServices.length > 0) {
          // El barbero asignado (si sigue disponible) define el precio de la
          // línea: staff > sucursal > base. Sin barbero: sucursal > base.
          // Nunca base directo — ese fue el bug de prod (línea cobraba $200
          // cuando el override de sucursal/barbero era $280/$350).
          const assignedId = w.assignedStaffUser?.id ?? null
          const priceStaffId =
            assignedId && barbers.some((b) => b.id === assignedId && b.hasClockedIn !== false)
              ? assignedId
              : null
          const assignedBarberName =
            barbers.find((b) => b.id === priceStaffId)?.fullName ?? 'El barbero asignado'
          for (const svc of w.requestedServices) {
            const lineId = crypto.randomUUID()
            let unitPriceCents = svc.basePriceCents ?? 0
            let excludedForAssigned = false
            try {
              const resolved = await checkout.resolveServicePriceForBarber(svc.id, locationId, priceStaffId)
              if (resolved.isExcluded && priceStaffId) {
                // El barbero asignado NO realiza este servicio (override con
                // isExcluded=true → priceCents=0). En vez de prellenar la línea
                // en $0 acreditando a ese barbero, la agregamos SIN barbero y
                // con el precio de sucursal (re-resuelto con staff=null, que no
                // puede estar excluido), y avisamos al cajero.
                excludedForAssigned = true
                const locPrice = await checkout.resolveServicePriceForBarber(svc.id, locationId, null)
                unitPriceCents = locPrice.priceCents
              } else {
                unitPriceCents = resolved.priceCents
              }
            } catch (err) {
              // Fallback a base solo si la resolución truena (raro). El API
              // rechazará ese precio si difiere del resuelto, y el cajero
              // puede quitar/re-agregar la línea.
              // eslint-disable-next-line no-console
              console.error('[prefill] failed to resolve price', { serviceId: svc.id, priceStaffId, err })
            }
            dispatch({
              type: 'add',
              lineId,
              item: {
                kind: 'service',
                itemId: svc.id,
                name: svc.name,
                unitPriceCents,
                categoryId: svc.categoryId ?? null,
              },
            })
            if (excludedForAssigned) {
              // La línea entró con el barbero default (assignedId) vía el
              // reducer; lo limpiamos para no dejar acreditado a un barbero que
              // no ofrece el servicio. El cajero elige otro en el picker.
              dispatch({ type: 'clearLineBarber', lineId })
              addToast(`${assignedBarberName} no ofrece ${svc.name}. Elige otro barbero.`, 'error')
            }
          }
        }
      })
    } else if (context.kind === 'preselected-customer') {
      checkout.getCustomer(context.customerId).then((c) => {
        if (c) {
          dispatch({
            type: 'setCustomer',
            customer: { id: c.id, fullName: c.fullName, reputationTag: c.reputationTag ?? null },
          })
        }
      })
    }
  }, [context, checkout, locationId, loaded, barbers, addToast])

  // Load prepay state for the appointment-completion entry. When there's no
  // appointment id (free sale / walk-in / preselected-customer), reset to the
  // default state so the normal flow runs.
  const refetchPrepayState = useCallback(async () => {
    if (!completeAppointmentId) {
      setPrepayState(DEFAULT_PREPAY_STATE)
      return
    }
    try {
      const state = await checkout.getAppointmentPrepayState(completeAppointmentId)
      setPrepayState(state)
    } catch {
      // Si la lectura falla no bloqueamos el checkout — el cajero puede seguir
      // el flujo normal. El error queda en consola en dev vía Apollo.
      setPrepayState(DEFAULT_PREPAY_STATE)
    }
    // DEFAULT_PREPAY_STATE is a stable literal, safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout, completeAppointmentId])

  useEffect(() => {
    void refetchPrepayState()
  }, [refetchPrepayState])

  // Mapea las líneas del carrito al shape DraftSaleItemInput esperado por
  // applyCoupon/removeCoupon. Combos no participan en cupones (Phase 1) —
  // se omiten de la lista, lo cual cambia el monto descontable. Si en el
  // futuro habilitamos cupones sobre combos, hay que expandir el combo a
  // sus items individuales o aceptar combos como su propia categoría.
  const buildDraftItems = useCallback((): DraftSaleItemArg[] => {
    return cartState.lines
      .filter((l) => l.kind === 'service' || l.kind === 'product')
      .map((l) => ({
        serviceId: l.kind === 'service' ? l.itemId : null,
        productId: l.kind === 'product' ? l.itemId : null,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
      }))
  }, [cartState.lines])

  const applyCoupon = useCallback(async (code: string) => {
    // Un ticket de venta a staff no admite cupones (spec §4.3.5). El bloque de
    // cupones queda deshabilitado en la UI; si aun así llega un código, se
    // avisa aquí en vez de gastar un round trip que el cobro rechazaría.
    if (staffSaleEnabled) {
      setCouponError(STAFF_SALE_MESSAGE.noCoupons)
      return
    }
    const trimmed = code.trim()
    if (!trimmed) {
      setCouponError('Escribe un código de cupón.')
      return
    }
    setCouponError(null)
    try {
      const result = await checkout.applyCoupon({
        code: trimmed,
        items: buildDraftItems(),
        customerId: cartState.customer?.id ?? null,
        existingAppliedCouponCodes: appliedCoupons.map((c) => c.code),
      })
      if (!result) {
        setCouponError('No se pudo validar el cupón. Reintenta.')
        return
      }
      if (result.validationError) {
        setCouponError(result.validationError.message)
        return
      }
      setAppliedCoupons(
        result.appliedCoupons.map((c) => ({
          code: c.code,
          name: c.name,
          scope: c.scope,
          discountAmountCents: c.discountAmountCents,
          rule: c.rule,
        })),
      )
    } catch (e) {
      setCouponError((e as { message?: string }).message ?? 'No se pudo validar el cupón.')
    }
  }, [appliedCoupons, buildDraftItems, cartState.customer, checkout, staffSaleEnabled])

  const removeCoupon = useCallback(async (code: string) => {
    setCouponError(null)
    const remaining = appliedCoupons.filter((c) => c.code !== code).map((c) => c.code)
    try {
      const result = await checkout.removeCoupon({
        code,
        items: buildDraftItems(),
        customerId: cartState.customer?.id ?? null,
        remainingAppliedCouponCodes: remaining,
      })
      if (!result) {
        // Fallback optimista: si el API no devuelve nada, removemos local.
        // Esto evita dejar un cupón "stuck" en el chip si la red falla.
        setAppliedCoupons((prev) => prev.filter((c) => c.code !== code))
        return
      }
      setAppliedCoupons(
        result.appliedCoupons.map((c) => ({
          code: c.code,
          name: c.name,
          scope: c.scope,
          discountAmountCents: c.discountAmountCents,
          rule: c.rule,
        })),
      )
    } catch {
      // Mismo fallback optimista — el cajero pidió quitar el cupón, hay que
      // honrar la intención aunque el API no responda.
      setAppliedCoupons((prev) => prev.filter((c) => c.code !== code))
    }
  }, [appliedCoupons, buildDraftItems, cartState.customer, checkout])

  // Recompute LOCAL del descuento cuando cambia el carrito. La regla cruda
  // del cupón viaja con el preview (rule.type, scope, targets, etc.); con
  // eso podemos calcular el nuevo discountAmountCents sin volver al backend.
  // El backend SIGUE siendo source of truth — en submit recomputa con la
  // misma math y rechaza si intentamos sobre-descontar.
  //
  // Antes: cada cambio del carrito disparaba N round trips secuenciales
  // (uno por cupón) → ~300-600ms de lag perceptible. Ahora 0ms.
  const itemsKey = JSON.stringify(
    cartState.lines.map((l) => `${l.kind}:${l.itemId}:${l.qty}:${l.unitPriceCents}:${l.categoryId ?? ''}`),
  )
  const prevItemsKeyRef = useRef(itemsKey)
  useEffect(() => {
    if (prevItemsKeyRef.current === itemsKey) return
    prevItemsKeyRef.current = itemsKey
    if (appliedCoupons.length === 0) return

    const items = cartLinesToDiscountItems(cartState.lines)
    const result = recomputeAppliedCoupons(appliedCoupons, items)
    setAppliedCoupons(result.appliedCoupons)
    if (result.droppedCodes.length > 0) {
      setCouponError(
        result.droppedCodes.length === 1
          ? `Cupón ${result.droppedCodes[0]} ya no aplica al carrito actual.`
          : `Cupones ${result.droppedCodes.join(', ')} ya no aplican al carrito actual.`,
      )
    } else {
      setCouponError(null)
    }
  }, [itemsKey, appliedCoupons, cartState.lines])

  const discountTotalCents = appliedCoupons.reduce((s, c) => s + c.discountAmountCents, 0)

  /* ── Venta a staff (spec venta a staff §4.3 y §4.5) ──────────────────────
   *
   * Modo de COBRO, no un cupón: la barbería le vende productos a un barbero a
   * precio staff, con su cupo del mes. Todo lo de aquí es para no cobrar algo
   * que el API vaya a rechazar — precio, elegibilidad y topes los vuelve a
   * medir `createPOSSale` en su transacción (handoff T-030) y su texto gana.
   */

  const permissions = viewer?.permissions
  /** Sin ninguno de los dos permisos el interruptor ni se ofrece (spec §5). */
  const canSellToStaff =
    permissions?.includes(STAFF_SALE_CREATE) === true ||
    permissions?.includes(STAFF_SALE_CREATE_FOR_OTHERS) === true
  /** Cobrarle la compra a OTRO barbero (recepción) exige su propio permiso. */
  const canSellToOtherStaff = permissions?.includes(STAFF_SALE_CREATE_FOR_OTHERS) === true
  // Comprador por default: el barbero de la SESIÓN ACTIVA (spec §4.5, [D-012]:
  // la sesión define a quién se le carga la compra, no el atendiendo).
  const staffSaleBuyerStaffUserId = staffSaleBuyerId ?? viewer?.staff?.id ?? null

  /**
   * Fija el precio de UNA línea. El reducer del carrito no tiene acción de
   * "solo precio" (la única que toca `unitPriceCents` lleva barbero), así que
   * una línea sin barbero comitea el precio y limpia el barbero en el mismo
   * tick — React agrupa ambos dispatch y el estado intermedio no se renderiza.
   * Compartida por el modo venta a staff y por el re-precio tras un rechazo:
   * las dos tienen que aterrizar el precio de la MISMA forma.
   */
  const commitLinePrice = (line: CartLine, unitPriceCents: number, clearBarber = false) => {
    if (unitPriceCents === line.unitPriceCents && !clearBarber) return
    if (line.staffUserId && !clearBarber) {
      dispatch({ type: 'setLineBarberAndPrice', lineId: line.id, staffUserId: line.staffUserId, unitPriceCents })
      return
    }
    dispatch({ type: 'setLineBarberAndPrice', lineId: line.id, staffUserId: line.staffUserId ?? '', unitPriceCents })
    dispatch({ type: 'clearLineBarber', lineId: line.id })
  }

  /**
   * Cupo del mes del comprador. SIEMPRE a la red (el repositorio no acepta
   * política de caché, [D-017]): es un cupo compartido entre iPads y
   * sucursales. El contador de secuencia descarta una respuesta vieja cuando
   * el operador cambió de comprador mientras ésta viajaba.
   */
  const staffQuotaSeqRef = useRef(0)
  const loadStaffQuota = async (buyerStaffUserId: string | null): Promise<StaffSaleQuota | null> => {
    if (!locationId) return null
    const seq = ++staffQuotaSeqRef.current
    setStaffSaleLoading(true)
    try {
      const quota = await checkout.getStaffSaleQuota(locationId, buyerStaffUserId)
      if (seq !== staffQuotaSeqRef.current) return null
      setStaffQuota(quota)
      return quota
    } catch {
      if (seq !== staffQuotaSeqRef.current) return null
      // Sin cupo no se muestra un número viejo ni se inventa uno ([D-020]): el
      // modo se queda como está y el operador ve por qué.
      setStaffQuota(null)
      setStaffSaleError(STAFF_SALE_MESSAGE.quotaUnavailable)
      return null
    } finally {
      if (seq === staffQuotaSeqRef.current) setStaffSaleLoading(false)
    }
  }

  /**
   * Pasa las líneas de PRODUCTO a precio staff. Una línea que no se puede
   * preciar (no elegible, o falta elegir presentación) NO se convierte y se
   * queda sin marca staff: eso la deja bloqueando el cobro con su motivo, en
   * vez de mandarla a precio público dentro de un ticket de staff ([D-042]:
   * nunca un precio staff que no se pueda cobrar).
   */
  const applyStaffPricesToCart = (catalogProducts: CatalogProduct[]) => {
    const byId = new Map(catalogProducts.map((p) => [p.id, p]))
    const priced = new Map<string, StaffLinePrice>()
    for (const line of cartLinesRef.current) {
      if (line.kind !== 'product') continue
      const product = byId.get(line.itemId)
      if (!product) continue
      const view = staffLineView(product, null)
      if (!view.eligible || view.unitPriceCents === null) continue
      priced.set(line.id, { listUnitPriceCents: view.listUnitPriceCents, productVariantId: null })
      commitLinePrice(line, view.unitPriceCents)
    }
    setStaffLinePrices(priced)
  }

  /** Apaga el modo: cada línea vuelve a su precio público congelado. */
  const disableStaffSale = () => {
    setStaffSaleEnabledState(false)
    setStaffSaleError(null)
    for (const line of cartLinesRef.current) {
      const staff = staffLinePrices.get(line.id)
      if (staff) commitLinePrice(line, staff.listUnitPriceCents)
    }
    setStaffLinePrices(new Map())
  }

  /**
   * Interruptor "Venta a staff". Encenderlo pide el cupo ANTES de tocar nada:
   * con la política apagada (`quota.enabled === false`) el modo no se activa
   * (spec §4.3.1) y con el cupo ilegible tampoco. Ya encendido: fuera cupones
   * (§4.3.5) y las líneas de producto pasan a precio staff.
   */
  const setStaffSaleEnabled = async (next: boolean): Promise<void> => {
    if (next === staffSaleEnabled) return
    if (!next) {
      disableStaffSale()
      return
    }
    if (!canSellToStaff) return
    setStaffSaleError(null)
    const quota = await loadStaffQuota(staffSaleBuyerStaffUserId)
    if (!quota) return
    if (!quota.enabled) {
      setStaffSaleError(STAFF_SALE_MESSAGE.disabled)
      return
    }
    setStaffSaleEnabledState(true)
    setAppliedCoupons([])
    setCouponError(null)
    applyStaffPricesToCart(products)
  }

  /**
   * A quién se le carga la compra. El barbero sólo compra para sí mismo; pedir
   * otro comprador exige `create_for_others` y, sin él, el cambio se IGNORA
   * (no es un error del operador: es que ese botón no existe para él). El cupo
   * es por comprador, así que cambiarlo lo vuelve a pedir.
   */
  const setStaffSaleBuyer = async (staffUserId: string): Promise<void> => {
    if (!canSellToStaff) return
    if (staffUserId !== viewer?.staff?.id && !canSellToOtherStaff) return
    if (staffUserId === staffSaleBuyerStaffUserId) return
    setStaffSaleBuyerId(staffUserId)
    if (!staffSaleEnabled) return
    await loadStaffQuota(staffUserId)
  }

  /**
   * Elige la presentación de una línea de producto y la precia con el precio
   * staff de ESA variante, congelando su precio público. Es lo que desbloquea
   * una línea con `NEEDS_VARIANT`: sin variante el API rechaza el cobro
   * (`STAFF_SALE_VARIANT_REQUIRED`).
   */
  const setStaffSaleLineVariant = (lineId: string, productVariantId: string) => {
    if (!staffSaleEnabled) return
    const line = cartState.lines.find((l) => l.id === lineId)
    if (!line || line.kind !== 'product') return
    const product = products.find((p) => p.id === line.itemId)
    if (!product) return
    const view = staffLineView(product, productVariantId)
    if (!view.eligible || view.unitPriceCents === null) {
      // Esa presentación no se vende a staff: la línea PIERDE su precio staff
      // (y por lo tanto bloquea el cobro con su motivo). Soltar la entrada del
      // mapa sin revertir el precio dejaría la línea a precio staff dentro de
      // una venta normal en cuanto se apagara el modo —`disableStaffSale` sólo
      // revierte las que SIGUEN en el mapa—, así que primero se comitea de
      // vuelta el precio público congelado de esa entrada, por el mismo camino
      // que usa el apagado ([D-042]: nada de precios que el API va a rechazar).
      const staff = staffLinePrices.get(lineId)
      if (staff) commitLinePrice(line, staff.listUnitPriceCents)
      setStaffLinePrices((prev) => {
        const next = new Map(prev)
        next.delete(lineId)
        return next
      })
      return
    }
    setStaffLinePrices((prev) =>
      new Map(prev).set(lineId, { listUnitPriceCents: view.listUnitPriceCents, productVariantId }),
    )
    commitLinePrice(line, view.unitPriceCents)
  }

  /**
   * Lo que el modo venta a staff ve del carrito: qué línea ya tiene precio
   * staff, qué le falta a las demás, el descuento del ticket y el cupo
   * contrastado contra lo que se está por cobrar. Más `catalogViews`, que es
   * lo mismo pero del GRID: una vista por producto del catálogo para pintar el
   * precio staff y marcar a los no elegibles antes de tocar nada. Derivado en
   * render (nada de efectos): cambia con el carrito, el catálogo y el cupo.
   */
  const staffSale = useMemo(() => {
    const base = {
      available: canSellToStaff,
      canSellForOthers: canSellToOtherStaff,
      enabled: staffSaleEnabled,
      buyerStaffUserId: staffSaleBuyerStaffUserId,
      loading: staffSaleLoading,
      error: staffSaleError,
      quota: staffQuota,
    }
    if (!staffSaleEnabled) {
      return {
        ...base,
        lines: [] as StaffSaleCartLine[],
        // Sin modo no hay nada que pintar en el grid: el mapa va vacío y el
        // catálogo ni se recorre.
        catalogViews: new Map<string, StaffCatalogView>(),
        summary: null as StaffCartSummary | null,
        quotaView: null as StaffQuotaView | null,
        canCharge: true,
        blockMessage: null as string | null,
      }
    }
    const byId = new Map(products.map((p) => [p.id, p]))
    // Una vista por producto del catálogo, SIN presentación elegida: es lo que
    // el grid necesita para pintar el precio staff y marcar a los no elegibles
    // ([D-042]: sin precio resuelto, `unitPriceCents` es null y el tile pinta
    // el motivo, jamás un precio aproximado). Display, no decisión: el API
    // revalida al cobrar.
    const catalogViews = new Map<string, StaffCatalogView>()
    for (const product of products) {
      const productView = staffLineView(product, null)
      catalogViews.set(product.id, {
        eligible: productView.eligible,
        reason: productView.reason ?? null,
        unitPriceCents: productView.unitPriceCents,
        listUnitPriceCents: productView.listUnitPriceCents,
        message: staffLineMessage(productView),
      })
    }
    // Forma que consume `lib/staff-sale`: la marca de línea staff es
    // `listUnitPriceCents` y nada más ([D-041]).
    const summaryLines: StaffSummaryLine[] = cartState.lines.map((l) => ({
      kind: l.kind,
      itemId: l.itemId,
      qty: l.qty,
      unitPriceCents: l.unitPriceCents,
      listUnitPriceCents: staffLinePrices.get(l.id)?.listUnitPriceCents ?? null,
    }))
    const lines: StaffSaleCartLine[] = cartState.lines
      .filter((l) => l.kind === 'product')
      .map((line) => {
        const staff = staffLinePrices.get(line.id) ?? null
        const product = byId.get(line.itemId)
        const view = product ? staffLineView(product, staff?.productVariantId ?? null) : null
        // Con precio staff comiteado la línea está lista; si no, el motivo sale
        // del catálogo de HOY (y sin producto en el catálogo no hay precio
        // staff que resolver: tampoco se puede cobrar).
        const blockReason: StaffLineBlockReason | null = staff ? null : (view?.reason ?? 'NOT_ELIGIBLE')
        return {
          lineId: line.id,
          productId: line.itemId,
          name: line.name,
          qty: line.qty,
          unitPriceCents: line.unitPriceCents,
          listUnitPriceCents: staff?.listUnitPriceCents ?? null,
          productVariantId: staff?.productVariantId ?? null,
          blockReason,
          blockMessage: blockReason ? STAFF_SALE_MESSAGES[blockReason] : null,
        }
      })
    const view = staffQuota ? quotaView(staffQuota, summaryLines) : null
    const servicesBlocked =
      staffQuota?.allowServicesInTicket === false && cartState.lines.some((l) => l.kind !== 'product')
    const blockedLine = lines.find((l) => l.blockMessage !== null)
    // Lo que impide cobrar, en orden: la línea que no se puede preciar, el
    // servicio que esta política no admite, la política apagada, el cupo que no
    // se pudo leer y el tope rebasado. `null` = se puede cobrar (y el API
    // revalida igual).
    const blockMessage = ((): string | null => {
      if (blockedLine) return blockedLine.blockMessage
      if (servicesBlocked) return STAFF_SALE_MESSAGE.noServices
      // La política se evalúa en CADA lectura del cupo, no sólo al encender
      // ([D-055]): un cupo releído con el modo ya activo (cambió el comprador,
      // o el admin apagó la política entre el encendido y el cobro) puede
      // llegar con `enabled: false`. El modo sigue prendido, pero el cobro se
      // bloquea aquí — el API lo rechazaría igual.
      if (staffQuota?.enabled === false) return STAFF_SALE_MESSAGE.disabled
      if (view === null) return STAFF_SALE_MESSAGE.quotaUnavailable
      if (view.exceeded) return staffQuotaBlockMessage(view) ?? STAFF_SALE_MESSAGE.quotaExceeded
      return null
    })()
    return {
      ...base,
      lines,
      catalogViews,
      summary: staffCartSummary(summaryLines),
      quotaView: view,
      canCharge: blockMessage === null,
      blockMessage,
    }
  }, [
    canSellToStaff,
    canSellToOtherStaff,
    cartState.lines,
    products,
    staffLinePrices,
    staffQuota,
    staffSaleBuyerStaffUserId,
    staffSaleEnabled,
    staffSaleError,
    staffSaleLoading,
  ])

  // Debounce de la búsqueda: sin esto, teclear "john" disparaba 1 request por
  // tecla (4 round trips). Con 280ms agrupamos las pulsaciones en 1 sola
  // llamada. La búsqueda sigue network-only (es dato vivo) — solo evitamos el
  // spam. Guard de <2 chars antes de agendar (el repo igual corta, pero así ni
  // siquiera programamos el timeout).
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [])

  const searchCustomers = useCallback(
    (query: string) => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
      if (query.trim().length < 2) {
        setCustomerResults([])
        return
      }
      searchDebounceRef.current = setTimeout(() => {
        void checkout.searchCustomers(query).then(setCustomerResults)
      }, 280)
    },
    [checkout],
  )

  const createCustomer = async (input: { fullName: string; phone?: string; email?: string }) => {
    return await checkout.findOrCreateCustomer(
      input.fullName,
      input.email ?? null,
      input.phone ?? null,
    )
  }

  /* ── Puesta al día del catálogo ───────────────────────────────────────────
   *
   * Dos disparadores, UNA sola forma de volver a pedir el catálogo: el aviso
   * del canal en el tema `catalog` (el admin publicó) y la recuperación de un
   * rechazo del API por precio viejo. Lo que los separa es el carrito: el
   * aviso sólo repinta grid y overlay; el rechazo además re-precia las líneas.
   */

  /**
   * Tira el catálogo cacheado y vuelve a pedir A LA RED servicios, productos,
   * combos y el overlay de precios del barbero ATENDIENDO, repintando grid y
   * overlay. NO toca el carrito: re-preciar una línea exige confirmación
   * explícita del operador ([D-035]) y sólo ocurre por `repriceCartLines`.
   *
   * El evict es obligatorio en los dos caminos que la usan: `getServices` /
   * `getProducts` / `getCombos` son cache-first, así que sin tirar el catálogo
   * cacheado devolverían exactamente los precios viejos (los que el servidor
   * acaba de rechazar, o los que el admin acaba de cambiar).
   *
   * Devuelve lo que trajo para quien tenga que seguir trabajando con ello.
   * Rechaza si alguna lectura falla (contrato del canal: un cargador que traga
   * el error movería la hora de "Actualizado HH:MM" sin datos nuevos).
   */
  const refetchCatalogAndOverlay = async (
    locId: string,
  ): Promise<{
    products: CatalogProduct[]
    overlay: Map<string, { priceCents: number; isExcluded: boolean }>
  }> => {
    checkout.evictCatalogCache()
    const [services, products, combos, servicePricing, comboPricing] = await Promise.all([
      checkout.getServices(locId, viewer?.staff?.id ?? null),
      checkout.getProducts(locId),
      checkout.getCombos(),
      checkout.getServicePricing(locId, attendingBarberId, { force: true }),
      checkout.getComboPricing(locId, attendingBarberId, { force: true }),
    ])
    const overlay = new Map<string, { priceCents: number; isExcluded: boolean }>()
    for (const r of servicePricing) overlay.set(r.id, { priceCents: r.priceCents, isExcluded: r.isExcluded })
    for (const r of comboPricing) overlay.set(r.id, { priceCents: r.priceCents, isExcluded: r.isExcluded })
    setProducts(products)
    setPriceOverlay(overlay)
    setOverlayBarberId(attendingBarberId)
    // El grid también tiene que mostrar el precio nuevo: si no, el operador
    // vuelve a agregar el viejo y el API lo rechaza otra vez. El stock que ya
    // conocemos se conserva (este camino no lo re-consulta).
    setCatalogItems((prev) => {
      const stockByProductId = new Map<string, number | undefined>(
        prev.filter((i) => i.kind === 'product').map((i) => [i.id, i.stockQty]),
      )
      return sortCatalogItems(
        onlyCategorized(buildCatalogItems(services, products, combos, stockByProductId)),
        categories,
      )
    })
    return { products, overlay }
  }

  /**
   * Lo que corre cuando el canal avisa del tema `catalog` (el admin publicó, o
   * el gate de versión evictó y avisó, § 3.4): el grid y el overlay de precios
   * se ponen al día EN ESTA MISMA VISITA, sin esperar a la siguiente entrada.
   *
   * Deliberadamente NO re-precia las líneas del carrito: un cambio de precio de
   * algo ya capturado se confirma con el operador ([D-035] / spec § 3.5), y esa
   * ruta es `repriceCartLines`, que sólo dispara un rechazo del API. Si el
   * catálogo nuevo ya no trae un item de una línea, la línea se queda tal cual:
   * el API la rechazará al cobrar y la recuperación la atenderá con su aviso.
   *
   * La pausa durante el cobro no se maneja aquí: el motor del canal no entrega
   * avisos con `setPaused(true)` ([D-008]).
   */
  const loadCatalogFromChannel = (): Promise<void> => {
    if (!locationId) return Promise.resolve()
    return refetchCatalogAndOverlay(locationId).then(() => undefined)
  }

  useCatalogChannel(freshness?.register, loadCatalogFromChannel)

  /* ── Recuperación de un rechazo del servidor por datos viejos (§ 3.5) ─────
   *
   * Principio P5: el servidor decide al cobrar y un rechazo por datos viejos
   * se recupera solo — nunca es un callejón sin salida. En los cuatro casos el
   * CARRITO SE CONSERVA; lo que cambia es el dato que estaba viejo. El POS no
   * reintenta el cobro por su cuenta: re-precia/recarga y deja el aviso, y
   * cobrar vuelve a exigir un toque del operador.
   */

  /**
   * Tira el catálogo cacheado, vuelve a pedir precios (force) y RE-PRECIA cada
   * línea del carrito con el precio del barbero de ESA línea — la misma ruta
   * única de precio que usa el picker, nunca una cuenta propia. Devuelve el
   * total nuevo del carrito.
   */
  const repriceCartLines = async (locId: string): Promise<number> => {
    const { products, overlay } = await refetchCatalogAndOverlay(locId)

    const productPriceById = new Map(products.map((p) => [p.id, p.priceCents]))
    const lines = cartState.lines
    const repriced = await Promise.all(
      lines.map(async (line): Promise<RepricedLine> => {
        if (line.kind === 'product') {
          const staff = staffLinePrices.get(line.id)
          if (staffSaleEnabled && staff) {
            // Línea de venta a staff: se re-precia con el precio staff de SU
            // variante y se refresca el precio público congelado de ESA misma
            // variante ([D-036]: una sola ruta de precio por línea). Nunca se
            // convierte en silencio a precio público ni ignora la presentación.
            const product = products.find((p) => p.id === line.itemId)
            const view = product ? staffLineView(product, staff.productVariantId) : null
            if (view?.eligible && view.unitPriceCents !== null) {
              return {
                priceCents: view.unitPriceCents,
                clearBarber: false,
                staff: {
                  listUnitPriceCents: view.listUnitPriceCents,
                  productVariantId: staff.productVariantId,
                },
              }
            }
            // El admin la sacó de la venta a staff (o le quitó el precio): la
            // línea PIERDE la marca staff, lo que bloquea el cobro con el
            // motivo, y vuelve a su precio público CONGELADO — conservar el
            // precio staff la dejaría cobrándose a precio staff dentro de una
            // venta normal en cuanto se apagara el modo (`disableStaffSale`
            // sólo revierte las líneas que siguen en el mapa), y el API la
            // rechazaría por PRICE_MISMATCH ([D-042]).
            return { priceCents: staff.listUnitPriceCents, clearBarber: false, staff: null }
          }
          return {
            priceCents: productPriceById.get(line.itemId) ?? line.unitPriceCents,
            clearBarber: false,
            staff: null,
          }
        }
        const lineBarberId = line.staffUserId || cartState.defaultBarberId || null
        // El overlay ya trae el precio de ESTE barbero cuando es el atendiendo;
        // para los demás se resuelve línea por línea (barbero > sucursal > base).
        const fromOverlay = lineBarberId === attendingBarberId ? overlay.get(line.itemId) : undefined
        if (fromOverlay && !fromOverlay.isExcluded) {
          return { priceCents: fromOverlay.priceCents, clearBarber: false, staff: null }
        }
        try {
          const resolved =
            line.kind === 'combo'
              ? await checkout.resolveComboPriceForBarber(line.itemId, locId, lineBarberId)
              : await checkout.resolveServicePriceForBarber(line.itemId, locId, lineBarberId)
          if (!resolved.isExcluded) return { priceCents: resolved.priceCents, clearBarber: false, staff: null }
          // Ese barbero ya no ofrece el item (el override vale $0 y NUNCA se
          // comitea): la línea se queda sin barbero, a precio de sucursal, y
          // el operador elige otro en el picker. Mismo criterio que
          // `resolveAndCommitLinePrice` y que el prefill de walk-in.
          const atLocation =
            line.kind === 'combo'
              ? await checkout.resolveComboPriceForBarber(line.itemId, locId, null)
              : await checkout.resolveServicePriceForBarber(line.itemId, locId, null)
          return { priceCents: atLocation.priceCents, clearBarber: true, staff: null }
        } catch {
          // Una resolución que truena no puede borrar el carrito: la línea
          // conserva su precio y el API volverá a rechazarla si sigue mal.
          return { priceCents: line.unitPriceCents, clearBarber: false, staff: null }
        }
      }),
    )
    lines.forEach((line, idx) => {
      const { priceCents, clearBarber } = repriced[idx]
      commitLinePrice(line, priceCents, clearBarber)
    })
    if (staffSaleEnabled) {
      // El precio público congelado se mueve con el re-precio: si no, el
      // descuento staff del reporte y el tope de monto quedarían medidos
      // contra un precio que ya no existe.
      setStaffLinePrices((prev) => {
        const next = new Map(prev)
        lines.forEach((line, idx) => {
          const staff = repriced[idx].staff
          if (staff) next.set(line.id, staff)
          else next.delete(line.id)
        })
        return next
      })
    }
    return lines.reduce((sum, line, idx) => sum + repriced[idx].priceCents * line.qty, 0)
  }

  /**
   * Vuelve a leer las existencias (siempre de la red) y marca qué productos
   * del carrito no alcanzan. Agrega por producto igual que el API: el mismo
   * producto puede venir en varias líneas.
   */
  const reloadStockAndFindShortages = async (locId: string): Promise<CheckoutStockShortage[]> => {
    const levels = await checkout.getStockLevels(locId, { force: true })
    const availableByProductId = new Map(levels.map((l) => [l.productId, l.quantity]))
    setCatalogItems((prev) =>
      prev.map((i) => (i.kind === 'product' ? { ...i, stockQty: availableByProductId.get(i.id) } : i)),
    )
    const requestedByProductId = new Map<string, { name: string; qty: number }>()
    for (const line of cartState.lines) {
      if (line.kind !== 'product') continue
      const prev = requestedByProductId.get(line.itemId)
      requestedByProductId.set(line.itemId, { name: line.name, qty: (prev?.qty ?? 0) + line.qty })
    }
    const shortages: CheckoutStockShortage[] = []
    for (const [productId, requested] of requestedByProductId) {
      const availableQty = availableByProductId.get(productId) ?? 0
      if (availableQty < requested.qty) {
        shortages.push({ productId, name: requested.name, availableQty, requestedQty: requested.qty })
      }
    }
    return shortages
  }

  /**
   * Caja de un día anterior: vuelve a leer la caja de la sucursal (por si otra
   * tablet ya hizo el corte) y avisa al canal de frescura, que refresca el
   * tema `register` junto con los demás ([D-028]: el canal todavía no expone
   * disparo por tema). El bloqueo de "corte pendiente" del shell
   * (`useCajaGate`) no escucha el canal todavía, así que mientras tanto el
   * aviso del cobro es el que dice qué hacer.
   */
  const refreshRegisterSession = async (locId: string): Promise<void> => {
    try {
      const registers = await register.getRegisters(locId)
      setRegisterSessionId(registers.find((r) => r.openSession)?.openSession?.id ?? null)
    } catch {
      /* best-effort: el aviso ya dice que hay que hacer el corte */
    }
    freshness?.refreshAll()
  }

  /**
   * Punto único de entrada: clasifica el rechazo y ejecuta su recuperación.
   * `UNKNOWN` conserva el comportamiento de siempre (mensaje del servidor en
   * el banner) porque no hay nada que poner al día.
   *
   * INVARIANTE: ningún rechazo sale de aquí sin dejar algo en pantalla —
   * `rejectionNotice` si el POS se puso al día, `error` si no hay nada que
   * poner al día. El `switch` es EXHAUSTIVO sobre `AnyCheckoutRejectionCode`
   * ([D-039]: recuperables + venta a staff) y el `default` lo fija con un
   * `never`: un código nuevo del dominio NO compila hasta que alguien decida
   * qué ve el operador.
   */
  const recoverFromRejection = async (err: unknown, fallbackMessage: string): Promise<void> => {
    const rejection = toCheckoutRejection(err)
    const detail = rejection.message || fallbackMessage
    // Copia local para que el narrowing del switch (y el `never` del default)
    // cuelgue de un const y no de una propiedad leída entre `await`s.
    const code: AnyCheckoutRejectionCode = rejection.code
    if (code === 'UNKNOWN' || !locationId) {
      setError(detail)
      return
    }
    setError(null)
    try {
      switch (code) {
        case 'PRICE_MISMATCH':
        case 'BARBER_EXCLUDED': {
          const previousTotalCents = computeTotals(cartState.lines).subtotalCents
          const newTotalCents = await repriceCartLines(locationId)
          setRejectionNotice({
            code,
            message: PRICE_CHANGED_MESSAGE,
            detail,
            previousTotalCents,
            newTotalCents,
            shortages: [],
          })
          break
        }
        case 'STOCK': {
          const shortages = await reloadStockAndFindShortages(locationId)
          setRejectionNotice({
            code: 'STOCK',
            message: detail,
            detail: null,
            previousTotalCents: null,
            newTotalCents: null,
            shortages,
          })
          break
        }
        case 'REGISTER_SESSION_STALE': {
          await refreshRegisterSession(locationId)
          setRejectionNotice({
            code: 'REGISTER_SESSION_STALE',
            message: detail,
            detail: null,
            previousTotalCents: null,
            newTotalCents: null,
            shortages: [],
          })
          break
        }
        // Venta a staff ([D-039]): NADA de esto se arregla recargando el
        // catálogo — lo resuelve el operador (elegir la variante, quitar la
        // línea) o el dueño (subir el tope en Ajustes). Por eso van al banner
        // de `error` con el mensaje en español del API tal cual, y NUNCA a
        // `rejectionNotice`, que significa "ya me puse al día, confirma"
        // ([D-035]). El carrito queda intacto y `submitting` vuelve a false en
        // el `finally` de submit: el operador corrige y vuelve a cobrar.
        case 'STAFF_SALE_QUOTA_EXCEEDED':
        case 'STAFF_SALE_NOT_ELIGIBLE':
        case 'STAFF_SALE_VARIANT_REQUIRED':
          setError(detail)
          break
        default: {
          // `code` es `never` aquí SOLO si los `case` de arriba cubren toda
          // la unión: un miembro nuevo rompe el typecheck en esta línea. Si
          // aun así llegara uno en runtime, el operador ve el texto del API
          // con el código — jamás la pantalla muda que motivó esta tarea.
          const unhandledCode: never = code
          setError(`${detail} (${String(unhandledCode)})`)
          break
        }
      }
    } catch {
      // La puesta al día falló (red). El carrito sigue intacto y el operador
      // ve el rechazo tal cual: peor que recuperarse es quedarse sin salida.
      setError(detail)
    }
  }

  /** Lo llama el CTA de cobro: confirmar explícitamente lo que cambió. */
  const dismissRejectionNotice = () => setRejectionNotice(null)

  const submit = async (payment: {
    payments: CheckoutPayment[]
    tipCents: number
  }): Promise<SaleResult | null> => {
    if (!locationId || cartState.lines.length === 0 || submitting) return null
    if (!registerSessionId) {
      setError('No hay caja abierta. Abre caja primero.')
      return null
    }
    // A1/FIX3: re-valida que todo barbero acreditado en el carrito siga
    // teniendo turno iniciado. El picker de UI ya bloquea la selección de un
    // barbero sin turno, pero eso es solo un gate de UX en el momento de
    // elegir — no protege contra un barbero que fichó salida DESPUÉS de ser
    // asignado (o un default pre-llenado desde un walk-in cuyo
    // assignedStaffUser ya no tiene turno). Bloqueamos el cobro aquí, justo
    // antes de mandar la venta al API.
    const unavailableBarberId = findUnavailableCreditedBarberId(cartState, barbers)
    if (unavailableBarberId) {
      const unavailableBarber = barbers.find((b) => b.id === unavailableBarberId)
      setError(
        unavailableBarber
          ? `El barbero ${unavailableBarber.fullName} no tiene turno iniciado — pídele que fiche entrada.`
          : 'Uno de los barberos asignados ya no está disponible. Vuelve a asignarlo antes de cobrar.',
      )
      return null
    }
    // Venta a staff: no se manda un ticket que el API ya se sabe que rechaza
    // (línea sin precio staff, servicio que la política no admite, tope del mes
    // rebasado). El API lo revalida igual; esto evita el rechazo DESPUÉS de que
    // el operador cobró.
    if (staffSaleEnabled && (!staffSale.canCharge || !staffSaleBuyerStaffUserId)) {
      setError(staffSale.blockMessage ?? STAFF_SALE_MESSAGE.noBuyer)
      return null
    }
    setSubmitting(true)
    publishSubmitting(true)
    setError(null)
    try {
      const customerId =
        cartState.customer?.id ?? (await checkout.findOrCreateMostradorCustomer()).id
      const result = await checkout.createSale({
        locationId,
        registerSessionId,
        customerId,
        staffUserId: cartState.defaultBarberId || null,
        completeWalkInId: context?.kind === 'walk-in' ? context.walkInId : null,
        completeAppointmentId,
        // Venta a staff: sólo viaja el COMPRADOR (spec §4.3). El precio staff,
        // los topes del mes y los permisos los resuelve el API en la misma
        // transacción del cobro; `null` = venta normal, payload de siempre.
        staffSale:
          staffSaleEnabled && staffSaleBuyerStaffUserId
            ? { buyerStaffUserId: staffSaleBuyerStaffUserId }
            : null,
        items: cartState.lines.map((l) => ({
          serviceId: l.kind === 'service' ? l.itemId : null,
          productId: l.kind === 'product' ? l.itemId : null,
          catalogComboId: l.kind === 'combo' ? l.itemId : null,
          qty: l.qty,
          unitPriceCents: l.unitPriceCents,
          // La presentación elegida viaja para que el API resuelva el precio
          // staff de ESA variante (§4.2). Null en venta normal.
          productVariantId: staffLinePrices.get(l.id)?.productVariantId ?? null,
          // Per-line barber attribution drives commission math. Falls back to
          // the cart's default barber when an item wasn't reassigned by the
          // operator (which is the dominant case — single-barber sale).
          staffUserId: l.staffUserId ?? (cartState.defaultBarberId || null),
        })),
        tipCents: payment.tipCents,
        payments: payment.payments,
        appliedCouponCodes: appliedCoupons.map((c) => c.code),
      })
      // The current SaleResult shape from createSale doesn't include items + payment context
      // for the receipt screen. We reconstruct what we know locally.
      const reconstructed: SaleResult = {
        id: result.id,
        totalCents: result.totalCents,
        tipCents: payment.tipCents,
        payments: payment.payments,
        createdAt: new Date().toISOString(),
        customer: cartState.customer
          ? { id: cartState.customer.id, fullName: cartState.customer.fullName, email: null, phone: null }
          : null,
        items: cartState.lines.map((l, idx) => {
          const barber = l.staffUserId ? barbers.find((b) => b.id === l.staffUserId) : null
          return {
            id: `item-${idx}`,
            name: l.name,
            qty: l.qty,
            unitPriceCents: l.unitPriceCents,
            totalCents: l.unitPriceCents * l.qty,
            staffUser: barber ? { id: barber.id, fullName: barber.fullName } : null,
          }
        }),
      }
      setSuccessSale(reconstructed)
      dispatch({ type: 'clear' })
      // Limpia el state de cupones del hook — el reducer del carrito no
      // sabe nada de cupones, así que el clear de cart no los toca solo.
      setAppliedCoupons([])
      setCouponError(null)
      setRejectionNotice(null)
      // Venta a staff cobrada: el modo se apaga solo (el siguiente cliente es
      // una venta normal) y el cupo queda INVALIDADO — esta compra ya consumió
      // unidades y monto, así que el número viejo mentiría. La próxima vez que
      // se encienda el interruptor se vuelve a pedir a la red.
      if (staffSaleEnabled) {
        setStaffSaleEnabledState(false)
        setStaffSaleBuyerId(null)
        setStaffQuota(null)
        setStaffSaleError(null)
      }
      setStaffLinePrices(new Map())
      return reconstructed
    } catch (e) {
      // El servidor rechazó: clasificamos, nos ponemos al día y dejamos el
      // aviso. El carrito NO se toca y no se reintenta solo.
      await recoverFromRejection(e, 'No se pudo cobrar.')
      return null
    } finally {
      setSubmitting(false)
      publishSubmitting(false)
    }
  }

  // Cobro de EXTRAS sobre una cita prepagada: appendea las líneas nuevas del
  // carrito a la MISMA venta prepagada y cobra SOLO el delta (extras + propina)
  // vía addItemsToAppointmentSale. Espejo de `submit` pero contra la venta
  // prepagada — reusa el mismo gate de barberos-con-turno, el mismo
  // registerSessionId y el mismo camino de éxito (successSale → recibo). Las
  // líneas PAGADO (read-only) NUNCA entran aquí: viven fuera de `cartState.lines`,
  // así que `cartState.lines` ES exactamente el set de extras a cobrar.
  const submitExtras = async (payment: {
    payments: CheckoutPayment[]
    tipCents: number
  }): Promise<SaleResult | null> => {
    if (!locationId || cartState.lines.length === 0 || submitting) return null
    if (!prepayState.prepaidSaleId) return null
    if (!registerSessionId) {
      setError('No hay caja abierta. Abre caja primero.')
      return null
    }
    // Mismo re-check A1/FIX3 que `submit`: ningún barbero acreditado en las
    // líneas extra puede estar sin turno al momento de cobrar.
    const unavailableBarberId = findUnavailableCreditedBarberId(cartState, barbers)
    if (unavailableBarberId) {
      const unavailableBarber = barbers.find((b) => b.id === unavailableBarberId)
      setError(
        unavailableBarber
          ? `El barbero ${unavailableBarber.fullName} no tiene turno iniciado — pídele que fiche entrada.`
          : 'Uno de los barberos asignados ya no está disponible. Vuelve a asignarlo antes de cobrar.',
      )
      return null
    }
    setSubmitting(true)
    publishSubmitting(true)
    setError(null)
    try {
      const result = await checkout.addItemsToAppointmentSale({
        saleId: prepayState.prepaidSaleId,
        registerSessionId,
        items: cartState.lines.map((l) => ({
          serviceId: l.kind === 'service' ? l.itemId : null,
          productId: l.kind === 'product' ? l.itemId : null,
          catalogComboId: l.kind === 'combo' ? l.itemId : null,
          qty: l.qty,
          unitPriceCents: l.unitPriceCents,
          staffUserId: l.staffUserId ?? (cartState.defaultBarberId || null),
        })),
        tipCents: payment.tipCents,
        payments: payment.payments,
      })
      // Recibo del cobro normal, pero con SOLO el delta (extras + propina) —
      // es lo que se cobró ahora. El total prepagado ya se mostró como PAGADO.
      const extrasGrossCents = cartState.lines.reduce((s, l) => s + l.unitPriceCents * l.qty, 0)
      const reconstructed: SaleResult = {
        id: result.id,
        totalCents: extrasGrossCents + payment.tipCents,
        tipCents: payment.tipCents,
        payments: payment.payments,
        createdAt: new Date().toISOString(),
        customer: cartState.customer
          ? { id: cartState.customer.id, fullName: cartState.customer.fullName, email: null, phone: null }
          : null,
        items: cartState.lines.map((l, idx) => {
          const barber = l.staffUserId ? barbers.find((b) => b.id === l.staffUserId) : null
          return {
            id: `extra-${idx}`,
            name: l.name,
            qty: l.qty,
            unitPriceCents: l.unitPriceCents,
            totalCents: l.unitPriceCents * l.qty,
            staffUser: barber ? { id: barber.id, fullName: barber.fullName } : null,
          }
        }),
      }
      setSuccessSale(reconstructed)
      dispatch({ type: 'clear' })
      setAppliedCoupons([])
      setCouponError(null)
      setRejectionNotice(null)
      return reconstructed
    } catch (e) {
      // Mismo contrato que `submit`: el cobro de extras pasa por las mismas
      // validaciones del API y se recupera igual.
      await recoverFromRejection(e, 'No se pudo cobrar los extras.')
      return null
    } finally {
      setSubmitting(false)
      publishSubmitting(false)
    }
  }

  // Ruta ÚNICA de resolución de precio por barbero (barbero > sucursal > base):
  // resuelve el precio del servicio O COMBO para `staffUserId` y lo fija en la
  // línea. Compartida por changeLineBarber (el operador cambia el barbero de una
  // línea existente) y addCatalogItem (una línea nueva entra con barbero
  // default). Ambas DEBEN aterrizar el precio del barbero de la línea, no el
  // del viewer logueado. El API valida y rechaza desajustes (PRICE_MISMATCH),
  // así que esta corrección no es cosmética — sin ella la venta se bloquea. Es
  // exactamente el bug latente que mata este esfuerzo para combos con override.
  //
  // `kind` decide el resolver hermano: servicios → resolveServicePriceForBarber,
  // combos → resolveComboPriceForBarber (misma forma {priceCents,isExcluded}).
  //
  // Red de seguridad contra el bug de dinero $0: si el barbero está EXCLUIDO del
  // servicio/combo (isExcluded=true → priceCents=0), NO comiteamos el cambio. La
  // línea conserva su barbero/precio anterior y avisamos al cajero con un toast.
  // El picker ya oculta a los excluidos proactivamente; esto cubre el caso de
  // catálogo stale o barbero default (prefill) excluido. El API además rechaza
  // estas líneas con code BARBER_EXCLUDED — aquí las prevenimos de origen.
  const resolveAndCommitLinePrice = async (
    lineId: string,
    kind: 'service' | 'combo',
    itemId: string,
    staffUserId: string,
  ): Promise<'committed' | 'excluded' | 'error'> => {
    if (!locationId) return 'error'
    try {
      const resolved =
        kind === 'combo'
          ? await checkout.resolveComboPriceForBarber(itemId, locationId, staffUserId)
          : await checkout.resolveServicePriceForBarber(itemId, locationId, staffUserId)
      if (resolved.isExcluded) {
        const barberName = barbers.find((b) => b.id === staffUserId)?.fullName ?? 'Ese barbero'
        const itemName = catalogItems.find((i) => i.id === itemId)?.name ?? (kind === 'combo' ? 'este combo' : 'este servicio')
        addToast(`${barberName} no ofrece ${itemName}. Elige otro barbero.`, 'error')
        return 'excluded'
      }
      dispatch({ type: 'setLineBarberAndPrice', lineId, staffUserId, unitPriceCents: resolved.priceCents })
      return 'committed'
    } catch (err) {
      // Surface the error in dev so we can see why the price didn't update; in prod this
      // becomes a no-op (price stays at its previous value, barber change persists).
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[resolveLinePrice] failed to resolve price', { lineId, staffUserId, err })
      }
      return 'error'
    }
  }

  // Change a line's barber. For SERVICE and COMBO lines, also re-resolve the
  // price (barber overrides) and dispatch atomically so the operator never sees
  // a stale price for the new barber — combos now carry per-barber price/excl.
  // just like services (the money bug this effort kills). For products, price is
  // invariant — just dispatch the barber change.
  const changeLineBarber = async (lineId: string, staffUserId: string) => {
    const line = cartState.lines.find((l) => l.id === lineId)
    if (!line) return
    if ((line.kind !== 'service' && line.kind !== 'combo') || !locationId) {
      dispatch({ type: 'setLineBarber', lineId, staffUserId })
      return
    }
    // Optimistic: update barber chip immediately so the UI feels responsive,
    // then patch in the resolved price via la ruta compartida.
    const prevStaffUserId = line.staffUserId
    dispatch({ type: 'setLineBarber', lineId, staffUserId })
    const outcome = await resolveAndCommitLinePrice(lineId, line.kind, line.itemId, staffUserId)
    if (outcome === 'excluded') {
      // El barbero elegido no ofrece el servicio: revertimos el chip optimista
      // al barbero anterior (o "sin asignar" si no había). El toast ya avisó.
      if (prevStaffUserId) dispatch({ type: 'setLineBarber', lineId, staffUserId: prevStaffUserId })
      else dispatch({ type: 'clearLineBarber', lineId })
    }
  }

  // Add optimista desde el catálogo: la línea entra YA con un precio para
  // feedback instantáneo al tap y, si es servicio O COMBO con barbero default, se
  // corrige al precio de ESE barbero vía resolveAndCommitLinePrice — la MISMA
  // ruta que usa el picker (cache-first: corrección típicamente sin parpadeo).
  // El precio optimista de un servicio/combo ahora sale del OVERLAY (precio del
  // atendiendo), no del catálogo STATIC (precio base del viewer): así la línea
  // nace ya con el precio correcto y no parpadea entre el base y el resuelto.
  // Cuando NO hay atendiendo, resolveAndCommitLinePrice no corre y el overlay
  // (staffUserId null = precio de sucursal) es el precio final — más correcto
  // que el base. Productos no están en el overlay → precio STATIC.
  // No encadenamos changeLineBarber porque éste lee la línea del estado del
  // carrito, que aún no incluye la recién despachada (dispatch es asíncrono);
  // por eso pasamos el itemId directo a la ruta compartida.
  const addCatalogItem = (item: {
    kind: 'service' | 'product' | 'combo'
    id: string
    name: string
    priceCents: number
    categoryId: string | null
    /**
     * Presentación elegida. Sólo la pide la venta a staff, y sólo cuando el
     * producto tiene variantes con precio distinto (`needsVariant`).
     */
    productVariantId?: string | null
  }): AddCatalogItemResult => {
    const lineId = crypto.randomUUID()
    // ── Modo venta a staff: qué entra al ticket y a qué precio (spec §4.3) ──
    let staffLine: { price: StaffLinePrice; unitPriceCents: number } | null = null
    if (staffSaleEnabled) {
      if (item.kind !== 'product') {
        // Servicios y combos van a precio NORMAL, y sólo si la política los
        // admite en el mismo ticket (§4.3.4); si no, no entran.
        if (staffQuota?.allowServicesInTicket === false) {
          return { added: false, reason: 'SERVICES_NOT_ALLOWED', message: STAFF_SALE_MESSAGE.noServices }
        }
      } else {
        const product = products.find((p) => p.id === item.id)
        const view = product ? staffLineView(product, item.productVariantId ?? null) : null
        if (view === null || !view.eligible || view.unitPriceCents === null) {
          // No elegible, sin precio staff o falta elegir presentación: la línea
          // NO entra al ticket ([D-042]: nada de precios aproximados) y el
          // motivo vuelve para que la UI diga qué pasó o abra el selector.
          const reason = view?.reason ?? 'NOT_ELIGIBLE'
          return { added: false, reason, message: STAFF_SALE_MESSAGES[reason] }
        }
        staffLine = {
          price: {
            listUnitPriceCents: view.listUnitPriceCents,
            productVariantId: item.productVariantId ?? null,
          },
          unitPriceCents: view.unitPriceCents,
        }
      }
    }
    const overlayPriceCents =
      item.kind === 'service' || item.kind === 'combo' ? priceOverlay?.get(item.id)?.priceCents : undefined
    dispatch({
      type: 'add',
      lineId,
      item: {
        kind: item.kind,
        itemId: item.id,
        name: item.name,
        unitPriceCents: staffLine?.unitPriceCents ?? overlayPriceCents ?? item.priceCents,
        categoryId: item.categoryId,
      },
    })
    const staffPrice = staffLine?.price
    if (staffPrice) setStaffLinePrices((prev) => new Map(prev).set(lineId, staffPrice))
    if ((item.kind === 'service' || item.kind === 'combo') && cartState.defaultBarberId) {
      void resolveAndCommitLinePrice(lineId, item.kind, item.id, cartState.defaultBarberId).then((outcome) => {
        // Si el barbero atendiendo está excluido de este servicio/combo, la línea
        // entró optimista con ese barbero vía el reducer. En vez de dejarla sin
        // barbero (basura: precio optimista sin a quién acreditar), la ELIMINAMOS.
        // El grid ya oculta estos items cuando hay barbero atendiendo, así que
        // esto solo cubre catálogo stale. El toast ya avisó desde
        // resolveAndCommitLinePrice. Trap del repo: la línea recién despachada no
        // está en `cartState` de este render, por eso removemos por `lineId`
        // directo. (El prefill de walk-in NO pasa por aquí — ahí el servicio lo
        // pidió el cliente y la línea se conserva sin barbero a precio de sucursal.)
        if (outcome === 'excluded') dispatch({ type: 'removeLine', lineId })
      })
    }
    return { added: true }
  }

  // Líneas PAGADO (read-only) de la venta prepagada, listas para render. El
  // `name` puede venir null del API → se resuelve contra el catálogo local por
  // serviceId/productId/catalogComboId. NO viven en `cartState.lines` (una
  // sección aparte): así el total a cobrar, los cupones, el submit y el gate de
  // barberos siguen operando SOLO sobre los extras, sin filtros especiales.
  const prepaidLines = useMemo(() => {
    return (prepayState.prepaidItems ?? []).map((it) => {
      const catalogId = it.serviceId ?? it.productId ?? it.catalogComboId
      const resolvedName =
        it.name ??
        (catalogId ? catalogItems.find((c) => c.id === catalogId)?.name : null) ??
        'Concepto'
      return {
        id: it.id,
        name: resolvedName,
        qty: it.qty,
        unitPriceCents: it.unitPriceCents,
        totalCents: it.totalCents,
        staffUserId: it.staffUserId,
      }
    })
  }, [prepayState.prepaidItems, catalogItems])

  // ¿El overlay corresponde al atendiendo actual? Si sí, sus precios/exclusión
  // son la verdad más fresca para el grid. Si no (o aún no ha cargado), el grid
  // cae al estático.
  const overlayFresh = overlayBarberId === attendingBarberId
  // Atenuar (previousData): true solo cuando ya había un overlay y estamos
  // trayendo el del NUEVO atendiendo. En la carga inicial (overlayBarberId
  // undefined) no atenuamos — el estático del viewer es el arranque correcto.
  const pricesUpdating = overlayLoading && overlayBarberId !== undefined && !overlayFresh

  return {
    context,
    catalogItems,
    categories,
    barbers,
    cartState,
    dispatch,
    changeLineBarber,
    addCatalogItem,
    // Overlay de precios por barbero para el grid (capa LIVE sobre el catálogo
    // STATIC). `priceOverlay` mapea serviceId → {priceCents,isExcluded} del
    // atendiendo; `overlayFresh` indica si corresponde al atendiendo actual;
    // `pricesUpdating` atenúa las cards mientras llega el overlay del nuevo
    // atendiendo (sin flash de precios del barbero anterior "como actuales").
    priceOverlay,
    overlayFresh,
    pricesUpdating,
    customerResults,
    searchCustomers,
    createCustomer,
    submit,
    // Cobro de extras sobre una cita prepagada (delta) — appendea a la venta
    // prepagada vía addItemsToAppointmentSale. Lo usa el CTA "Cobrar extras".
    submitExtras,
    submitting,
    error,
    // Rechazo del API ya recuperado (precios re-preciados, stock recargado,
    // caja releída) esperando confirmación explícita. Mientras no sea null, el
    // cobro exige otro toque en Cobrar — `dismissRejectionNotice` es ese toque.
    rejectionNotice,
    dismissRejectionNotice,
    successSale,
    setSuccessSale,
    registerSessionId,
    loaded,
    // Prepay (cita prepagada o con link pendiente) — solo aplica cuando el
    // checkout viene desde una cita. `refetchPrepayState` se llama tras
    // cancelar el link para caer al flujo normal de POS.
    isPrepaid: prepayState.isPrepaid,
    hasPendingLink: prepayState.hasPendingLink,
    prepaidSaleId: prepayState.prepaidSaleId,
    prepaidMethod: prepayState.prepaidMethod,
    prepaidAt: prepayState.prepaidAt,
    // Líneas ya pagadas de la cita (read-only PAGADO) + total prepagado. El
    // checkout de cita prepagada las pinta encima del carrito de extras.
    prepaidLines,
    prepaidTotalCents: prepayState.prepaidTotalCents,
    // Nota interna de la cita cuando el cobro viene de una cita
    // (completeAppointmentId). null en ventas libres / walk-in / cliente
    // preseleccionado sin cita. El checkout la muestra como aviso al entrar.
    appointmentStaffNote: prepayState.staffNote,
    refetchPrepayState,
    // Cupones de descuento aplicados al draft del checkout. El total
    // descontado lo controla el API (recalculado en cada apply/remove);
    // la UI solo refleja el preview.
    appliedCoupons,
    applyCoupon,
    removeCoupon,
    couponError,
    discountTotalCents,
    // Un ticket de venta a staff no admite cupones (spec §4.3.5): el bloque se
    // deshabilita con este motivo en vez de dejar aplicar uno que el cobro
    // rechazaría.
    couponsDisabled: staffSaleEnabled,
    couponsDisabledMessage: staffSaleEnabled ? STAFF_SALE_MESSAGE.noCoupons : null,
    /* ── Venta a staff (spec venta a staff §4.3/§4.5) ──────────────────────
     * `staffSale` es todo lo que la UI necesita para pintar el modo:
     * permisos, comprador, cupo del mes contrastado con el carrito, descuento
     * del ticket, qué línea le falta algo, cómo se pinta cada producto del
     * grid (`catalogViews`) y si se puede cobrar. El POS sólo MUESTRA:
     * `createPOSSale` vuelve a medir todo al cobrar.
     */
    staffSale,
    setStaffSaleEnabled,
    setStaffSaleBuyer,
    setStaffSaleLineVariant,
  }
}
