interface CustomerLite {
  id: string
  fullName: string
}

interface CustomerChipProps {
  customer: CustomerLite | null
  onTap: () => void
  onClear: () => void
}

export function CustomerChip({ customer, onTap, onClear }: CustomerChipProps) {
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
        className="flex-1 cursor-pointer text-left text-[13px] text-[var(--color-bone)]"
      >
        {customer.fullName}
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
