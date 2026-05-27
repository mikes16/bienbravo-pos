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
        'flex h-full min-h-0 flex-col items-center justify-center gap-10 bg-[var(--color-carbon)] px-6 py-8 text-[var(--color-bone)]',
        className,
      )}
    >
      {/* El brand vive dentro del flex centrado para que el grupo completo
          (BIENBRAVO + contenido) quede visualmente al centro del viewport,
          no anclado arriba con el contenido empujado hacia abajo. */}
      <p className="font-[var(--font-pos-display)] text-[28px] font-extrabold tracking-[0.06em] text-[var(--color-bone)]">
        BIENBRAVO
      </p>
      {children}
    </div>
  )
}
