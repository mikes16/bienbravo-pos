import { cn } from '@/shared/lib/cn'

export interface HoyRowProps {
  id: string
  kind: 'active' | 'next' | 'queue' | 'pending'
  timeLabel: string
  customerName: string
  customerPhotoUrl: string | null
  customerInitials: string
  serviceLabel: string
  meta: string | null
  pillLabel: string
  pillTone: 'serving' | 'appt' | 'walkin'
  sourceKind: 'appointment' | 'walk-in'
  sourceId: string
  onClick?: () => void
}

export function HoyRow({
  kind,
  timeLabel,
  customerName,
  customerPhotoUrl,
  customerInitials,
  serviceLabel,
  meta,
  pillLabel,
  pillTone,
  onClick,
}: HoyRowProps) {
  const isActive = kind === 'active'
  const isNext = kind === 'next'
  const isQueue = kind === 'queue'
  const isInteractive = typeof onClick === 'function'

  const Tag = isInteractive ? 'button' : 'div'
  const interactiveProps = isInteractive
    ? ({ type: 'button' as const, onClick })
    : {}

  return (
    <Tag
      {...interactiveProps}
      className={cn(
        'grid w-full grid-cols-[100px_56px_1fr_auto] items-center gap-4 border-b border-[var(--color-leather-muted)]/40 px-5 py-3 text-left transition-colors',
        isInteractive && 'cursor-pointer hover:bg-white/[0.02]',
        isActive && 'border-l-[3px] border-l-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.06] pl-[calc(1.25rem-3px)]',
        isNext && 'border-l-[2px] border-l-[var(--color-leather)] bg-[var(--color-cuero-viejo)]/30 pl-[calc(1.25rem-2px)]',
        isQueue && 'bg-[var(--color-cuero-viejo)]/10',
      )}
    >
      <span
        className={cn(
          'tabular-nums',
          isActive
            ? 'font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]'
            : isQueue
              ? 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-leather)]'
              : 'font-mono text-[13px] font-bold tracking-[0.04em] text-[var(--color-bone-muted)]',
        )}
      >
        {timeLabel}
      </span>

      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border bg-[var(--color-cuero-viejo)] text-[14px] font-bold text-[var(--color-bone)]',
          isActive
            ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.12] text-[var(--color-bravo)]'
            : isQueue
              ? 'border border-dashed border-[var(--color-leather)] text-[var(--color-leather)]'
              : 'border-[var(--color-leather-muted)]',
        )}
      >
        {customerPhotoUrl ? (
          <img
            src={customerPhotoUrl}
            alt={customerName}
            className="h-full w-full object-cover"
          />
        ) : (
          customerInitials
        )}
      </div>

      <div className="min-w-0">
        <p
          className={cn(
            'text-[16px] font-bold leading-tight text-[var(--color-bone)]',
            isActive && 'text-[17px]',
          )}
        >
          {customerName}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-[var(--color-bone-muted)]">
          <strong className="font-semibold text-[var(--color-bone-muted)]">{serviceLabel}</strong>
          {meta && <span> · {meta}</span>}
        </p>
      </div>

      <span
        className={cn(
          'border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em]',
          pillTone === 'serving' && 'border-[var(--color-bravo)] text-[var(--color-bravo)]',
          pillTone === 'appt' && 'border-[var(--color-leather-muted)] text-[var(--color-bone-muted)]',
          pillTone === 'walkin' && 'border-[var(--color-leather)] text-[var(--color-leather)]',
        )}
      >
        {pillLabel}
      </span>
    </Tag>
  )
}
