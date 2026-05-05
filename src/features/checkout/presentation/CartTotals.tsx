import { formatMoney } from '@/shared/lib/money'

interface CartTotalsProps {
  subtotalCents: number
}

export function CartTotals({ subtotalCents }: CartTotalsProps) {
  return (
    <div className="flex items-baseline justify-between border-t border-[var(--color-leather-muted)]/40 px-4 py-3">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
        Total
      </span>
      <span className="font-[var(--font-pos-display)] text-[28px] font-extrabold tabular-nums leading-none text-[var(--color-bone)]">
        {formatMoney(subtotalCents)}
      </span>
    </div>
  )
}
