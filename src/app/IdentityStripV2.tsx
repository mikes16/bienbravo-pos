import type { ReactNode } from 'react'
import type { PosBarberStatus } from '@/core/auth/auth.repository'
import { cldThumb } from '@/shared/lib/cloudinary'
import { formatTimeInTz } from '@/shared/lib/date'

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
   *  - null             → loading (la línea bajo el nombre solo dice
   *                       "SESIÓN ACTIVA", sin estado inventado)
   *
   * Mismo lenguaje semántico que el lock roster — el operador ve en el
   * header su mismo estado de las cards.
   */
  operatorStatus: PosBarberStatus | null
  now: Date
  staffName: string
  staffPhotoUrl: string | null
  onLock: () => void
  /** Tz de la sucursal — el reloj del top-bar debe leer la hora en la tz de
   *  la sucursal, no la del device. Presentational: no puede llamar
   *  useLocation(), así que el padre (PosShell) la pasa como prop. */
  timezone: string
  /**
   * Slot del cluster derecho, justo a la IZQUIERDA del reloj. Aquí vive el
   * control "Actualizar" (`RefreshControl`), que necesita el contexto de
   * frescura: se pasa ya construido para que la barra —presentacional— no
   * quede acoplada a ese provider ni se re-renderice con cada refresco.
   */
  trailing?: ReactNode
}

/**
 * Label del estado laboral en el dialecto de la barra (mono uppercase).
 * Mismas tres palabras que el roster del lock screen: el operador no
 * aprende un vocabulario nuevo por pantalla.
 */
function statusLabel(status: PosBarberStatus): string {
  switch (status) {
    case 'en_piso':
      return 'EN PISO'
    case 'en_servicio':
      return 'EN SERVICIO'
    case 'fuera_de_turno':
      return 'SIN CHECAR'
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

/**
 * Barra superior persistente del POS — variante A "Nombre en la barra" de R9.
 *
 * El nombre COMPLETO del operador se canta a 28 px porque el error que
 * corrige es de atribución: un barbero cobraba en la sesión de otro sin
 * darse cuenta (las iniciales de 36 px y el saludo de 13 px no se veían).
 * Por eso el nombre es el único elemento del cluster derecho que jamás
 * desaparece: cuando el ancho aprieta ceden en este orden la fecha, el
 * reloj y el estado, y el nombre sólo se trunca con elipsis.
 *
 * El candado dejó de ser un ícono mudo: es un botón con texto "Bloquear"
 * y área táctil de 44 px, para que ceder el POS sea una acción obvia.
 */
export function IdentityStripV2({
  brand = 'BIENBRAVO',
  sucursalName,
  operatorStatus,
  now,
  staffName,
  staffPhotoUrl,
  onLock,
  timezone,
  trailing,
}: IdentityStripV2Props) {
  const timeStr = formatTimeInTz(now.toISOString(), timezone)
  const dateStr = new Intl.DateTimeFormat('es-MX', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(now)
    .toUpperCase()
  const initials = getInitials(staffName)
  // La sesión es un hecho aunque el estado laboral aún cargue: sin status
  // la línea dice sólo "SESIÓN ACTIVA" (nunca un estado placeholder).
  const sessionLine = operatorStatus
    ? `${statusLabel(operatorStatus)} · SESIÓN ACTIVA`
    : 'SESIÓN ACTIVA'

  return (
    <header className="flex min-h-[68px] shrink-0 items-center justify-between gap-3 border-b border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 py-2 sm:gap-4 sm:px-5">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="truncate text-[13px] font-bold tracking-[0.08em] text-[var(--color-bone)]">{brand}</span>
        <span className="hidden truncate font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] sm:inline">
          {sucursalName}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:gap-4">
        {/* Frescura ("Actualizar" + hora del último dato + estado del canal en
            vivo): va pegado al reloj y a su izquierda, porque las dos horas se
            leen juntas — la del mundo y la del dato. */}
        {trailing}

        {/* Reloj — primero en ceder junto con su fecha: la hora está también
            en el device y en cada ticket, el nombre no. */}
        <div className="hidden shrink-0 text-right sm:block">
          <p className="text-[14px] font-bold leading-none tabular-nums text-[var(--color-bone)]">{timeStr}</p>
          <p className="mt-0.5 hidden font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] md:block">
            {dateStr}
          </p>
        </div>

        {/* Bloque de identidad: avatar 44 px + nombre completo + estado.
            min-w-0 en toda la cadena para que truncate tenga efecto. */}
        <div className="flex min-w-0 items-center gap-3">
          {staffPhotoUrl ? (
            <img
              src={cldThumb(staffPhotoUrl, { w: 44, h: 44, dpr: 'auto' }) ?? staffPhotoUrl}
              alt={staffName}
              loading="lazy"
              decoding="async"
              className="h-11 w-11 shrink-0 rounded-full border border-[var(--color-bone)] object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-bone)] bg-[var(--color-cuero-viejo)] text-[13px] font-bold text-[var(--color-bone)]">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-[var(--font-pos-display)] text-[28px] font-extrabold uppercase leading-[0.9] tracking-[0.01em] text-[var(--color-bone)]">
              {staffName}
            </p>
            <p className="mt-1 hidden truncate font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)] min-[420px]:block">
              {sessionLine}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLock}
          // minHeight inline (no sólo clase): jsdom no calcula layout, así el
          // área táctil de 44 px queda asertable en el test. Mismo patrón que
          // el botón Reintentar de MoneyValue.
          style={{ minHeight: '44px' }}
          className="flex shrink-0 cursor-pointer items-center gap-2 border border-[var(--color-leather-muted)] px-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-bone)] hover:bg-[var(--color-cuero-viejo)] sm:px-4"
          aria-label="Bloquear sesión"
        >
          <LockIcon className="h-[15px] w-[15px] shrink-0" />
          Bloquear
        </button>
      </div>
    </header>
  )
}
