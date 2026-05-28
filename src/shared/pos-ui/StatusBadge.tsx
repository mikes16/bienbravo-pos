import { cn } from '@/shared/lib/cn'

export type StatusTone = 'active' | 'busy' | 'inactive'

interface StatusBadgeProps {
  /**
   * Tono semántico del estado:
   *  - active   → cuadrado bone con pulse: el sujeto está disponible/activo
   *  - busy     → cuadrado leather sólido sin pulse: ocupado/en uso
   *  - inactive → cuadrado vacío hairline: dormido/desconectado/sin turno
   */
  tone: StatusTone
  /** Label en mono uppercase. Ej. "EN PISO", "EN LÍNEA", "SIN CONEXIÓN". */
  label: string
  /** Override del className para spacing/visibility contextual. */
  className?: string
}

/**
 * Badge de status editorial — cuadrado sharp 8×8 + label mono small-caps.
 * Vive con voz unificada en todo el POS: lock screen roster, header strip,
 * dashboards. Tres tonos cubren el espectro de "activo/ocupado/inactivo"
 * sin necesidad de colores semánticos brillantes (success/warning/danger).
 *
 * Patrón inspirado en HUD diegetic UI: el cuadrado es deliberadamente
 * pequeño (8×8) para no competir con el contenido principal, pero la
 * pulse animation + el contraste de color hacen que sea perceptible en
 * un glance.
 */
export function StatusBadge({ tone, label, className }: StatusBadgeProps) {
  const dotClass = (() => {
    switch (tone) {
      case 'active':
        return 'h-2 w-2 bg-[var(--color-bone)]'
      case 'busy':
        return 'h-2 w-2 bg-[var(--color-leather)]'
      case 'inactive':
        return 'h-2 w-2 border border-[var(--color-leather)]'
    }
  })()

  const textClass = (() => {
    switch (tone) {
      case 'active':
        return 'text-[var(--color-bone-muted)]'
      case 'busy':
      case 'inactive':
        return 'text-[var(--color-leather)]'
    }
  })()

  return (
    <span
      className={cn(
        'flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em]',
        textClass,
        className,
      )}
    >
      <span
        aria-hidden
        className={dotClass}
        style={tone === 'active' ? { animation: 'bb-status-pulse 2.2s ease-in-out infinite' } : undefined}
      />
      {label}
      {/* Keyframes encapsulados acá para que el badge sea drop-in en
          cualquier consumer sin tener que copiar la animación. */}
      {tone === 'active' && (
        <style>{`
          @keyframes bb-status-pulse {
            0%, 100% { opacity: 0.45; transform: scale(0.9); }
            50%      { opacity: 1;    transform: scale(1.15); }
          }
          @media (prefers-reduced-motion: reduce) {
            [data-bb-status-active] { animation: none !important; }
          }
        `}</style>
      )}
    </span>
  )
}
