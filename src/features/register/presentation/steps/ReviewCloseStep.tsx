import { formatMoney } from '@/shared/lib/money'
import { cn } from '@/shared/lib/cn'

interface Channels {
  cashCents: number
  cardCents: number
  transferCents: number
}

interface ReviewCloseStepProps {
  expected: Channels
  counted: Channels
  confirmAck: boolean
  onConfirmAckChange: (ack: boolean) => void
}

const LARGE_DIFF_THRESHOLD_CENTS = 5000 // $50

export function ReviewCloseStep({
  expected,
  counted,
  confirmAck,
  onConfirmAckChange,
}: ReviewCloseStepProps) {
  const cashDiff = counted.cashCents - expected.cashCents
  const cardDiff = counted.cardCents - expected.cardCents
  const transferDiff = counted.transferCents - expected.transferCents
  const totalDiff = cashDiff + cardDiff + transferDiff

  const hasDiff = totalDiff !== 0
  const isLargeDiff = Math.abs(totalDiff) > LARGE_DIFF_THRESHOLD_CENTS

  const diffClass = (diff: number) =>
    cn(
      'py-2 text-right tabular-nums text-[14px] font-bold',
      diff === 0 && 'text-[var(--color-bone-muted)]',
      diff !== 0 && Math.abs(diff) <= LARGE_DIFF_THRESHOLD_CENTS && 'text-[var(--color-warning)]',
      Math.abs(diff) > LARGE_DIFF_THRESHOLD_CENTS && 'text-[var(--color-bravo)]',
    )

  const formatDiff = (d: number) =>
    d === 0 ? '—' : (d > 0 ? '+' : '') + formatMoney(d)

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      <p className="font-[var(--font-pos-display)] text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--color-bone)]">
        Revisa el resumen del cierre
      </p>

      <div className="border border-[var(--color-leather-muted)]/40">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 border-b border-[var(--color-leather-muted)]/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
          <span></span>
          <span className="text-right">Contado</span>
          <span className="text-right">Esperado</span>
          <span className="text-right">Diferencia</span>
        </div>

        {/* Efectivo row */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 border-b border-[var(--color-leather-muted)]/30 px-4">
          <span className="py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
            Efectivo
          </span>
          <span className="py-2 text-right tabular-nums text-[14px] text-[var(--color-bone)]">
            {formatMoney(counted.cashCents)}
          </span>
          <span className="py-2 text-right tabular-nums text-[12px] text-[var(--color-bone-muted)]">
            {formatMoney(expected.cashCents)}
          </span>
          <span className={diffClass(cashDiff)}>{formatDiff(cashDiff)}</span>
        </div>

        {/* Tarjeta row */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 border-b border-[var(--color-leather-muted)]/30 px-4">
          <span className="py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
            Tarjeta
          </span>
          <span className="py-2 text-right tabular-nums text-[14px] text-[var(--color-bone)]">
            {formatMoney(counted.cardCents)}
          </span>
          <span className="py-2 text-right tabular-nums text-[12px] text-[var(--color-bone-muted)]">
            {formatMoney(expected.cardCents)}
          </span>
          <span className={diffClass(cardDiff)}>{formatDiff(cardDiff)}</span>
        </div>

        {/* Stripe row */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 border-b border-[var(--color-leather-muted)]/30 px-4">
          <span className="py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
            Stripe
          </span>
          <span className="py-2 text-right tabular-nums text-[14px] text-[var(--color-bone)]">
            {formatMoney(counted.transferCents)}
          </span>
          <span className="py-2 text-right tabular-nums text-[12px] text-[var(--color-bone-muted)]">
            {formatMoney(expected.transferCents)}
          </span>
          <span className={diffClass(transferDiff)}>{formatDiff(transferDiff)}</span>
        </div>

        {/* Total row */}
        <div className="flex items-baseline justify-between border-t border-[var(--color-leather-muted)]/40 px-4 py-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone)]">
            TOTAL
          </span>
          <span
            className={cn(
              'tabular-nums text-[20px] font-extrabold',
              totalDiff === 0 && 'text-[var(--color-success)]',
              totalDiff !== 0 && !isLargeDiff && 'text-[var(--color-warning)]',
              isLargeDiff && 'text-[var(--color-bravo)]',
            )}
          >
            {totalDiff === 0 ? '$0 exacto' : (totalDiff > 0 ? '+' : '') + formatMoney(totalDiff)}
          </span>
        </div>
      </div>

      {!hasDiff ? (
        <div className="flex items-center gap-2 border border-[var(--color-success)]/40 bg-[var(--color-success)]/[0.06] px-4 py-3">
          <span aria-hidden className="h-2 w-2 bg-[var(--color-success)]" />
          <span className="text-[13px] text-[var(--color-success)]">
            Todo cuadra · listo para cerrar
          </span>
        </div>
      ) : (
        <>
          <div
            role="alert"
            className={cn(
              'border px-4 py-3',
              isLargeDiff
                ? 'border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/[0.06] text-[var(--color-bravo)]'
                : 'border-[var(--color-warning)]/40 bg-[var(--color-warning)]/[0.06] text-[var(--color-warning)]',
            )}
          >
            <p className="text-[13px]">
              {totalDiff < 0 ? 'Faltante' : 'Sobrante'} de {formatMoney(Math.abs(totalDiff))}.
              {isLargeDiff ? ' Es una diferencia grande.' : ''}
            </p>
          </div>
          <label className="flex min-h-[var(--pos-touch-min)] cursor-pointer items-center gap-3 border border-[var(--color-leather-muted)]/40 px-4 py-3">
            <input
              type="checkbox"
              checked={confirmAck}
              onChange={(e) => onConfirmAckChange(e.target.checked)}
              className="h-4 w-4 cursor-pointer"
            />
            <span className="text-[13px] text-[var(--color-bone)]">
              Sí, confirmo el cierre con esta diferencia
            </span>
          </label>
        </>
      )}
    </div>
  )
}
