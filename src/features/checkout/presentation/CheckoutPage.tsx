import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@apollo/client/react'
import { useCheckout } from '../application/useCheckout'
import { computeTotals } from '../lib/cart'
import { prepayMethodLabel } from '../lib/prepayMethodLabel'
import {
  CLOSE_APPOINTMENT_SALE_MUTATION,
  CANCEL_APPOINTMENT_PREPAY_LINK_MUTATION,
} from '../data/checkout.repository'
import { CatalogChips } from './CatalogChips'
import { CatalogGrid } from './CatalogGrid'
import { AtendiendoHeader } from './AtendiendoHeader'
import { BarberSelectorSheet } from './BarberSelectorSheet'
import { CustomerChip } from './CustomerChip'
import { CustomerLookupSheet } from './CustomerLookupSheet'
import { CartList } from './CartList'
import { CartTotals } from './CartTotals'
import { CobrarCTA } from './CobrarCTA'
import { CouponsBlock } from './CouponsBlock'
import { PaymentSheet } from './PaymentSheet'
import { ReceiptScreen } from './ReceiptScreen'
import { SkeletonRow, SkeletonCard } from '@/shared/pos-ui'
import { formatMoney } from '@/shared/lib/money'
import { useToast } from '@/core/toast/useToast'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { useLocation } from '@/core/location/useLocation'

