import { cn } from '@/shared/lib/cn'
import type { PosIconComponent } from './GoogleIcon'

interface FeatureTileProps {
  icon: PosIconComponent
  name: string
  subtitle?: string
  badge?: number
  disabled?: boolean
  onClick: () => void
  className?: string
}

export function FeatureTile({
  icon: Icon,
  name,
  subtitle,
  badge,
  disabled,
  onClick,
  className,
}: FeatureTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col justify-between gap-2 border bg-[var(--color-carbon-elevated)] p-3.5 text-left transition-colors',
        'border-[var(--color-leather-muted)]',
        'hover:bg-[var(--color-cuero-viejo)] active:bg-[var(--color-cuero-viejo)]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--color-carbon-elevated)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-bone-muted)]',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-7 w-7 items-center justify-center border border-[var(--color-leather-muted)] text-[var(--color-bone-muted)]">
          <Icon className="h-4 w-4" />
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="bg-[var(--color-bravo)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--color-bone)]">
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="text-[var(--pos-text-body-lg)] font-bold text-[var(--color-bone)]">{name}</p>
        {subtitle && (
          <p className="mt-0.5 text-[var(--pos-text-caption)] text-[var(--color-bone-muted)]">
            {subtitle}
          </p>
        )}
      </div>
    </button>
  )
}
