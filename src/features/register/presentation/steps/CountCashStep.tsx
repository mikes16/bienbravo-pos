import { CashCounter } from '@/shared/cash'
import { formatMoney } from '@/shared/lib/money'
import { type CashCounts, totalCountedCents } from '@/shared/cash/cashCounts'

export type { CashCounts }

interface CountCashStepProps {
  counts: CashCounts
  expectedCashCents: number
  onChange: (next: CashCounts) => void
}

export function CountCashStep({ counts, expectedCashCents, onChange }: CountCashStepProps) {
  const total = totalCountedCents(counts)

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      <p className="font-[var(--font-pos-display)] text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--color-bone)]">
        Cuenta el efectivo en caja
      </p>
      <p className="max-w-[540px] text-[13px] text-[var(--color-bone-muted)]">
        Saca los billetes y cuenta cuántos hay de cada denominación. El sistema suma automáticamente. Las monedas (menos de $20) van en una sola línea.
      </p>

      <CashCounter counts={counts} onChange={onChange} />

      <div className="flex items-baseline justify-between border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-5 py-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
            Total contado
          </p>
          <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
            Esperado: {formatMoney(expectedCashCents)}
          </p>
        </div>
        <p className="font-[var(--font-pos-display)] text-[32px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-bone)]">
          {formatMoney(total)}
        </p>
      </div>
    </div>
  )
}
