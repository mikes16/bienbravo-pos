import { Fragment } from 'react'
import { cn } from '@/shared/lib/cn'

interface StepBarProps {
  steps: string[]
  /** Index of the active (current) step. Past steps render as completed. */
  activeIndex: number
  className?: string
}

/**
 * Horizontal wizard step indicator. Active step in bone (--color-bone),
 * past steps in bone-muted, future steps in leather-muted. Sentence case.
 */
export function StepBar({ steps, activeIndex, className }: StepBarProps) {
  return (
    <ol
      className={cn(
        'flex items-center gap-2 px-5 py-3 text-[var(--pos-text-label)]',
        className,
      )}
      aria-label="Pasos del proceso"
    >
      {steps.map((step, i) => {
        const state =
          i === activeIndex ? 'active' : i < activeIndex ? 'past' : 'future'
        return (
          <Fragment key={step}>
            {i > 0 && (
              <span
                aria-hidden
                data-step-separator
                className="text-[var(--color-leather-muted)]"
              >
                ›
              </span>
            )}
            <li
              aria-current={state === 'active' ? 'step' : undefined}
              className={cn(
                'font-medium',
                state === 'active' && 'font-semibold text-[var(--color-bone)]',
                state === 'past' && 'text-[var(--color-bone-muted)]',
                state === 'future' && 'text-[var(--color-leather-muted)]',
              )}
            >
              {step}
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
