import { cn } from '@/shared/lib/cn'
import { TouchButton } from './TouchButton'

interface SuccessAction {
  label: string
  onClick: () => void
}

interface SuccessSplashProps {
  title: string
  subtitle?: string
  action?: SuccessAction
  className?: string
}

/**
 * Full-screen success state. Big Barlow Condensed title in success green,
 * optional subtitle, optional CTA. Used for completed sale, completed cash
 * count, completed PIN unlock.
 */
export function SuccessSplash({
  title,
  subtitle,
  action,
  className,
}: SuccessSplashProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex h-full flex-col items-center justify-center gap-6 bg-[var(--color-carbon)] px-6 text-center',
        className,
      )}
    >
      <p className="font-[var(--font-pos-display)] text-[var(--pos-text-numeral-l)] font-extrabold leading-none text-[var(--color-success)]">
        {title}
      </p>
      {subtitle && (
        <p className="text-[var(--pos-text-body-lg)] text-[var(--color-bone-muted)]">
          {subtitle}
        </p>
      )}
      {action && (
        <div className="mt-4">
          <TouchButton onClick={action.onClick}>{action.label}</TouchButton>
        </div>
      )}
    </div>
  )
}
