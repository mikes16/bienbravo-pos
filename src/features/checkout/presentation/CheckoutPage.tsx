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
import { SkeletonRow, SkeletonCard } from '@/shared/pos-ui'
import { formatMoney } from '@/shared/lib/money'

export function CheckoutPage() {
  const navigate = useNavigate()
  const ck = useCheckout()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [barberSheetOpen, setBarberSheetOpen] = useState(false)
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false)
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false)
  const [cartSheetOpen, setCartSheetOpen] = useState(false)
  const [splashShown, setSplashShown] = useState(false)

  // Splash for 2s after success, then receipt screen
  useEffect(() => {
    if (ck.successSale && !splashShown) {
      setSplashShown(true)
    }
  }, [ck.successSale, splashShown])

  const totals = computeTotals(ck.cartState.lines)
  const defaultBarber = ck.barbers.find((b) => b.id === ck.cartState.defaultBarberId) ?? ck.barbers[0]
  const cartItemCount = ck.cartState.lines.reduce((sum, l) => sum + l.qty, 0)

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

  // Loading: only show the skeleton until the initial Promise.all settles.
  // Without the loaded gate, an empty barbers list (or a query error) would
  // leave the page spinning forever.
  if (!ck.loaded) {
    return (
      <div className="flex h-full">
        <div className="flex flex-1 flex-col gap-4 px-6 py-5">
          <div className="flex gap-2">
            <SkeletonRow heightPx={36} widthPercent={20} />
            <SkeletonRow heightPx={36} widthPercent={20} />
            <SkeletonRow heightPx={36} widthPercent={20} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
        <div className="hidden w-[40%] min-w-[360px] flex-col gap-4 border-l border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-4 py-4 sm:flex">
          <SkeletonRow heightPx={64} />
          <SkeletonRow heightPx={36} />
          <SkeletonRow heightPx={56} />
        </div>
      </div>
    )
  }

  // Loaded but no barbers — surface this so the operator can act on it
  // instead of staring at a stuck screen. Common causes: location has no
  // active barbers configured, or the load itself errored.
  if (!defaultBarber) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-6 py-10">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">
          No se pudo abrir cobro
        </p>
        <p className="max-w-md text-center text-[15px] leading-snug text-[var(--color-bone)]">
          {ck.error ?? 'No hay barberos activos en esta sucursal. Configura el roster o regresa a Hoy.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/hoy')}
          className="cursor-pointer border border-[var(--color-leather-muted)] px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone)] hover:bg-[var(--color-cuero-viejo)]"
        >
          ← Volver a Hoy
        </button>
      </div>
    )
  }

  // Shared cart panel content. Rendered in two places:
  //   - tablet+ sidebar (always visible)
  //   - mobile full-screen sheet (when user taps the bottom bar)
  const cartContent = (
    <>
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
        onSetBarber={(lineId, barberId) => void ck.changeLineBarber(lineId, barberId)}
        onRemove={(lineId) => ck.dispatch({ type: 'removeLine', lineId })}
      />
      <CartTotals subtotalCents={totals.subtotalCents} />
      {ck.error && (
        <div role="alert" className="mx-4 border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/[0.06] px-4 py-3">
          <p className="text-[13px] text-[var(--color-bravo)]">{ck.error}</p>
        </div>
      )}
      <CobrarCTA
        totalCents={totals.subtotalCents}
        disabled={ck.cartState.lines.length === 0 || ck.submitting}
        onTap={() => setPaymentSheetOpen(true)}
      />
    </>
  )

  return (
    <div className="flex h-full">
      {/* Catalog column. Full width on mobile; ~60% on tablet+ */}
      <div className="flex min-w-0 flex-1 flex-col">
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

        {/* Mobile-only sticky bottom CTA bar. Tap to open the cart sheet. */}
        {cartItemCount > 0 && (
          <button
            type="button"
            onClick={() => setCartSheetOpen(true)}
            className="flex shrink-0 items-center justify-between border-t border-[var(--color-bravo)] bg-[var(--color-bravo)] px-5 py-4 text-[var(--color-bone)] transition-colors hover:bg-[var(--color-bravo-hover)] sm:hidden"
          >
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em]">
              {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} · {formatMoney(totals.subtotalCents)}
            </span>
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em]">
              Ver carrito →
            </span>
          </button>
        )}
      </div>

      {/* Cart sidebar — tablet+ only */}
      <aside className="hidden flex-col border-l border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] sm:flex sm:w-[40%] sm:min-w-[360px]">
        {cartContent}
      </aside>

      {/* Mobile full-screen cart sheet */}
      {cartSheetOpen && (
        <aside className="fixed inset-0 z-40 flex flex-col bg-[var(--color-carbon-elevated)] sm:hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-leather-muted)]/40 px-4 py-3">
            <button
              type="button"
              onClick={() => setCartSheetOpen(false)}
              className="cursor-pointer font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
            >
              ← Cerrar
            </button>
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
              Carrito
            </span>
          </div>
          {cartContent}
        </aside>
      )}

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
        submitting={ck.submitting}
        error={ck.error}
        onClose={() => setPaymentSheetOpen(false)}
        onConfirm={async (input) => {
          const result = await ck.submit(input)
          if (result) setPaymentSheetOpen(false)
        }}
      />
    </div>
  )
}
