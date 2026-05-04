import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { StepBar } from './StepBar'

interface WizardShellProps {
  steps: string[]
  activeIndex: number
  /** Primary CTA — typically a TouchButton size="primary". */
  cta: ReactNode
  /** Optional metadata in the bottom bar — typically cart total / count. */
  meta?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Wizard page template. StepBar top, scrollable content area, fixed
 * bottom bar with meta (left) + CTA (right). Designed for iPad landscape
 * where the wizard owns the entire viewport.
 */
export function WizardShell({
  steps,
  activeIndex,
  cta,
  meta,
  children,
  className,
}: WizardShellProps) {
  return (
    <div className={cn('flex h-full flex-col bg-[var(--color-carbon)]', className)}>
      <header className="shrink-0 border-b border-[var(--color-leather-muted)]/40">
        <StepBar steps={steps} activeIndex={activeIndex} />
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</main>
      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-6 py-4">
        <div className="min-w-0 flex-1">{meta}</div>
        <div className="shrink-0">{cta}</div>
      </footer>
    </div>
  )
}
