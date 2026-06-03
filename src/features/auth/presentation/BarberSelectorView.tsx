import { useEffect, useState } from 'react'
import { EmptyStateV2, StatusBadge, type StatusTone } from '@/shared/pos-ui'
import { cn } from '@/shared/lib/cn'
import type { PosStaffUser } from '@/core/auth/auth.types'
import type { PosBarberStatus } from '@/core/auth/auth.repository'

interface BarberSelectorViewProps {
  barbers: PosStaffUser[]
  /**
   * Status real de cada barbero por id. Si un barbero no está en el map,
   * asumimos "fuera_de_turno" (no marcó entrada hoy).
   */
  statuses?: Map<string, PosBarberStatus>
  loading: boolean
  onSelect: (barber: PosStaffUser) => void
  onChangeLocation: () => void
  /**
   * Nombre humano de la sucursal pareada (ej. "Sucursal Norte"). Aparece en
   * el eyebrow superior para anclar contexto. Opcional — si no llega, se
   * omite ese segmento.
   */
  locationName?: string | null
}

function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

const MONTH_ABBR_ES: Record<string, string> = {
  '0': 'ENE', '1': 'FEB', '2': 'MAR', '3': 'ABR', '4': 'MAY', '5': 'JUN',
  '6': 'JUL', '7': 'AGO', '8': 'SEP', '9': 'OCT', '10': 'NOV', '11': 'DIC',
}

