import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { useLocation } from '@/core/location/useLocation'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { useToast } from '@/core/toast/useToast'
import { cartReducer, initialCart, findUnavailableCreditedBarberId } from '../lib/cart'
import { cartLinesToDiscountItems, recomputeAppliedCoupons } from '../lib/coupon-compute'
import { sortCatalogItems, onlyCategorized } from '../lib/sort-catalog'
import type { CheckoutPayment } from '../domain/checkout.types'
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

export function useCheckout() {
  const [params] = useSearchParams()
  const { checkout, register } = useRepositories()
  const { locationId } = useLocation()
  const { viewer } = usePosAuth()
  const { addToast } = useToast()

  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
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
        const stockByProductId = new Map(stock.map((s) => [s.productId, s.quantity]))
        const items: CatalogItem[] = [
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
        setCatalogItems(sortCatalogItems(onlyCategorized(items), cats))
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
  }, [appliedCoupons, buildDraftItems, cartState.customer, checkout])

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
    setSubmitting(true)
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
        items: cartState.lines.map((l) => ({
          serviceId: l.kind === 'service' ? l.itemId : null,
          productId: l.kind === 'product' ? l.itemId : null,
          catalogComboId: l.kind === 'combo' ? l.itemId : null,
          qty: l.qty,
          unitPriceCents: l.unitPriceCents,
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
      return reconstructed
    } catch (e) {
      setError((e as { message?: string }).message ?? 'No se pudo cobrar.')
      return null
    } finally {
      setSubmitting(false)
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
      return reconstructed
    } catch (e) {
      setError((e as { message?: string }).message ?? 'No se pudo cobrar los extras.')
      return null
    } finally {
      setSubmitting(false)
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
  }) => {
    const lineId = crypto.randomUUID()
    const overlayPriceCents =
      item.kind === 'service' || item.kind === 'combo' ? priceOverlay?.get(item.id)?.priceCents : undefined
    dispatch({
      type: 'add',
      lineId,
      item: {
        kind: item.kind,
        itemId: item.id,
        name: item.name,
        unitPriceCents: overlayPriceCents ?? item.priceCents,
        categoryId: item.categoryId,
      },
    })
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
  }
}
