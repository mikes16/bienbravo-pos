interface ContextualCTABarProps {
  metaLabel?: string
  actionLabel: string
  variant: 'cobrar' | 'atender' | 'abrir-caja' | 'nueva-venta'
  onClick: () => void
}

export function ContextualCTABar({
  metaLabel,
  actionLabel,
  variant,
  onClick,
}: ContextualCTABarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-variant={variant}
      className="flex w-full shrink-0 cursor-pointer items-center justify-between gap-4 bg-[var(--color-bravo)] px-5 py-4 text-left text-[var(--color-bone)] transition-colors hover:bg-[var(--color-bravo-hover)]"
    >
      <div className="flex flex-col gap-0.5">
        {metaLabel && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone)]/75">
            {metaLabel}
          </span>
        )}
        <span className="text-[18px] font-extrabold leading-tight tracking-[-0.01em]">
          {actionLabel}
        </span>
      </div>
      <span className="text-[28px] font-thin leading-none">→</span>
    </button>
  )
}
