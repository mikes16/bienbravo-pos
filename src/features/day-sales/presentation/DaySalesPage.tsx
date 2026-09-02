import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'
import { localDayInTz, formatTimeInTz, formatShortDateInTz } from '@/shared/lib/date'
import { useLocation } from '@/core/location/useLocation'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { POS_HOME_SALE_EVENT } from '@/features/home/data/home.queries'
import { DAY_SALE_STATUS_LABEL, type DaySale } from '../domain/day-sales.types'
import { barbersInSales, filterByBarber, totalsOf } from '../lib/day-sales.filters'
import { DaySaleSheet } from './DaySaleSheet'
import { useReprintTicket } from './useReprintTicket'
import { ReprintTicketHost } from './ReprintTicketHost'

/**
 * Tab "Ventas del día": todas las ventas de la sucursal hoy (de cualquier
 * barbero), con filtro por barbero y reimpresión de ticket. Visible solo con
 * `pos.sales.day.read` (PosShell); el API exige el mismo permiso.
 *
 * Carga el día completo una vez y filtra en cliente: el chip cambia al
 * instante y no hay un round-trip por barbero. Refresca en silencio con la
 * subscription `saleEvent` de la sucursal y al volver a la pestaña.
 */
export function DaySalesPage() {
  const apollo = useApolloClient()
  const { locationId, locationSlug, locationTimezone } = useLocation()
  const { daySales } = useRepositories()
  const [sales, setSales] = useState<DaySale[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [barberId, setBarberId] = useState<string | null>(null)
  const [openSale, setOpenSale] = useState<DaySale | null>(null)
  const { printTarget, requestPrint } = useReprintTicket()

  const today = localDayInTz(new Date(), locationTimezone)

  const load = useCallback(
    (opts: { showSpinner: boolean; force: boolean }) => {
      if (!locationId) return
      if (opts.showSpinner) setLoading(true)
      setLoadError(null)
      daySales
        .getDaySales(locationId, localDayInTz(new Date(), locationTimezone), { force: opts.force })
        .then((rows) => setSales(rows))
        .catch(() => {
          // Nunca "0 ventas" en silencio: si falló la red, se dice.
          setLoadError('No se pudieron cargar las ventas del día. Refresca o avisa al admin si persiste.')
        })
        .finally(() => setLoading(false))
    },
    [daySales, locationId, locationTimezone],
  )

  useEffect(() => {
    load({ showSpinner: true, force: false })
  }, [load])

  useEffect(() => {
    if (!locationSlug) return
    const obs = apollo.subscribe({ query: POS_HOME_SALE_EVENT, variables: { slug: locationSlug } })
    const sub = obs.subscribe({
      next: () => load({ showSpinner: false, force: true }),
      error: (err) => {
        if (import.meta.env.DEV) {
          console.warn('[DaySalesPage] sale subscription error', err)
        }
      },
    })
    return () => sub.unsubscribe()
  }, [apollo, locationSlug, load])

  useEffect(() => {
    const onFocus = () => load({ showSpinner: false, force: true })
    const onVisible = () => {
      if (document.visibilityState === 'visible') load({ showSpinner: false, force: true })
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const barbers = useMemo(() => barbersInSales(sales ?? []), [sales])
  // Si el barbero filtrado ya no aparece (refetch), el filtro vuelve a Todos.
  const effectiveBarberId = barberId && barbers.some((b) => b.id === barberId) ? barberId : null
  const visible = useMemo(() => filterByBarber(sales ?? [], effectiveBarberId), [sales, effectiveBarberId])
  const totals = useMemo(() => totalsOf(visible), [visible])

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-6 py-5 pb-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-[var(--font-pos-display)] text-[28px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
            Ventas del día
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
            {formatShortDateInTz(`${today}T12:00:00.000Z`, 'UTC')}
          </p>
        </div>
        <div className="text-right">
          {loading ? (
            <div className="h-8 w-28 animate-pulse bg-[var(--color-leather-muted)]/20" />
          ) : (
            <>
              <p className="font-[var(--font-pos-display)] text-[28px] font-extrabold tabular-nums leading-none text-[var(--color-bone)]">
                {formatMoney(totals.paidTotalCents)}
              </p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
                {totals.paidCount} {totals.paidCount === 1 ? 'venta cobrada' : 'ventas cobradas'}
                {totals.voidedCount > 0 ? ` · ${totals.voidedCount} anulada${totals.voidedCount === 1 ? '' : 's'}` : ''}
              </p>
            </>
          )}
        </div>
      </div>

      {loadError && (
        <div role="alert" className="border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/10 px-4 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-bravo)]">{loadError}</p>
        </div>
      )}

      {/* Filtro por barbero: chips. Solo aparecen quienes participaron hoy. */}
      {barbers.length > 0 && (
        <div role="group" aria-label="Filtrar por barbero" className="flex flex-wrap gap-2">
          <FilterChip label="Todos" active={effectiveBarberId === null} onClick={() => setBarberId(null)} />
          {barbers.map((b) => (
            <FilterChip
              key={b.id}
              label={b.fullName}
              active={effectiveBarberId === b.id}
              onClick={() => setBarberId(b.id)}
            />
          ))}
        </div>
      )}

      <section className="flex flex-1 flex-col">
        <div className="mb-3 flex items-center gap-3">
          <span aria-hidden className="font-mono text-[12px] text-[var(--color-leather)]">//</span>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
            {loading ? 'Tickets' : `Tickets · ${visible.length}`}
          </p>
          <span aria-hidden className="h-px flex-1 bg-[var(--color-leather-muted)]/30" />
        </div>

        {loading ? (
          <ul className="flex flex-col gap-px border border-[var(--color-leather-muted)]/40">
            {[1, 2, 3].map((i) => (
              <li key={i} className="h-16 animate-pulse bg-[var(--color-cuero-viejo)]/30" />
            ))}
          </ul>
        ) : visible.length === 0 ? (
          <div className="border border-[var(--color-leather-muted)]/40 px-5 py-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
              {effectiveBarberId ? 'Sin ventas de este barbero hoy.' : 'Aún no hay ventas hoy.'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col border border-[var(--color-leather-muted)]/40">
            {visible.map((s) => (
              <li key={s.id}>
                <SaleRow sale={s} tz={locationTimezone} onOpen={() => setOpenSale(s)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <DaySaleSheet sale={openSale} onClose={() => setOpenSale(null)} onReprint={requestPrint} />
      <ReprintTicketHost sale={printTarget} />
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-h-[var(--pos-touch-min)] cursor-pointer border px-4 font-mono text-[11px] font-bold uppercase tracking-[0.18em] transition-colors',
        active
          ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/15 text-[var(--color-bone)]'
          : 'border-[var(--color-leather-muted)] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]',
      )}
    >
      {label}
    </button>
  )
}

function SaleRow({ sale, tz, onOpen }: { sale: DaySale; tz: string; onOpen: () => void }) {
  const customerName = sale.customer?.fullName ?? 'Mostrador'
  const conceptLabel = sale.items.length > 0 ? sale.items.map((it) => it.name).join(' · ') : '—'
  const barberLabel = sale.barbers.map((b) => b.fullName).join(' + ')
  const statusLabel = DAY_SALE_STATUS_LABEL[sale.status]
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Ver ticket de ${customerName}`}
      className="grid w-full cursor-pointer grid-cols-[64px_1fr_auto] items-start gap-4 border-b border-[var(--color-leather-muted)]/20 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--color-cuero-viejo)]/20"
    >
      <span className="pt-0.5 font-mono text-[14px] font-bold tabular-nums text-[var(--color-bone)]">
        {formatTimeInTz(sale.createdAt, tz)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold text-[var(--color-bone)]">{customerName}</p>
        <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
          {conceptLabel}
        </p>
        {barberLabel && (
          <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-leather)]">
            {barberLabel}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span
          className={cn(
            'font-[var(--font-pos-display)] text-[20px] font-extrabold tabular-nums leading-none',
            statusLabel ? 'text-[var(--color-bone-muted)] line-through' : 'text-[var(--color-bone)]',
          )}
        >
          {formatMoney(sale.totalCents)}
        </span>
        {statusLabel ? (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--color-bravo)]">
            {statusLabel}
          </span>
        ) : sale.tipCents > 0 ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
            incl. {formatMoney(sale.tipCents)} propina
          </span>
        ) : null}
      </div>
    </button>
  )
}
