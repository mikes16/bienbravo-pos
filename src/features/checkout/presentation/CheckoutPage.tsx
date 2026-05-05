import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCheckout } from '../application/useCheckout'
import { computeTotals } from '../lib/cart'
import { CatalogChips } from './CatalogChips'
import { CatalogGrid } from './CatalogGrid'
import { AtendiendoHeader } from './AtendiendoHeader'
import { BarberSelectorSheet } from './BarberSelectorSheet'
import { CustomerChip } from './CustomerChip'
import { CustomerLookupSheet } from './CustomerLookupSheet'
import { CartList } from './CartList'
import { CartTotals } from './CartTotals'
import { CobrarCTA } from './CobrarCTA'
import { PaymentSheet } from './PaymentSheet'
import { ReceiptScreen } from './ReceiptScreen'

export function CheckoutPage() {
  const navigate = useNavigate()
  const ck = useCheckout()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [barberSheetOpen, setBarberSheetOpen] = useState(false)
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false)
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false)
  const [splashShown, setSplashShown] = useState(false)

  // Splash for 2s after success, then receipt screen
  useEffect(() => {
    if (ck.successSale && !splashShown) {
      setSplashShown(true)
    }
  }, [ck.successSale, splashShown])

  const totals = computeTotals(ck.cartState.lines)
  const defaultBarber = ck.barbers.find((b) => b.id === ck.cartState.defaultBarberId) ?? ck.barbers[0]

  if (ck.successSale) {
    return (
      <ReceiptScreen
        sale={ck.successSale}
        onListo={() => {
          ck.setSuccessSale(null)
          navigate('/hoy')
        }}
      />
    )
  }

  if (!defaultBarber) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <p className="text-[14px] text-[var(--color-bone-muted)]">Cargando catálogo…</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Catalog (left, 60%) */}
      <div className="flex flex-1 flex-col">
        <CatalogChips
          categories={ck.categories}
          selectedCategoryId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <CatalogGrid
          items={ck.catalogItems}
          selectedCategoryId={selectedCategoryId}
          searchQuery={searchQuery}
          onAdd={(item) => ck.dispatch({ type: 'add', item: { kind: item.kind, itemId: item.id, name: item.name, unitPriceCents: item.priceCents } })}
        />
      </div>

      {/* Cart (right, ~40%) */}
      <div className="flex w-[40%] min-w-[360px] flex-col border-l border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)]">
        <div className="flex flex-col gap-3 p-4">
          <AtendiendoHeader barber={defaultBarber} onTap={() => setBarberSheetOpen(true)} />
          <CustomerChip
            customer={ck.cartState.customer}
            onTap={() => setCustomerSheetOpen(true)}
            onClear={() => ck.dispatch({ type: 'setCustomer', customer: null })}
          />
        </div>
        <CartList
          lines={ck.cartState.lines}
          barbers={ck.barbers}
          onIncQty={(lineId) => ck.dispatch({ type: 'incQty', lineId })}
          onDecQty={(lineId) => ck.dispatch({ type: 'decQty', lineId })}
          onSetBarber={(lineId, barberId) => ck.dispatch({ type: 'setLineBarber', lineId, staffUserId: barberId })}
          onRemove={(lineId) => ck.dispatch({ type: 'removeLine', lineId })}
        />
        <CartTotals subtotalCents={totals.subtotalCents} />
        {ck.error && (
          <div role="alert" className="px-4 py-2">
            <p className="text-[12px] text-[var(--color-bravo)]">{ck.error}</p>
          </div>
        )}
        <CobrarCTA
          totalCents={totals.subtotalCents}
          disabled={ck.cartState.lines.length === 0 || ck.submitting}
          onTap={() => setPaymentSheetOpen(true)}
        />
      </div>

      {/* Sheets */}
      <BarberSelectorSheet
        open={barberSheetOpen}
        barbers={ck.barbers}
        currentBarberId={ck.cartState.defaultBarberId}
        onSelect={(id) => ck.dispatch({ type: 'setDefaultBarber', staffUserId: id })}
        onClose={() => setBarberSheetOpen(false)}
      />
      <CustomerLookupSheet
        open={customerSheetOpen}
        results={ck.customerResults}
        onSearchChange={ck.searchCustomers}
        onSelect={(c) => {
          ck.dispatch({ type: 'setCustomer', customer: { id: c.id, fullName: c.fullName } })
          setCustomerSheetOpen(false)
        }}
        onCreate={async (input) => {
          const created = await ck.createCustomer(input)
          if (created) {
            ck.dispatch({ type: 'setCustomer', customer: { id: created.id, fullName: created.fullName } })
          }
          setCustomerSheetOpen(false)
        }}
        onClose={() => setCustomerSheetOpen(false)}
      />
      <PaymentSheet
        open={paymentSheetOpen}
        totalCents={totals.subtotalCents}
        onClose={() => setPaymentSheetOpen(false)}
        onConfirm={async (input) => {
          const result = await ck.submit(input)
          if (result) setPaymentSheetOpen(false)
        }}
      />
    </div>
  )
}
