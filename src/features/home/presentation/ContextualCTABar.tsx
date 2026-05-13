interface ContextualCTABarProps {
  metaLabel?: string
  actionLabel: string
  variant: 'cobrar' | 'atender' | 'abrir-caja' | 'nueva-venta'
  onClick: () => void
  /** When true, the CTA is disabled, dimmed and shows a spinner. */
  busy?: boolean
}

export function ContextualCTABar({
  metaLabel,
  actionLabel,
  variant,
  onClick,
  busy = false,
}: ContextualCTABarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      data-variant={variant}
      className="flex w-full shrink-0 items-center justify-between gap-4 bg-[var(--color-bravo)] px-5 py-4 text-left text-[var(--color-bone)] transition-colors hover:bg-[var(--color-bravo-hover)] disabled:cursor-wait disabled:opacity-70 disabled:hover:bg-[var(--color-bravo)] enabled:cursor-pointer"
    >
      <div className="flex flex-col gap-0.5">
        {metaLabel && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone)]/75">
            {metaLabel}
          </span>
        )}
        <span className="text-[18px] font-extrabold leading-tight tracking-[-0.01em]">
          {busy ? 'Cargando…' : actionLabel}
        </span>
      </div>
      {busy ? (
        <span
          aria-hidden
          className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-bone)]/30 border-t-[var(--color-bone)]"
        />
      ) : (
        <span className="text-[28px] font-thin leading-none">→</span>
      )}
    </button>
  )
}
