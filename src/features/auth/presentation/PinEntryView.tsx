import { useEffect, useMemo, useState } from 'react'
import { PinKeypad } from '@/shared/pos-ui'
import { cn } from '@/shared/lib/cn'

interface PinEntryViewProps {
  staffName: string
  photoUrl: string | null
  error: string | null
  onSubmit: (pin: string) => void
  onBack: () => void
  /** Sucursal pareada — aparece en el eyebrow para anclar contexto. */
  locationName?: string | null
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

function formatHeader(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Step 3 del lock flow — el barbero ya se identificó, ahora valida su PIN.
 * Mantiene el lenguaje editorial del barber selector y pairing (header
 * eyebrow + strip de contexto + footer mínimo), pero adaptado al uso:
 *
 *   - Strip de identificación arriba: monograma + nombre del barbero
 *     seleccionado, con border-l bravo para que sea visible que "este es
 *     el que está autenticándose".
 *   - Dots de progreso editorial: cuadrados sharp small con hairline rule
 *     debajo, no círculos rounded soft.
 *   - Eyebrow "PIN DE ACCESO" arriba de los dots.
 *   - Error: border-l bravo (mismo patrón que pairing).
 *   - Keypad usa el Numpad shared (ya editorial: sharp + display font).
 */
export function PinEntryView({
  staffName,
  photoUrl,
  error,
  onSubmit,
  onBack,
  locationName,
}: PinEntryViewProps) {
  const initials = useMemo(() => getInitials(staffName), [staffName])
  const [submitting, setSubmitting] = useState(false)
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])

  function handleComplete(pin: string) {
    setSubmitting(true)
    onSubmit(pin)
  }

  const locationLabel = locationName?.trim() ? locationName.toUpperCase() : null

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header — verbo "ACCESO" distinto al barber selector ("ROSTER") y
          pairing ("INSTALACIÓN"). Cada step de la cadena tiene su propio
          verbo en el eyebrow, refuerza el modelo mental. */}
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-leather-muted)]/30 px-8 py-5">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
          Acceso
          {locationLabel && <span> · {locationLabel}</span>}
          <span> · {formatHeader(now)}</span>
        </p>
        <p className="font-[var(--font-pos-display)] text-[14px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-bone)]">
          BIENBRAVO
        </p>
      </header>

      {/* Main: strip de identificación + dots + keypad — centrado vertical y
          horizontalmente con max-width para que en pantallas grandes no se
          disperse. */}
      <div className="flex flex-1 items-center justify-center px-8 py-8">
        <div className="flex w-full max-w-sm flex-col items-stretch gap-7">
          {/* Strip de barbero seleccionado: idéntica intención que el strip
              de sucursal en pairing — confirma "estás autenticándote como
              esta persona" sin robar peso visual al PIN. */}
          <div className="flex items-center gap-5 border-l-[2px] border-[var(--color-bravo)] bg-[var(--color-cuero-viejo)]/30 px-5 py-4">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={staffName}
                className="h-14 w-14 shrink-0 border border-[var(--color-leather-muted)] object-cover"
              />
            ) : (
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center bg-[var(--color-carbon-elevated)] font-[var(--font-pos-display)] text-[22px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]"
                aria-hidden
              >
                {initials}
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
                Entrando como
              </p>
              <p className="truncate font-[var(--font-pos-display)] text-[18px] font-extrabold uppercase tracking-[0.02em] text-[var(--color-bone)]">
                {staffName}
              </p>
            </div>
          </div>

          {/* Label + dots — eyebrow restrained antes de la acción real. */}
          <div className="flex flex-col items-center gap-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
              {submitting ? 'Validando…' : 'PIN de acceso'}
            </p>
            {/* Keypad + dots vienen del PinKeypad compartido. Los dots ahora
                tienen voice editorial (vía cambios en PinKeypad). */}
            <div className={submitting ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
              <PinKeypad length={4} onComplete={handleComplete} disabled={submitting} />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="border-l-[2px] border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] px-4 py-3"
            >
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">
                {error}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer — back action consistente con pairing (← Otra sucursal). */}
      <footer className="flex shrink-0 items-center justify-start border-t border-[var(--color-leather-muted)]/30 px-8 py-5">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className={cn(
            'font-mono text-[11px] font-bold uppercase tracking-[0.22em]',
            submitting
              ? 'cursor-not-allowed text-[var(--color-bone-muted)]/40'
              : 'cursor-pointer text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]',
          )}
        >
          ← Otro barbero
        </button>
      </footer>
    </div>
  )
}
