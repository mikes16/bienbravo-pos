import { cn } from '@/shared/lib/cn'
import type { ReputationMark } from '@/shared/lib/reputation'

interface ReputationBadgeProps {
  mark: ReputationMark
  /** Override de spacing/tamaño según el contexto (fila del Hoy vs chip). */
  className?: string
}

/**
 * Marca de reputación del cliente para el piso. Dos señales CLARAS — pensadas
 * para operadores no técnicos, no sutilezas que nadie note:
 *   - VIP              → outline dorado (`--color-warning`), trato preferente.
 *   - FLAGGED_BY_STAFF → outline rojo bravo (`--color-bravo`), label "ATENCIÓN".
 *
 * Mismo lenguaje visual que los pills de estado del Hoy (mono uppercase, borde
 * sharp) para que se lea como parte del sistema, no como un badge ajeno.
 * Componente compartido: fila del Hoy (junto al nombre) y chip del cliente del
 * checkout — una sola definición de label/tono para ambos.
 */
export function ReputationBadge({ mark, className }: ReputationBadgeProps) {
  const isVip = mark === 'VIP'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase leading-none tracking-[0.16em]',
        isVip
          ? 'border-[var(--color-warning)] text-[var(--color-warning)]'
          : 'border-[var(--color-bravo)] text-[var(--color-bravo)]',
        className,
      )}
    >
      {isVip ? 'VIP' : 'ATENCIÓN'}
    </span>
  )
}
