import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

interface LockShellProps {
  children: ReactNode
  className?: string
}

export function LockShell({ children, className }: LockShellProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col bg-[var(--color-carbon)] text-[var(--color-bone)]',
        className,
      )}
    >
      <header className="shrink-0 px-6 pt-12 text-center">
        <p className="font-[var(--font-pos-display)] text-[28px] font-extrabold tracking-[0.06em] text-[var(--color-bone)]">
          BIENBRAVO
        </p>
      </header>
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-6 py-8">
        {children}
      </main>
    </div>
  )
}
