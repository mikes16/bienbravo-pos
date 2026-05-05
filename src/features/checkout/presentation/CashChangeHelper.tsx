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
  const changeCents = Math.max(0, receivedCents - totalCents)

  return (
    <div className="flex flex-col gap-3">
      <CashCounter
        counts={counts}
        onChange={onCountsChange}
        showTotal
        totalLabelOverride="Recibido"
      />
      <div className="flex items-baseline justify-between border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-5 py-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Cambio
        </span>
        <span className="font-[var(--font-pos-display)] text-[22px] font-extrabold tabular-nums text-[var(--color-bone)]">
          {formatMoney(changeCents)}
        </span>
      </div>
    </div>
  )
}
