import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { formatMoney } from '@/shared/lib/money'
import { formatTimeInTz, formatShortDateInTz, localDayInTz } from '@/shared/lib/date'
import { useLocation } from '@/core/location/useLocation'
import type { RegisterSession, SaleLedgerEntry } from '../domain/register.types'

interface CajaOpenViewProps {
  session: RegisterSession
  todayTransactions: SaleLedgerEntry[]
  fondoCents: number
  /** null cuando el viewer no tiene `pos.register.close` — oculta el CTA. */
  onCerrar: (() => void) | null
}

export function CajaOpenView({ session, todayTransactions, fondoCents, onCerrar }: CajaOpenViewProps) {
  const { locationTimezone } = useLocation()
  // Session running total — API increments these as sales attribute to the session.
  // Not summed from todayTransactions to ensure consistency with backend totals.
  const sessionExpectedTotalCents =
    session.expectedCashCents + session.expectedCardCents + session.expectedTransferCents

  // "Desde {hora}" es honesto solo si la sesión abrió hoy. Una caja que quedó
  // abierta hace días (o abierta y luego cerrada remotamente) mostrando solo
  // "Desde 10:33" parece de hoy — engañoso. Si no es de hoy, prefijamos fecha
  // corta: "Desde 4 may · 10:33".
  const openedToday =
    localDayInTz(new Date(session.openedAt), locationTimezone) ===
    localDayInTz(new Date(), locationTimezone)
  const openedLabel = openedToday
    ? formatTimeInTz(session.openedAt, locationTimezone)
    : `${formatShortDateInTz(session.openedAt, locationTimezone)} · ${formatTimeInTz(session.openedAt, locationTimezone)}`

  return (
    <div className="flex h-full flex-col">
      {/* ── Status banner + totals ── */}
      <div className="flex flex-col gap-3 border-b border-[var(--color-leather-muted)]/40 px-5 py-4">
        <div className="flex items-center justify-between border border-[var(--color-success)]/40 bg-[var(--color-success)]/[0.06] px-3 py-2">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-2 w-2 bg-[var(--color-success)]" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-success)]">
              Caja abierta
            </span>
          </div>
          <span className="text-[11px] text-[var(--color-bone-muted)]">
            Desde {openedLabel} · fondo {formatMoney(fondoCents)}
          </span>
        </div>

        {/* ── Three totals cards ── */}
        <div className="grid grid-cols-3 gap-2">
          <div className="border border-[var(--color-leather-muted)]/40 border-l-[3px] border-l-[var(--color-bravo)] p-3.5">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
              Efectivo esperado
            </p>
            <p className="mt-1 text-[22px] font-extrabold tabular-nums text-[var(--color-bone)]">
              {formatMoney(session.expectedCashCents)}
            </p>
          </div>
          <div className="border border-[var(--color-leather-muted)]/40 p-3.5">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
              Tarjeta
            </p>
            <p className="mt-1 text-[22px] font-extrabold tabular-nums text-[var(--color-bone)]">
              {formatMoney(session.expectedCardCents)}
            </p>
          </div>
          <div className="border border-[var(--color-leather-muted)]/40 p-3.5">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
              Stripe
            </p>
            <p className="mt-1 text-[22px] font-extrabold tabular-nums text-[var(--color-bone)]">
              {formatMoney(session.expectedTransferCents)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Ledger de ventas de hoy ──
          TODO(ledger): hoy CajaPage pasa `todayTransactions={[]}` hardcodeado
          porque el ledger real de la sesión aún no está cableado al API. Un
          "Sin ventas todavía" permanente es una mentira peor que no mostrar
          nada, así que ocultamos la sección completa mientras esté vacía.
          Cuando se cablee el ledger real (leyendo las ventas de la sesión), la
          sección reaparece sola sin tocar este componente. El `flex-1` de
          relleno mantiene el CTA "Cerrar caja" pegado al fondo mientras tanto. */}
      {todayTransactions.length > 0 ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-[var(--color-leather-muted)]/40 px-5 py-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
              Ventas de hoy
            </span>
            <span className="text-[11px] text-[var(--color-bone-muted)]">
              {`${todayTransactions.length} ventas · ${formatMoney(sessionExpectedTotalCents)}`}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {todayTransactions.map((tx) => (
              <div
                key={tx.id}
                className="grid grid-cols-[60px_1fr_80px_80px] items-center gap-3 border-b border-[var(--color-leather-muted)]/30 px-5 py-2.5 text-[12px]"
              >
                <span className="font-mono text-[11px] tabular-nums text-[var(--color-bone-muted)]">
                  {formatTimeInTz(tx.createdAt, locationTimezone)}
                </span>
                <span className="text-[var(--color-bone)]">{tx.customer?.fullName ?? 'Mostrador'}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-bone-muted)]">
                  {tx.paymentStatus === 'PAID' ? 'Pagado' : 'Pendiente'}
                </span>
                <span className="text-right font-bold tabular-nums text-[var(--color-bone)]">
                  {formatMoney(tx.totalCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* ── Cerrar caja CTA — solo si el viewer tiene pos.register.close ── */}
      {onCerrar ? (
        <TouchButton
          variant="primary"
          size="primary"
          onClick={onCerrar}
          className="rounded-none uppercase tracking-[0.06em]"
        >
          Cerrar caja →
        </TouchButton>
      ) : (
        <div className="border-t border-[var(--color-leather-muted)]/40 px-5 py-4 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
            Tu rol no puede cerrar caja
          </p>
        </div>
      )}
    </div>
  )
}
