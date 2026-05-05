import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { formatMoney } from '@/shared/lib/money'
import type { RegisterSession } from '../domain/register.types'

interface SaleLedgerEntry {
  id: string
  createdAt: string
  totalCents: number
  paymentStatus: string
  customer: { fullName: string } | null
  appointmentId: string | null
  walkInId: string | null
}

interface CajaOpenViewProps {
  session: RegisterSession
  todayTransactions: SaleLedgerEntry[]
  fondoCents: number
  onCerrar: () => void
}

function formatTimeMx(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function inferPaymentLabel(tx: SaleLedgerEntry): string {
  return tx.paymentStatus === 'PAID' ? 'Pagado' : 'Pendiente'
}

export function CajaOpenView({ session, todayTransactions, fondoCents, onCerrar }: CajaOpenViewProps) {
  const totalAll = session.expectedCashCents + session.expectedCardCents + session.expectedTransferCents

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
            Desde {formatTimeMx(session.openedAt)} · fondo {formatMoney(fondoCents)}
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

      {/* ── Transactions ledger ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-baseline justify-between border-b border-[var(--color-leather-muted)]/40 px-5 py-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
            Ventas de hoy
          </span>
          <span className="text-[11px] text-[var(--color-bone-muted)]">
            {todayTransactions.length === 0
              ? 'Sin ventas todavía'
              : `${todayTransactions.length} ventas · ${formatMoney(totalAll)}`}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {todayTransactions.length === 0 ? (
            <div className="flex h-full items-center justify-center px-5 py-8 text-center">
              <p className="text-[12px] text-[var(--color-bone-muted)]">
                Cuando empieces a cobrar, las ventas aparecen aquí.
              </p>
            </div>
          ) : (
            todayTransactions.map((tx) => (
              <div
                key={tx.id}
                className="grid grid-cols-[60px_1fr_80px_80px] items-center gap-3 border-b border-[var(--color-leather-muted)]/30 px-5 py-2.5 text-[12px]"
              >
                <span className="font-mono text-[11px] tabular-nums text-[var(--color-bone-muted)]">
                  {formatTimeMx(tx.createdAt)}
                </span>
                <span className="text-[var(--color-bone)]">{tx.customer?.fullName ?? 'Mostrador'}</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-bone-muted)]">
                  {inferPaymentLabel(tx)}
                </span>
                <span className="text-right font-bold tabular-nums text-[var(--color-bone)]">
                  {formatMoney(tx.totalCents)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Cerrar caja CTA ── */}
      <TouchButton
        variant="primary"
        size="primary"
        onClick={onCerrar}
        className="rounded-none uppercase tracking-[0.06em]"
      >
        Cerrar caja →
      </TouchButton>
    </div>
  )
}
