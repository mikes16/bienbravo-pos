import { ReputationBadge } from '@/shared/pos-ui'
import { reputationMark, type CustomerReputationTag } from '@/shared/lib/reputation'

interface CustomerLite {
  id: string
  fullName: string
  reputationTag?: CustomerReputationTag | null
}

interface CustomerChipProps {
  customer: CustomerLite | null
  onTap: () => void
  onClear: () => void
}

export function CustomerChip({ customer, onTap, onClear }: CustomerChipProps) {
  const mark = customer ? reputationMark(customer.reputationTag) : null
  if (customer === null) {
    return (
      <button
        type="button"
        onClick={onTap}
        aria-label="+ Cliente (opcional)"
        className="flex w-full cursor-pointer items-center gap-2 border border-dashed border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 py-2 text-[13px] text-[var(--color-bone-muted)] transition-colors hover:bg-[var(--color-cuero-viejo)]"
      >
        <span className="font-mono text-[14px]">+</span>
        <span>Cliente <span className="text-[10px] uppercase tracking-[0.18em]">opcional</span></span>
      </button>
    )
  }
  return (
    <div className="flex w-full items-center gap-2 border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 py-2">
      <button
        type="button"
        onClick={onTap}
        className="flex min-w-0 flex-1 items-center gap-2 cursor-pointer text-left text-[13px] text-[var(--color-bone)]"
      >
        <span className="min-w-0 truncate">{customer.fullName}</span>
        {mark && <ReputationBadge mark={mark} />}
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label="Quitar cliente"
        className="cursor-pointer font-mono text-[14px] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
      >
        ×
      </button>
    </div>
  )
}
