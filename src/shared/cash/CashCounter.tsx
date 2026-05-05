import { DenominationCounter } from '@/shared/pos-ui/DenominationCounter'
import { formatMoney } from '@/shared/lib/money'
import { type CashCounts, totalCountedCents } from './cashCounts'

interface CashCounterProps {
  counts: CashCounts
  onChange: (next: CashCounts) => void
  showTotal?: boolean
  totalLabelOverride?: string
  className?: string
}

export function CashCounter({
  counts,
  onChange,
  showTotal = false,
  totalLabelOverride,
  className,
}: CashCounterProps) {
  const total = totalCountedCents(counts)
  const update = (field: keyof CashCounts, value: number) => {
    onChange({ ...counts, [field]: value })
  }

  return (
    <div className={className}>
      <div className="flex flex-col border border-[var(--color-leather-muted)]/40">
        <DenominationCounter
          amountLabel="$500"
          denomination={500}
          subtotalCents={counts.d500 * 50000}
          count={counts.d500}
          onCountChange={(n) => update('d500', n)}
        />
        <DenominationCounter
          amountLabel="$200"
          denomination={200}
          subtotalCents={counts.d200 * 20000}
          count={counts.d200}
          onCountChange={(n) => update('d200', n)}
        />
        <DenominationCounter
          amountLabel="$100"
          denomination={100}
          subtotalCents={counts.d100 * 10000}
          count={counts.d100}
          onCountChange={(n) => update('d100', n)}
        />
        <DenominationCounter
          amountLabel="$50"
          denomination={50}
          subtotalCents={counts.d50 * 5000}
          count={counts.d50}
          onCountChange={(n) => update('d50', n)}
        />
        <DenominationCounter
          amountLabel="$20"
          denomination={20}
          subtotalCents={counts.d20 * 2000}
          count={counts.d20}
          onCountChange={(n) => update('d20', n)}
        />
        <DenominationCounter
          amountLabel="MONEDAS"
          subtotalCents={counts.coinsCents}
          isLumpSum
          lumpSumCents={counts.coinsCents}
          onLumpSumChange={(cents) => update('coinsCents', cents)}
        />
      </div>

      {showTotal && (
        <div
          data-cash-counter-total
          className="mt-3 flex items-baseline justify-between border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-5 py-4"
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
            {totalLabelOverride ?? 'Total contado'}
          </p>
          <p className="font-[var(--font-pos-display)] text-[32px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-bone)]">
            {formatMoney(total)}
          </p>
        </div>
      )}
    </div>
  )
}