function formatHeader(d: Date): string {
  const weekday = d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '').toUpperCase()
  const day = String(d.getDate()).padStart(2, '0')
  const month = MONTH_ABBR_ES[String(d.getMonth())]
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${weekday} ${day} ${month} · ${hh}:${mm}`
}

/**
 * Pantalla de selección de barbero — herramienta operacional, no marketing.
 * El barbero llega, identifica su card en <2s, tap, entra. Todo lo demás es
 * soporte: eyebrow con la sucursal/hora (orientación) y brand mark chico.
 *
 * El peso visual lo cargan las CARDS, no la tipografía. Restrained editorial:
 * sharp corners, mono small-caps, display font solo en el monograma. Sin
 * headlines de revista — esto es taller, no portada.
 */
export function BarberSelectorView({
  barbers,
  statuses,
  loading,
  onSelect,
  onChangeLocation,
  locationName,
}: BarberSelectorViewProps) {
  // Hora editorial en vivo. Refresca cada 30s — el barbero ve la hora real
  // sin tener que cambiar de pestaña.
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  if (loading) {
    return (
      <p className="text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
        Cargando barberos…
      </p>
    )
  }

  if (barbers.length === 0) {
    return (
      <EmptyStateV2
        title="Sin barberos"
        description="No hay barberos activos en esta sucursal."
        action={{ label: 'Cambiar sucursal', onClick: onChangeLocation }}
      />
    )
  }

  const headerLabel = formatHeader(now)
  const locationLabel = locationName?.trim() ? locationName.toUpperCase() : null

  return (
    <div className="flex h-full w-full flex-col">
      {/* Eyebrow superior — orientación, no headline. Mantiene voz editorial
          (mono + tracking-wide + small caps) sin tomar peso visual. */}
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-leather-muted)]/30 px-8 py-5">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
          {locationLabel && <span>{locationLabel} · </span>}
          <span>{headerLabel}</span>
        </p>
        <p className="font-[var(--font-pos-display)] text-[14px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-bone)]">
          BIENBRAVO
        </p>
      </header>

      {/* Cards — el protagonista absoluto. Centradas vertical y horizontal,
          grid responsive que escala bien de 3 a 8 barberos. Aspect 4:5 da
          presencia sin volverse poster. */}
      <div className="flex flex-1 items-center justify-center px-8 py-10">
        <div
          className={cn(
            'grid w-full max-w-5xl gap-5',
            barbers.length === 1 && 'grid-cols-1 max-w-xs',
            barbers.length === 2 && 'grid-cols-2 max-w-2xl',
            barbers.length >= 3 && 'grid-cols-2 sm:grid-cols-3',
            barbers.length >= 6 && 'sm:grid-cols-3 lg:grid-cols-4',
          )}
        >
          {barbers.map((b, idx) => (
            <BarberCard
              key={b.id}
              index={idx}
              initials={getInitials(b.fullName)}
              fullName={b.fullName}
              photoUrl={b.photoUrl}
              status={statuses?.get(b.id) ?? 'fuera_de_turno'}
              onClick={() => onSelect(b)}
            />
          ))}
        </div>
      </div>

      {/* Footer mínimo */}
      <footer className="flex shrink-0 items-center justify-start border-t border-[var(--color-leather-muted)]/30 px-8 py-5">
        <button
          type="button"
          onClick={onChangeLocation}
          className="cursor-pointer font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
        >
          ↓ Cambiar sucursal
        </button>
      </footer>
    </div>
  )
}

/**
 * Card de barbero — el elemento prominente de la pantalla. Diseñado para
 * tap rápido y reconocimiento instantáneo del propio nombre.
 *
 * El status se deriva del TimeClockEvent + occupancy real. No es decorativo:
 *   - en_piso        → cuadrado bone, pulse, label "EN PISO" (puede atender)
 *   - en_servicio    → cuadrado leather, sin pulse, label "EN SERVICIO"
 *   - fuera_de_turno → cuadrado vacío leather hairline, label "SIN TURNO",
 *                      card con opacity reducido (sigue tappable — puede
 *                      loguearse y luego clockear-in)
 *
 * El usuario sigue pudiendo seleccionar cualquier barbero independiente
 * del status; el POS no bloquea login. Es solo info visible.
 */
function BarberCard({
  index,
  initials,
  fullName,
  photoUrl,
  status,
  onClick,
}: {
  index: number
  initials: string
  fullName: string
  photoUrl: string | null
  status: PosBarberStatus
  onClick: () => void
}) {
  // Si la foto falla (URL stale, 404 de Cloudinary, etc.) caemos al monograma.
  // Estado local de error para no romper el render del rest del grid.
  const [photoBroken, setPhotoBroken] = useState(false)
  const showPhoto = photoUrl && !photoBroken
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${80 + index * 60}ms` }}
      className={cn(
        'group relative flex aspect-[4/5] flex-col items-stretch justify-between border border-[var(--color-leather-muted)]/60 bg-[var(--color-carbon-elevated)] p-6 text-left transition-all duration-200',
        'cursor-pointer hover:border-[var(--color-bravo)] hover:bg-[var(--color-cuero-viejo)]/40 hover:-translate-y-1',
        'active:translate-y-0 active:scale-[0.99]',
        'bb-card-in overflow-hidden',
        // Fuera de turno: opacity 65% para hundir visualmente al barbero
        // que aún no marca entrada. Sigue tappable, pero el operador ve de
        // un vistazo quién está en piso vs quién no.
        status === 'fuera_de_turno' && 'opacity-65',
      )}
      aria-label={fullName}
    >
      {/* Foto fullbleed cuando existe — el barbero se reconoce más rápido por
          cara que por iniciales. Grayscale + brightness para mantener voz
          editorial y dejar que el badge/nombre se lean encima. */}
      {showPhoto && (
        <img
          src={photoUrl}
          alt=""
          draggable={false}
          onError={() => setPhotoBroken(true)}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover grayscale brightness-90 transition-transform duration-500 group-hover:scale-[1.04]"
        />
      )}
      {/* Overlay de gradiente para legibilidad del nombre + badge sobre la foto. */}
      {showPhoto && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--color-carbon)]/95 via-[var(--color-carbon)]/40 to-[var(--color-carbon)]/60"
        />
      )}

      <div className="relative z-10 flex items-center justify-end">
        {(() => {
          const { tone, label } = statusToBadge(status)
          return <StatusBadge tone={tone} label={label} />
        })()}
      </div>

      {/* Monograma — fallback cuando no hay foto. Mismo tratamiento editorial.
          Con foto este bloque queda vacío (solo flex-1 para empujar el
          nombre abajo) y el dash se reposiciona como kicker bajo el nombre,
          para no flotar en mitad del cuerpo del barbero. */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4">
        {!showPhoto && (
          <>
            <span
              className="font-[var(--font-pos-display)] font-extrabold leading-none tracking-[-0.03em] text-[var(--color-bone)] transition-transform duration-300 group-hover:scale-[1.06]"
              style={{ fontSize: 'clamp(72px, 8vw, 128px)' }}
            >
              {initials}
            </span>
            <span
              aria-hidden
              className="h-px w-10 bg-[var(--color-leather)] transition-all duration-300 group-hover:w-20 group-hover:bg-[var(--color-bravo)]"
            />
          </>
        )}
      </div>

      {/* Nombre completo abajo (con dash kicker debajo cuando hay foto, para
          mantener la afordancia de hover sin cortar la composición). */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <p className="text-center font-[var(--font-pos-display)] text-[15px] font-extrabold uppercase tracking-[0.04em] text-[var(--color-bone)]">
          {fullName}
        </p>
        {showPhoto && (
          <span
            aria-hidden
            className="h-px w-8 bg-[var(--color-leather)] transition-all duration-300 group-hover:w-16 group-hover:bg-[var(--color-bravo)]"
          />
        )}
      </div>

      <style>{`
        .bb-card-in {
          opacity: 0;
          transform: translateY(12px);
          animation: bb-card-rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes bb-card-rise {
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bb-card-in { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </button>
  )
}

/**
 * Mapea el status semántico del dominio (PosBarberStatus) al tono + label
 * del StatusBadge shared. Mantiene el dominio aislado del componente de
 * presentación — el StatusBadge no sabe nada de barberos.
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
