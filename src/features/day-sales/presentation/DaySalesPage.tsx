import { useState, useEffect, useCallback, useMemo } from 'react'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'
import { localDayInTz, formatTimeInTz, formatShortDateInTz } from '@/shared/lib/date'
import { useLocation } from '@/core/location/useLocation'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { useLiveRefresh } from '@/core/freshness/useLiveRefresh'
import { MoneyValue, TouchButton, type MoneyValueStatus } from '@/shared/pos-ui'
import { DAY_SALE_STATUS_LABEL, type DaySale } from '../domain/day-sales.types'
import { barbersInSales, filterByBarber, totalsOf } from '../lib/day-sales.filters'
import { DaySaleSheet } from './DaySaleSheet'
import { useReprintTicket } from './useReprintTicket'
import { ReprintTicketHost } from './ReprintTicketHost'

const LOAD_ERROR_MESSAGE =
  'No se pudieron cargar las ventas del día. Refresca o avisa al admin si persiste.'

/**
 * Tab "Ventas del día": todas las ventas de la sucursal hoy (de cualquier
 * barbero), con filtro por barbero y reimpresión de ticket. Visible solo con
 * `pos.sales.day.read` (PosShell); el API exige el mismo permiso.
 *
 * Carga el día completo y filtra en cliente: el chip cambia al instante y no
 * hay un round-trip por barbero. El dato SIEMPRE viene de la red (clase
 * DINERO/SENSIBLE) y la pantalla no vigila por su cuenta ni el socket ni el
 * foco de la ventana: se registra en el canal de frescura (tema `sales`) y
 * ahí se entera de las ventas de otras terminales. Esa es la causa de R8 —
 * una terminal siempre en primer plano nunca volvía a preguntar.
 */
export function DaySalesPage() {
  const { locationId, locationTimezone } = useLocation()
  const { daySales } = useRepositories()
  const [sales, setSales] = useState<DaySale[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [barberId, setBarberId] = useState<string | null>(null)
  const [openSale, setOpenSale] = useState<DaySale | null>(null)
  const { printTarget, requestPrint } = useReprintTicket()

  const today = localDayInTz(new Date(), locationTimezone)

  // Recarga por aviso del servidor o por "Reintentar". Devuelve la promesa y
  // la deja fallar: el canal de frescura sólo mueve la hora del último dato
  // si TODAS las pantallas resolvieron. Nunca se invoca desde el cuerpo
  // síncrono de un efecto (ver el mount, abajo).
  const load = useCallback((): Promise<void> => {
    if (!locationId) return Promise.resolve()
    setLoadError(null)
    setRefreshing(true)
    return daySales
      .getDaySales(locationId, localDayInTz(new Date(), locationTimezone))
      .then((rows) => {
        setSales(rows)
      })
      .catch((err: unknown) => {
        // Nunca "0 ventas" en silencio, y nunca la lista anterior como si
        // fuera la de ahora: lo viejo se tira y se avisa.
        setSales(null)
        setLoadError(LOAD_ERROR_MESSAGE)
        throw err
      })
      .finally(() => {
        setRefreshing(false)
      })
  }, [daySales, locationId, locationTimezone])

  useLiveRefresh(load, ['sales'])

  // Carga inicial: el efecto solo lanza el fetch, cero setState síncrono en
  // su cuerpo (mismo patrón que LocationProvider). El estado inicial ya es
  // "no sé" (sales=null, loadError=null), así que no hace falta repetirlo
  // aquí; todo lo que escribe estado vive en los callbacks de la promesa, con
  // `cancelled` en el cleanup para no pintar sobre un componente desmontado.
  useEffect(() => {
    if (!locationId) return
    let cancelled = false
    daySales
      .getDaySales(locationId, localDayInTz(new Date(), locationTimezone))
      .then((rows) => {
        if (cancelled) return
        setSales(rows)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError(LOAD_ERROR_MESSAGE)
      })
    return () => {
      cancelled = true
    }
  }, [daySales, locationId, locationTimezone])

  const retry = useCallback(() => {
    // El fallo ya se pinta en el aviso; acá sólo se evita la promesa suelta.
    void load().catch(() => {})
  }, [load])

  const barbers = useMemo(() => barbersInSales(sales ?? []), [sales])
  // Si el barbero filtrado ya no aparece (refetch), el filtro vuelve a Todos.
  const effectiveBarberId = barberId && barbers.some((b) => b.id === barberId) ? barberId : null
  const visible = useMemo(() => filterByBarber(sales ?? [], effectiveBarberId), [sales, effectiveBarberId])
  const totals = useMemo(() => totalsOf(visible), [visible])

  // "No sé" y "cero real" son cosas distintas (spec § 3.1b): mientras no haya
  // respuesta del servidor la cifra es esqueleto, nunca $0 ni el total previo.
  const moneyStatus: MoneyValueStatus = loadError
    ? 'offline'
    : sales === null
      ? 'loading'
      : refreshing
        ? 'updating'
        : 'fresh'

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
        <div className="flex flex-col items-end text-right">
          <MoneyValue
            status={moneyStatus}
            // `null` mientras no hay respuesta: MoneyValue pinta esqueleto.
            cents={sales === null ? null : totals.paidTotalCents}
            label="Total cobrado del día"
            size="S"
            className="items-end"
          />
          {sales !== null && (
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
              {totals.paidCount} {totals.paidCount === 1 ? 'venta cobrada' : 'ventas cobradas'}
              {totals.voidedCount > 0 ? ` · ${totals.voidedCount} anulada${totals.voidedCount === 1 ? '' : 's'}` : ''}
            </p>
          )}
        </div>
      </div>

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
            {sales === null ? 'Tickets' : `Tickets · ${visible.length}`}
          </p>
          <span aria-hidden className="h-px flex-1 bg-[var(--color-leather-muted)]/30" />
        </div>

        {loadError ? (
          // La lista vieja no se queda haciéndose pasar por la de ahora.
          <div
            role="alert"
            className="flex flex-col items-start gap-3 border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/10 px-4 py-3"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-bravo)]">{loadError}</p>
            <TouchButton variant="secondary" size="min" onClick={retry}>
              Reintentar
            </TouchButton>
          </div>
        ) : sales === null ? (
          // Filas esqueleto, nunca una lista vacía que parezca "no hubo ventas".
          <ul className="flex flex-col gap-px border border-[var(--color-leather-muted)]/40">
            {[1, 2, 3].map((i) => (
              <li key={i} className="h-16 animate-pulse bg-[var(--color-cuero-viejo)]/30 motion-reduce:animate-none" />
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
