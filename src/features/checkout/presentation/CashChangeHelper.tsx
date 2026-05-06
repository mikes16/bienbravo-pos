import { CashCounter } from '@/shared/cash'
import { type CashCounts, totalCountedCents } from '@/shared/cash/cashCounts'
import { formatMoney } from '@/shared/lib/money'

interface CashChangeHelperProps {
  totalCents: number
  counts: CashCounts
  onCountsChange: (next: CashCounts) => void
}

export function CashChangeHelper({ totalCents, counts, onCountsChange }: CashChangeHelperProps) {
  const receivedCents = totalCountedCents(counts)
  const shortfallCents = Math.max(0, totalCents - receivedCents)
  const changeCents = Math.max(0, receivedCents - totalCents)
  // While the operator is still counting bills, the missing amount is the
  // useful number — "Cambio $0" looks like a passing state. Swap the bottom
  // row to "Falta" in bravo until they hit the total, then flip to "Cambio".
  const isShort = shortfallCents > 0

  return (
    <div className="flex flex-col gap-3">
      <CashCounter
        counts={counts}
        onChange={onCountsChange}
        showTotal
        totalLabelOverride="Recibido"
      />
      <div
        className={
          isShort
            ? 'flex items-baseline justify-between border border-[var(--color-bravo)]/50 bg-[var(--color-bravo)]/[0.06] px-5 py-3'
            : 'flex items-baseline justify-between border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-5 py-3'
        }
      >
        <span
          className={
            isShort
              ? 'font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]'
              : 'font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]'
          }
        >
          {isShort ? 'Falta' : 'Cambio'}
        </span>
        <span
          className={
            isShort
              ? 'font-[var(--font-pos-display)] text-[22px] font-extrabold tabular-nums text-[var(--color-bravo)]'
              : 'font-[var(--font-pos-display)] text-[22px] font-extrabold tabular-nums text-[var(--color-bone)]'
          }
        >
          {formatMoney(isShort ? shortfallCents : changeCents)}
        </span>
      </div>
    </div>
  )
}
