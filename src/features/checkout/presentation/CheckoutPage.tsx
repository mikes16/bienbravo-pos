import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import { useCatalog } from '../application/useCatalog.ts'
import { useCart } from '../application/useCart.ts'
import { useCheckout } from '../application/useCheckout.ts'
import { CatalogView } from './CatalogView.tsx'
import { CartBar } from './CartBar.tsx'
import { PaymentView } from './PaymentView.tsx'
import { SuccessView } from './SuccessView.tsx'
import type { PaymentMethod } from '../domain/checkout.types.ts'
import type { CustomerResult } from '../data/checkout.repository.ts'

type Step = 'catalog' | 'payment' | 'success'

function todayRangeISO(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function CheckoutPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const completeWalkInId = searchParams.get('completeWalkInId')
  const completeAppointmentId = searchParams.get('completeAppointmentId')
  const { viewer } = usePosAuth()
  const { locationId } = useLocation()
  const { checkout, walkins, agenda } = useRepositories()
  const { categories, services, products, combos, stockLevels, loading, error: catalogError } = useCatalog(locationId)
  const { cart, add, remove, updateQty, setTip, clear, total, lineCount, saleItems } =
    useCart()

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null)
  const [anonymousSelected, setAnonymousSelected] = useState(false)
  const [customerRequiredError, setCustomerRequiredError] = useState<string | null>(null)
  const [appointmentServicesPrefilled, setAppointmentServicesPrefilled] = useState(false)

  const searchCustomers = useCallback(
    (q: string) => checkout.searchCustomers(q),
    [checkout],
  )

  const createCustomer = useCallback(
    (name: string, email: string | null, phone: string | null) => checkout.findOrCreateCustomer(name, email, phone),
    [checkout],
  )

  const handleSelectCustomer = useCallback((customer: CustomerResult | null) => {
    setSelectedCustomer(customer)
    if (customer) {
      setAnonymousSelected(false)
      setCustomerRequiredError(null)
    }
  }, [])

  const handleSelectAnonymous = useCallback(() => {
    setSelectedCustomer(null)
    setAnonymousSelected(true)
    setCustomerRequiredError(null)
  }, [])

  const {
    submit,
    submitting,
    result,
    error: saleError,
    reset: resetSale,
  } = useCheckout({
    locationId: locationId ?? '',
    registerSessionId: null,
    staffUserId: viewer?.staff.id ?? null,
    customerId: selectedCustomer?.id ?? null,
    completeWalkInId,
    completeAppointmentId,
  })

  const [step, setStep] = useState<Step>('catalog')
  const [activeServiceBlockReason, setActiveServiceBlockReason] = useState<string | null>(null)

  useEffect(() => {
    if (!viewer?.staff || !locationId) {
      setActiveServiceBlockReason(null)
      return
    }

    let cancelled = false
    walkins.getWalkIns(locationId)
      .then(async (list) => {
        if (cancelled) return
        const activeWalkIn = list.find(
          (w) =>
            w.status === 'ASSIGNED' &&
            w.assignedStaffUser?.id === viewer.staff.id &&
            w.id !== completeWalkInId,
        )
        setActiveServiceBlockReason(
          activeWalkIn
            ? 'Tienes un servicio en curso. Finalízalo o cancélalo sin cobro antes de cobrar otra venta.'
            : null,
        )

        if (completeWalkInId && !selectedCustomer) {
          const target = list.find((w) => w.id === completeWalkInId)
          if (target) {
            if (target.customer) {
              if (!cancelled) {
                setSelectedCustomer(target.customer)
                setAnonymousSelected(false)
                setCustomerRequiredError(null)
              }
            } else if (target.customerName && (target.customerEmail || target.customerPhone)) {
              try {
                const found = await checkout.findOrCreateCustomer(
                  target.customerName,
                  target.customerEmail,
                  target.customerPhone,
                )
                if (!cancelled && found) {
                  setSelectedCustomer(found)
                  setAnonymousSelected(false)
                  setCustomerRequiredError(null)
                }
              } catch {
                // non-blocking
              }
            }
          }
        }
      })
      .catch(() => {
        if (cancelled) return
        setActiveServiceBlockReason(null)
      })

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, viewer, walkins, checkout, completeWalkInId])

  useEffect(() => {
    if (!locationId || !completeAppointmentId || appointmentServicesPrefilled) return
    const { from, to } = todayRangeISO()
    let cancelled = false

    agenda.getAppointments(from, to, locationId)
      .then((list) => {
        if (cancelled) return
        const target = list.find((a) => a.id === completeAppointmentId)
        if (!target) return

        if (!selectedCustomer && target.customer) {
          setSelectedCustomer({
            id: target.customer.id,
            fullName: target.customer.fullName,
            email: null,
            phone: target.customer.phone,
          })
          setAnonymousSelected(false)
          setCustomerRequiredError(null)
        }

        if (cart.lines.length === 0 && target.items.length > 0 && services.length > 0) {
          target.items.forEach((apptItem) => {
            const service = services.find((s) => s.id === apptItem.serviceId)
            if (!service) return
            add({ kind: 'service', item: service }, apptItem.qty)
          })
        }

        setAppointmentServicesPrefilled(true)
      })
      .catch(() => {
        // non-blocking
      })

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, completeAppointmentId, appointmentServicesPrefilled, agenda, services, add, cart.lines.length, selectedCustomer])

  async function handlePay(method: PaymentMethod) {
    const sale = await submit(saleItems, cart.tipCents, method)
    if (sale) {
      if (completeWalkInId) {
        try {
          await walkins.complete(completeWalkInId)
        } catch {
          // payment succeeded; walk-in completion is non-blocking
        }
      }
      if (completeAppointmentId) {
        try {
          await agenda.complete(completeAppointmentId)
        } catch {
          // payment succeeded; appointment completion is non-blocking
        }
      }
      setStep('success')
    }
  }

  function goToPayment() {
    if (activeServiceBlockReason) return
    if (!selectedCustomer && !anonymousSelected) {
      setCustomerRequiredError('Selecciona o crea un cliente. Si la persona no quiere registro, usa “Cobrar anónimo”.')
      return
    }
    setStep('payment')
  }

  function handleNewSale() {
    clear()
    resetSale()
    setSelectedCustomer(null)
    setAnonymousSelected(false)
    setCustomerRequiredError(null)
    setAppointmentServicesPrefilled(false)
    setStep('catalog')
  }

  if (step === 'success' && result) {
    return (
      <SuccessView
        sale={result}
        onNewSale={handleNewSale}
        onGoHome={() => navigate('/home')}
      />
    )
  }

  if (step === 'payment') {
    return (
      <PaymentView
        total={total}
        submitting={submitting}
        error={saleError}
        onSelect={handlePay}
        onBack={() => setStep('catalog')}
      />
    )
  }

  return (
    <div className="flex h-full">
      {/* Left: Catalog */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-4">
          <h1 className="font-bb-display text-xl font-bold">Nueva Venta</h1>
          {activeServiceBlockReason && (
            <p className="mt-2 rounded-xl bg-bb-danger/10 px-3 py-2 text-xs text-bb-danger">
              {activeServiceBlockReason}
            </p>
          )}
          {customerRequiredError && (
            <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              {customerRequiredError}
            </p>
          )}
        </div>
        <CatalogView
          categories={categories}
          services={services}
          products={products}
          combos={combos}
          stockLevels={stockLevels}
          loading={loading}
          error={catalogError}
          onAdd={add}
        />
      </div>

      {/* Right: Cart sidebar */}
      <div className="w-[340px] shrink-0 border-l border-bb-border bg-bb-bg p-4">
        <CartBar
          lines={cart.lines}
          tipCents={cart.tipCents}
          total={total}
          lineCount={lineCount}
          onRemove={remove}
          onUpdateQty={updateQty}
          onSetTip={setTip}
          onPay={goToPayment}
          payDisabled={Boolean(activeServiceBlockReason)}
          payDisabledReason={activeServiceBlockReason}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={handleSelectCustomer}
          searchCustomers={searchCustomers}
          onCreateCustomer={createCustomer}
          anonymousSelected={anonymousSelected}
          onSelectAnonymous={handleSelectAnonymous}
        />
      </div>
    </div>
  )
}
