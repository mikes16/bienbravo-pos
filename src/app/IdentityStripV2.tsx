import { StatusBadge, type StatusTone } from '@/shared/pos-ui'
import type { PosBarberStatus } from '@/core/auth/auth.repository'
import { cldThumb } from '@/shared/lib/cloudinary'

// Inline padlock — Material Symbols was being loaded just for this one icon.
function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="1" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

interface IdentityStripV2Props {
  brand?: string
  sucursalName: string
  /**
   * Status laboral del operador logueado:
   *  - 'en_piso'        → clocked-in y libre (puede atender)
   *  - 'en_servicio'    → atendiendo a un cliente ahora
   *  - 'fuera_de_turno' → no ha marcado entrada hoy
   *  - null             → loading (badge se esconde)
   *
   * Mismo lenguaje semántico que el lock roster — el operador ve en el
   * header su mismo estado de las cards.
   */
  operatorStatus: PosBarberStatus | null
  now: Date
  staffName: string
  staffPhotoUrl: string | null
  onLock: () => void
}

/**
 * Mapea el status semántico del operador al tono + label del StatusBadge
 * shared. Mantiene el componente de presentación libre del dominio.
 */
function statusToBadge(status: PosBarberStatus): { tone: StatusTone; label: string } {
  switch (status) {
    case 'en_piso':
      return { tone: 'active', label: 'En piso' }
    case 'en_servicio':
      return { tone: 'busy', label: 'En servicio' }
    case 'fuera_de_turno':
      return { tone: 'inactive', label: 'Sin turno' }
  }
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

export function IdentityStripV2({
  brand = 'BIENBRAVO',
  sucursalName,
  operatorStatus,
  now,
  staffName,
  staffPhotoUrl,
  onLock,
}: IdentityStripV2Props) {
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const dateStr = now
    .toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase()
  const initials = getInitials(staffName)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 sm:h-16 sm:px-5">
      <div className="flex items-baseline gap-3">
        <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--color-bone)]">{brand}</span>
        <span className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] sm:inline">
          {sucursalName}
        </span>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Operator status badge — refleja el status laboral del barbero
            logueado: en piso / en servicio / sin turno. Mismo lenguaje
            semántico que las cards del lock roster — el operador ve su
            propio estado con el mismo dialecto visual. Si aún no carga,
            esconde el badge (no muestra placeholder confuso). */}
        {operatorStatus && (() => {
          const { tone, label } = statusToBadge(operatorStatus)
          return <StatusBadge tone={tone} label={label} className="hidden sm:flex" />
        })()}
        <div className="text-right">
          <p className="text-[14px] font-bold leading-none tabular-nums text-[var(--color-bone)]">{timeStr}</p>
          <p className="mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
            {dateStr}
          </p>
        </div>

        {staffPhotoUrl ? (
          <img
            src={cldThumb(staffPhotoUrl, { w: 36, h: 36, dpr: 'auto' }) ?? staffPhotoUrl}
            alt={staffName}
            loading="lazy"
            decoding="async"
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-leather-muted)] bg-[var(--color-cuero-viejo)] text-[11px] font-bold text-[var(--color-bone)]">
            {initials}
          </div>
        )}

        <button
          type="button"
          onClick={onLock}
          className="flex h-9 w-9 cursor-pointer items-center justify-center text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)] hover:text-[var(--color-bone)]"
          aria-label="Bloquear sesión"
        >
          <LockIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
