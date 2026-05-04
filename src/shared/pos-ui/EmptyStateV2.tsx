import { cn } from '@/shared/lib/cn'
import { TouchButton } from './TouchButton'

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateV2Props {
  title: string
  description: string
  action?: EmptyStateAction
  className?: string
}

/**
 * Editorial empty state — typographic only, no decorative icons. Used when
 * a list/grid has no content. Optional CTA brings the user back to action.
 */
export function EmptyStateV2({ title, description, action, className }: EmptyStateV2Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <p className="font-[var(--font-pos-display)] text-[var(--pos-text-numeral-s)] font-extrabold leading-none text-[var(--color-leather)]">
        {title}
      </p>
      <p className="max-w-md text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
        {description}
      </p>
      {action && (
        <div className="mt-4">
          <TouchButton variant="secondary" size="secondary" onClick={action.onClick}>
            {action.label}
          </TouchButton>
        </div>
      )}
    </div>
  )
}