export function CheckoutPage() {
  const navigate = useNavigate()
  const ck = useCheckout()
  const { addToast } = useToast()
  const { viewer } = usePosAuth()
  const { locationName } = useLocation()
  // Permiso server-side dual: el API también valida pos.discount.apply en
  // applyCouponToDraftSale. Esconder el bloque en el cliente es solo UX —
  // no hay risk de bypass.
  // Durante loading del viewer (null) asumimos perms para no parpadear
  // mensajes de "sin acceso". Las mutaciones server-side fallarían igual
  // si el viewer real no los tiene.
  const perms = viewer?.permissions ?? []
  const viewerLoaded = !!viewer
  const canApplyCoupon = perms.includes('pos.discount.apply')
  const canCreateSale = !viewerLoaded || perms.includes('pos.sale.create')
  const canCloseSale = !viewerLoaded || perms.includes('pos.sale.close')
  const canAddTip = !viewerLoaded || perms.includes('pos.tip.add')
  const canReadCustomers = !viewerLoaded || perms.includes('customers.read')
  const canReadServices = !viewerLoaded || perms.includes('catalog.services.read')
  const canReadProducts = !viewerLoaded || perms.includes('catalog.products.read')
  // pos.sale.void y pos.refund.request: el API los gatea pero la UI POS
  // todavía no expone botones de "anular" ni "reembolsar". Cuando se
  // construyan, añadir los gates aquí + perms.includes(...) correspondientes.
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [barberSheetOpen, setBarberSheetOpen] = useState(false)
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false)
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false)
  const [cartSheetOpen, setCartSheetOpen] = useState(false)
  const [splashShown, setSplashShown] = useState(false)

  // Prepago: dos branches especiales del checkout. Tipados como `any` por el
  // mismo motivo que los `graphql()` calls en el repositorio: client-preset
  // emite un Document genérico que TS no infiere correctamente sobre el
  // resultado de la mutation. El payload solo necesita `saleId` y devuelve
  // boolean — no nos perdemos seguridad real aquí.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [closeSale, { loading: closing }] = useMutation(CLOSE_APPOINTMENT_SALE_MUTATION as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cancelLink, { loading: cancellingLink }] = useMutation(CANCEL_APPOINTMENT_PREPAY_LINK_MUTATION as any)

  const handleCloseSale = async () => {
    if (!ck.prepaidSaleId) return
    try {
      await closeSale({ variables: { saleId: ck.prepaidSaleId } })
      addToast('Cita cerrada. Servicio completado.', 'success')
      navigate('/hoy')
    } catch (e) {
      addToast((e as { message?: string })?.message ?? 'No se pudo cerrar la cita.', 'error')
    }
  }

  const handleCancelLinkAndPayInPerson = async () => {
    if (!ck.prepaidSaleId) return
    try {
      await cancelLink({ variables: { saleId: ck.prepaidSaleId } })
      // Refrescar el estado prepago — el repo devolverá ahora ambos flags
      // false (el sale quedó VOID) y el componente caerá al render normal.
      await ck.refetchPrepayState()
    } catch (e) {
      addToast((e as { message?: string })?.message ?? 'No se pudo cancelar el link.', 'error')
    }
  }

  // Splash for 2s after success, then receipt screen
  useEffect(() => {
    if (ck.successSale && !splashShown) {
      setSplashShown(true)
    }
  }, [ck.successSale, splashShown])

  const totals = computeTotals(ck.cartState.lines)
  const defaultBarber = ck.barbers.find((b) => b.id === ck.cartState.defaultBarberId) ?? ck.barbers[0]
  const cartItemCount = ck.cartState.lines.reduce((sum, l) => sum + l.qty, 0)
  // Total real a cobrar = subtotal - cupones. El API recalcula en el server
  // al cerrar venta, pero el cajero necesita ver el monto correcto en CTA
  // y PaymentSheet (validación de pagos vs total).
  const totalAfterDiscountCents = Math.max(0, totals.subtotalCents - ck.discountTotalCents)

  if (ck.successSale) {
    return (
      <ReceiptScreen
        sale={ck.successSale}
        locationName={locationName}
        operatorName={viewer?.staff?.fullName ?? null}
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

  // Cita ya prepagada (admin manual o Stripe link confirmado): el cajero solo
  // confirma entrega del servicio, no se cobra. Tiene prioridad sobre el caso
  // "no hay barberos" — si la cita está pagada, el cajero debe poder cerrarla
  // aunque el roster esté vacío.
  if (ck.isPrepaid && ck.prepaidSaleId) {
    const totalCents = ck.cartState.lines.reduce(
      (sum, l) => sum + l.unitPriceCents * l.qty,
      0,
    )
    const prepaidDate = ck.prepaidAt
      ? new Date(ck.prepaidAt).toLocaleDateString('es-MX')
      : null
    const methodLabel = prepayMethodLabel(ck.prepaidMethod)
    return (
      <div className="flex h-full flex-col bg-[var(--color-carbon)]">
        <PrepayHeader
          customer={ck.cartState.customer}
          lines={ck.cartState.lines}
          onBack={() => navigate('/hoy')}
        />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md border border-[var(--color-bone)] bg-[var(--color-bone)] p-8 text-[var(--color-carbon)]">
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-carbon)]/60">
              Prepagado
            </div>
            <div className="mb-4 font-mono text-4xl font-extrabold tabular-nums">
              {formatMoney(totalCents)}
            </div>
            <p className="text-[15px] leading-snug text-[var(--color-carbon)]/80">
              Esta cita ya fue cobrada por adelantado
              {prepaidDate ? ` el ${prepaidDate}` : ''}
              {methodLabel ? ` vía ${methodLabel}` : ''}.
            </p>
          </div>
        </div>
        <div className="border-t border-[var(--color-leather-muted)]/40 p-4">
          <button
            type="button"
            onClick={handleCloseSale}
            disabled={closing}
            className="w-full cursor-pointer bg-[var(--color-success)] py-4 font-mono text-sm font-bold uppercase tracking-[0.18em] text-[var(--color-bone)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {closing ? 'Cerrando…' : 'Cerrar cita y completar servicio'}
          </button>
        </div>
      </div>
    )
  }

  // Link de prepago pendiente (cliente recibió Stripe link pero no pagó). El
  // cajero puede cancelar el link y cobrar en persona (cae al flujo normal
  // de POS via refetch) o salir y dejar que el cliente complete el link.
  if (ck.hasPendingLink && ck.prepaidSaleId) {
    return (
      <div className="flex h-full flex-col bg-[var(--color-carbon)]">
        <PrepayHeader
          customer={ck.cartState.customer}
          lines={ck.cartState.lines}
          onBack={() => navigate('/hoy')}
        />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md border border-[var(--color-warning)] bg-[var(--color-warning)]/10 p-6 text-[var(--color-bone)]">
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-warning)]">
              Link de pago pendiente
            </div>
            <p className="text-[15px] leading-snug">
              Hay un link de pago enviado a este cliente que todavía no se ha
              pagado. Revisa con el cliente antes de cerrar.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-[var(--color-leather-muted)]/40 p-4">
          <button
            type="button"
            onClick={handleCancelLinkAndPayInPerson}
            disabled={cancellingLink}
            className="w-full cursor-pointer bg-[var(--color-bravo)] py-3 font-mono text-sm font-bold uppercase tracking-[0.18em] text-[var(--color-bone)] hover:bg-[var(--color-bravo-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancellingLink ? 'Cancelando link…' : 'Cobrar ahora en POS'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/hoy')}
            className="w-full cursor-pointer bg-[var(--color-cuero-viejo)] py-3 font-mono text-sm font-bold uppercase tracking-[0.18em] text-[var(--color-bone)] hover:bg-[var(--color-cuero-viejo-hover)]"
          >
            Volver al inicio
          </button>
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
          // Sin customers.read, deshabilitar la búsqueda. El cliente actual
          // adjunto (de un walk-in iniciado) se sigue mostrando, pero el
          // chip deja de abrir el sheet de lookup.
          onTap={canReadCustomers ? () => setCustomerSheetOpen(true) : () => {}}
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
      <CouponsBlock
        appliedCoupons={ck.appliedCoupons}
        couponError={ck.couponError}
        onApply={ck.applyCoupon}
        onRemove={ck.removeCoupon}
        canApply={canApplyCoupon}
      />
      <CartTotals
        subtotalCents={totals.subtotalCents}
        discountTotalCents={ck.discountTotalCents}
      />
      {ck.error && (
        <div role="alert" className="mx-4 border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/[0.06] px-4 py-3">
          <p className="text-[13px] text-[var(--color-bravo)]">{ck.error}</p>
        </div>
      )}
      {canCreateSale && canCloseSale ? (
        <CobrarCTA
          totalCents={totalAfterDiscountCents}
          disabled={ck.cartState.lines.length === 0 || ck.submitting}
          onTap={() => setPaymentSheetOpen(true)}
        />
      ) : (
        <div className="mx-4 mt-3 border border-dashed border-[var(--color-leather-muted)] p-4 text-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-bone-muted)]">
            Tu rol no puede cobrar
          </p>
          <p className="mt-1 text-[12px] text-[var(--color-bone-muted)]">
            Necesitas <code className="font-mono">pos.sale.create</code> y <code className="font-mono">pos.sale.close</code>. Pide a un administrador que ajuste tu rol POS.
          </p>
        </div>
      )}
    </>
  )

  // Sin lecturas de catálogo no hay nada útil que mostrar en checkout —
  // ni la grilla ni el carrito tienen sentido. Saca un estado claro en
  // lugar de un grid vacío silencioso.
  if (!canReadServices && !canReadProducts) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-bone-muted)]">
            Sin acceso
          </p>
          <h1
            className="mb-2 text-2xl font-bold text-[var(--color-bone)]"
            style={{ fontFamily: 'var(--font-pos-display)' }}
          >
            Cobrar
          </h1>
          <p className="text-sm text-[var(--color-bone-muted)]">
            Tu rol no puede leer catálogo de servicios ni productos. Pide a un administrador que añada{' '}
            <code className="font-mono text-[var(--color-bone)]">catalog.services.read</code> o{' '}
            <code className="font-mono text-[var(--color-bone)]">catalog.products.read</code> a tu rol POS.
          </p>
        </div>
      </div>
    )
  }

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
              {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} · {formatMoney(totalAfterDiscountCents)}
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
        totalCents={totalAfterDiscountCents}
        submitting={ck.submitting}
        error={ck.error}
        canAddTip={canAddTip}
        onClose={() => setPaymentSheetOpen(false)}
        onConfirm={async (input) => {
          // input: { payments: [{ provider, amountCents }], tipCents }
          const result = await ck.submit({
            payments: input.payments,
            tipCents: input.tipCents,
          })
          if (result) setPaymentSheetOpen(false)
        }}
      />
    </div>
  )
}

// Header simplificado para los branches de prepago. No usa los componentes
// principales del checkout (AtendiendoHeader, CustomerChip) porque esos
// dependen de un barbero asignado — irrelevante cuando la cita ya fue
// cobrada (o cuando un link está pendiente y aún no hay caja abierta).
interface PrepayHeaderProps {
  customer: { id: string; fullName: string } | null
  lines: Array<{ id: string; name: string; qty: number }>
  onBack: () => void
}

function PrepayHeader({ customer, lines, onBack }: PrepayHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        className="cursor-pointer font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
      >
        ← Hoy
      </button>
      <div className="flex min-w-0 flex-col items-end gap-0.5">
        <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
          {customer?.fullName ?? 'Sin cliente'}
        </span>
        <span className="truncate text-[12px] text-[var(--color-bone)]">
          {lines.length === 0
            ? 'Cita'
            : lines.map((l) => `${l.qty}× ${l.name}`).join(' · ')}
        </span>
      </div>
    </header>
  )
}
