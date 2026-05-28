import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

interface LockShellProps {
  children: ReactNode
  className?: string
  /**
   * Esconde el brand mark centrado. Útil cuando la pantalla hija ya tiene
   * su propia composición editorial con headline + footer brand integrados
   * (BarberSelectorView roster) y mostrarlo aquí sería redundante.
   */
  hideBrand?: boolean
  /**
   * Layout sin centrado vertical. Para pantallas full-bleed como el roster
   * editorial que ocupa toda la viewport con su propia composición.
   */
  fullBleed?: boolean
}

export function LockShell({ children, className, hideBrand = false, fullBleed = false }: LockShellProps) {
  return (
    <div
      className={cn(
        'h-full min-h-0 bg-[var(--color-carbon)] text-[var(--color-bone)]',
        fullBleed
          ? 'flex flex-col'
          : 'flex flex-col items-center justify-center gap-10 px-6 py-8',
        className,
      )}
    >
      {/* El brand vive dentro del flex centrado para que el grupo completo
          (BIENBRAVO + contenido) quede visualmente al centro del viewport,
          no anclado arriba con el contenido empujado hacia abajo. */}
      {!hideBrand && (
        <p className="font-[var(--font-pos-display)] text-[28px] font-extrabold tracking-[0.06em] text-[var(--color-bone)]">
          BIENBRAVO
        </p>
      )}
      {children}
    </div>
  )
}
