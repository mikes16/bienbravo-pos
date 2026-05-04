import { cn } from '@/shared/lib/cn'

interface StatusChip {
  label: string
  tone?: 'default' | 'success'
}

interface StatusBoardProps {
  chips: StatusChip[]
  className?: string
}

export function StatusBoard({ chips, className }: StatusBoardProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {chips.map((chip, i) => (
        <span
          key={`${chip.label}-${i}`}
          className={cn(
            'border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em]',
            chip.tone === 'success'
              ? 'border-[var(--color-success)]/40 text-[var(--color-success)]'
              : 'border-[var(--color-leather-muted)] text-[var(--color-bone-muted)]',
          )}
        >
          {chip.label}
        </span>
      ))}
    </div>
  )
}
