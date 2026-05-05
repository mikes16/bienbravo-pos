import { useEffect, useReducer, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { useLocation } from '@/core/location/useLocation'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { cartReducer, initialCart } from '../lib/cart'

interface Customer {
  id: string
  fullName: string
  email: string | null
  phone: string | null
}

interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
}

interface CatalogItem {
  id: string
  kind: 'service' | 'product' | 'combo'
  name: string
  priceCents: number
  stockQty?: number
  imageUrl?: string | null
  categoryId: string | null
}

type CheckoutContext =
  | { kind: 'free' }
  | { kind: 'preselected-customer'; customerId: string }
  | { kind: 'walk-in'; walkInId: string }

export interface SaleResult {
  id: string
  totalCents: number
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER'
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

  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string; sortOrder: number }>>([])
  const [barbers, setBarbers] = useState<Barber[]>([])

  const completeWalkInId = params.get('completeWalkInId')
  const customerIdParam = params.get('customerId')
  const [context, setContext] = useState<CheckoutContext | null>(null)

  const [cartState, dispatch] = useReducer(cartReducer, initialCart(viewer?.staff?.id ?? ''))

  const [registerSessionId, setRegisterSessionId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successSale, setSuccessSale] = useState<SaleResult | null>(null)

  const [customerResults, setCustomerResults] = useState<Customer[]>([])

  // Resolve entry context from query params
  useEffect(() => {
    if (completeWalkInId) {
      setContext({ kind: 'walk-in', walkInId: completeWalkInId })
    } else if (customerIdParam) {
      setContext({ kind: 'preselected-customer', customerId: customerIdParam })
    } else {
      setContext({ kind: 'free' })
    }
  }, [completeWalkInId, customerIdParam])

  // Load catalog + barbers + active register session
  useEffect(() => {
    if (!locationId) return
    let cancelled = false
    Promise.all([
      checkout.getServices(locationId, viewer?.staff?.id ?? null),
      checkout.getProducts(locationId),
      checkout.getCombos(),
      checkout.getCategories(),
      checkout.getBarbers(locationId),
      checkout.getStockLevels(locationId),
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
          })),
          ...products.map((p) => ({
            id: p.id,
            kind: 'product' as const,
            name: p.name,
            priceCents: p.priceCents,
            stockQty: stockByProductId.get(p.id),
            imageUrl: p.imageUrl,
            categoryId: p.categoryId,
          })),
          ...combos.map((c) => ({
            id: c.id,
            kind: 'combo' as const,
            name: c.name,
            priceCents: c.priceCents,
            imageUrl: c.imageUrl,
            categoryId: null,
          })),
        ]
        setCatalogItems(items)
        setCategories(cats)
        setBarbers(brbs)
        const openSessionRegister = registers.find((r) => r.openSession)
        setRegisterSessionId(openSessionRegister?.openSession?.id ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setError('No se pudo cargar el catálogo. Reintenta.')
      })
    return () => {
      cancelled = true
    }
  }, [locationId, viewer?.staff?.id, checkout, register])

  // Pre-fill customer/barber based on context
  useEffect(() => {
    if (!context || !locationId) return
    if (context.kind === 'walk-in') {
      checkout.getWalkIn(context.walkInId, locationId).then((w) => {
        if (w?.customer) {
          dispatch({
            type: 'setCustomer',
            customer: { id: w.customer.id, fullName: w.customer.fullName },
          })
        }
        if (w?.assignedStaffUser?.id) {
          dispatch({ type: 'setDefaultBarber', staffUserId: w.assignedStaffUser.id })
        }
      })
    } else if (context.kind === 'preselected-customer') {
      checkout.getCustomer(context.customerId).then((c) => {
        if (c) dispatch({ type: 'setCustomer', customer: { id: c.id, fullName: c.fullName } })
      })
    }
  }, [context, checkout, locationId])

  const searchCustomers = async (query: string) => {
    if (!query.trim()) {
      setCustomerResults([])
      return
    }
    const results = await checkout.searchCustomers(query)
    setCustomerResults(results)
  }

  const createCustomer = async (input: { fullName: string; phone?: string; email?: string }) => {
    return await checkout.findOrCreateCustomer(
      input.fullName,
      input.email ?? null,
      input.phone ?? null,
    )
  }

  const submit = async (payment: {
    method: 'CASH' | 'CARD' | 'TRANSFER'
    tipCents: number
  }): Promise<SaleResult | null> => {
    if (!locationId || cartState.lines.length === 0 || submitting) return null
    if (!registerSessionId) {
      setError('No hay caja abierta. Abre caja primero.')
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
        completeAppointmentId: null,
        items: cartState.lines.map((l) => ({
          serviceId: l.kind === 'service' ? l.itemId : null,
          productId: l.kind === 'product' ? l.itemId : null,
          catalogComboId: l.kind === 'combo' ? l.itemId : null,
          qty: l.qty,
          unitPriceCents: l.unitPriceCents,
        })),
        tipCents: payment.tipCents,
        paymentMethod: payment.method,
      })
      // The current SaleResult shape from createSale doesn't include items + payment context
      // for the receipt screen. We reconstruct what we know locally.
      const reconstructed: SaleResult = {
        id: result.id,
        totalCents: result.totalCents,
        paymentMethod: payment.method,
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
      return reconstructed
    } catch (e) {
      setError((e as { message?: string }).message ?? 'No se pudo cobrar.')
      return null
    } finally {
      setSubmitting(false)
    }
  }

  return {
    context,
    catalogItems,
    categories,
    barbers,
    cartState,
    dispatch,
    customerResults,
    searchCustomers,
    createCustomer,
    submit,
    submitting,
    error,
    successSale,
    setSuccessSale,
    registerSessionId,
  }
}
