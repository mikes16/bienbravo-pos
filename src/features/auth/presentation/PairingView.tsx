import { useState } from 'react'
import { cn } from '@/shared/lib/cn'
import type { PosLocation } from '@/core/auth/auth.types'

interface PairingViewProps {
  locations: PosLocation[]
  loading: boolean
  onPair: (locationId: string, password: string) => Promise<boolean>
}

/**
 * Pantalla de pairing — asocia este iPad a una sucursal. Pasa una sola vez
 * por dispositivo (o re-pair cuando se mueve), por eso el tratamiento es más
 * ceremonial que el barber selector operacional. El instalador (gerente o
 * dueño) llega, escoge la sucursal, escribe la contraseña, listo.
 *
 * Diferencias intencionales con BarberSelectorView:
 *  - Tiene sub-headline guía ("Asigna este iPad a una sucursal") — el barber
 *    selector no lo necesita porque el barbero sabe qué hacer; el instalador
 *    a veces no.
 *  - Eyebrow dice INSTALACIÓN, no fecha/hora — no es operacional, es setup.
 *  - Cards muestran inicial de la sucursal + ciudad — anclaje territorial,
 *    no de persona.
 *  - Footer indica versión + cantidad de sucursales, no link de back.
 *  - Step 2 (password) reutiliza la card seleccionada como ficha visual
 *    arriba — contexto continuo, el instalador siempre ve a qué sucursal va.
 */
export function PairingView({ locations, loading, onPair }: PairingViewProps) {
  const [selected, setSelected] = useState<PosLocation | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
          Cargando sucursales…
        </p>
      </div>
    )
  }

  if (locations.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center px-8">
        <div className="max-w-md text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-leather)]">
            Sin sucursales
          </p>
          <p className="mt-3 text-[15px] text-[var(--color-bone)]">
            No hay sucursales activas disponibles. Pide a un administrador que
            cree una antes de parear este iPad.
          </p>
        </div>
      </div>
    )
  }

  async function handleContinue() {
    if (!selected || !password.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const ok = await onPair(selected.id, password.trim())
      if (!ok) setError('Contraseña incorrecta')
    } catch {
      setError('No se pudo validar. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Step 2: contraseña ─────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="flex h-full w-full flex-col">
        <PairingHeader />

        <div className="flex flex-1 items-center justify-center px-8 py-10">
          <div className="flex w-full max-w-md flex-col gap-8">
            {/* Mini-card de la sucursal: contexto continuo, el instalador ve
                exactamente a qué sucursal está pareando este iPad. */}
            <SelectedLocationStrip name={selected.name} />

            <div className="flex flex-col gap-3">
              <label
                htmlFor="bb-pair-password"
                className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]"
              >
                Contraseña de sucursal
              </label>
              <input
                id="bb-pair-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                aria-label="Contraseña de sucursal"
                placeholder="Contraseña de sucursal"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleContinue()
                }}
                className="h-14 border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 text-[16px] font-bold tracking-wide text-[var(--color-bone)] outline-none focus:border-[var(--color-bravo)]"
              />
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

            <button
              type="button"
              onClick={() => void handleContinue()}
              disabled={!password.trim() || submitting}
              className={cn(
                'h-14 border font-[var(--font-pos-display)] text-[15px] font-extrabold uppercase tracking-[0.06em] transition-colors',
                !password.trim() || submitting
                  ? 'cursor-not-allowed border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] text-[var(--color-bone-muted)]'
                  : 'cursor-pointer border-[var(--color-bravo)] bg-[var(--color-bravo)] text-[var(--color-bone)] hover:bg-[var(--color-bravo)]/85',
              )}
            >
              {submitting ? 'Validando…' : 'Parear iPad'}
            </button>

            <button
              type="button"
              onClick={() => {
                setSelected(null)
                setPassword('')
                setError(null)
              }}
              className="cursor-pointer self-center font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
            >
              ← Otra sucursal
            </button>
          </div>
        </div>

        <PairingFooter total={locations.length} />
      </div>
    )
  }

  // ─── Step 1: seleccionar sucursal ───────────────────────────────────────
  return (
    <div className="flex h-full w-full flex-col">
      <PairingHeader />

      {/* Sub-headline guía: el instalador a veces necesita confirmación de
          qué está haciendo. Voice editorial mantenida pero más conversacional
          que el barber selector. */}
      <div className="flex shrink-0 flex-col gap-2 px-8 pt-12 pb-8">
        <p className="font-[var(--font-pos-display)] text-[26px] font-extrabold leading-tight tracking-[-0.01em] text-[var(--color-bone)]">
          Asigna este iPad a una sucursal.
        </p>
        <p className="text-[14px] text-[var(--color-bone-muted)]">
          Lo recordará hasta que decidas cambiarlo desde el lock screen.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-8 pb-10">
        <div
          className={cn(
            'grid w-full max-w-5xl gap-5',
            locations.length === 1 && 'max-w-xs grid-cols-1',
            locations.length === 2 && 'max-w-2xl grid-cols-2',
            locations.length >= 3 && 'grid-cols-2 sm:grid-cols-3',
            locations.length >= 6 && 'sm:grid-cols-3 lg:grid-cols-4',
          )}
        >
          {locations.map((loc, idx) => (
            <LocationCard
              key={loc.id}
              index={idx}
              initial={getLocationInitial(loc.name)}
              fullName={loc.name}
              onClick={() => {
                setSelected(loc)
                setError(null)
              }}
            />
          ))}
        </div>
      </div>

      <PairingFooter total={locations.length} />
    </div>
  )
}

/**
 * Extrae la inicial de la sucursal — typically "Sucursal Centro" → "C",
 * "Sucursal Norte" → "N". Si no encuentra patrón "Sucursal X", toma la
 * primera letra del nombre completo.
 */
function getLocationInitial(name: string): string {
  const match = name.trim().match(/sucursal\s+(\w)/i)
  if (match) return match[1].toUpperCase()
  return (name.trim()[0] ?? '?').toUpperCase()
}

/** Limpia "Sucursal Centro" → "Centro" para mostrar como nombre principal. */
function getShortName(name: string): string {
  return name.replace(/^sucursal\s+/i, '').trim()
}

function PairingHeader() {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-leather-muted)]/30 px-8 py-5">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
        Instalación  ·  Tablet Pairing
      </p>
      <p className="font-[var(--font-pos-display)] text-[14px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-bone)]">
        BIENBRAVO
      </p>
    </header>
  )
}

function PairingFooter({ total }: { total: number }) {
  return (
    <footer className="flex shrink-0 items-center justify-between border-t border-[var(--color-leather-muted)]/30 px-8 py-5">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-leather)]">
        {total} sucursal{total === 1 ? '' : 'es'} disponible{total === 1 ? '' : 's'}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-leather)]">
        POS v0.7.0
      </p>
    </footer>
  )
}

/**
 * Card de sucursal — la unidad principal del step 1. Diseñada como "plaque"
 * de barbería: inicial dominante, nombre, ciudad. No es operacional rápido
 * (el instalador pasa segundos comparando), pero sí decisivo.
 *
 * Composición:
 *  - Status "Activa" arriba (más ceremonial que "En línea" del barber)
 *  - Inicial monumental al centro — más grande que el monograma del barbero
 *    porque es 1 letra, no 2: tiene más "aire" para crecer.
 *  - Hairline cuero divisor
 *  - Nombre corto editorial + ciudad
 *  - Hover: lift + border bravo + scale + hairline expande
 */
function LocationCard({
  index,
  initial,
  fullName,
  onClick,
}: {
  index: number
  initial: string
  fullName: string
  onClick: () => void
}) {
  const shortName = getShortName(fullName)
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${80 + index * 60}ms` }}
      className={cn(
        'group relative flex aspect-[4/5] flex-col items-stretch justify-between border border-[var(--color-leather-muted)]/60 bg-[var(--color-carbon-elevated)] p-6 text-left transition-all duration-200',
        'cursor-pointer hover:border-[var(--color-bravo)] hover:bg-[var(--color-cuero-viejo)]/40 hover:-translate-y-1',
        'active:translate-y-0 active:scale-[0.99]',
        'bb-loc-in',
      )}
      aria-label={fullName}
    >
      {/* Status "Activa" — más ceremonial que "En línea". Sucursales no
          están "online", están "activas" o "cerradas". */}
      <div className="flex items-center justify-end">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Activa
        </span>
      </div>

      {/* Inicial monumental + hairline */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <span
          className="font-[var(--font-pos-display)] font-extrabold leading-none tracking-[-0.04em] text-[var(--color-bone)] transition-transform duration-300 group-hover:scale-[1.06]"
          style={{ fontSize: 'clamp(112px, 12vw, 180px)' }}
        >
          {initial}
        </span>
        <span
          aria-hidden
          className="h-px w-10 bg-[var(--color-leather)] transition-all duration-300 group-hover:w-20 group-hover:bg-[var(--color-bravo)]"
        />
      </div>

      {/* Nombre + ciudad */}
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="font-[var(--font-pos-display)] text-[16px] font-extrabold uppercase tracking-[0.04em] text-[var(--color-bone)]">
          {shortName}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-leather)]">
          Saltillo, Coah.
        </p>
      </div>

      <style>{`
        .bb-loc-in {
          opacity: 0;
          transform: translateY(12px);
          animation: bb-loc-rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes bb-loc-rise {
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bb-loc-in { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </button>
  )
}

/**
 * Ficha visual de la sucursal seleccionada en el step de password. Es la
 * misma idea conceptual que LocationCard pero comprimida horizontalmente,
 * para confirmar contexto sin robarle protagonismo al input.
 */
function SelectedLocationStrip({ name }: { name: string }) {
  const initial = getLocationInitial(name)
  const shortName = getShortName(name)
  return (
    <div className="flex items-center gap-5 border-l-[2px] border-[var(--color-bravo)] bg-[var(--color-cuero-viejo)]/30 px-5 py-4">
      <span
        className="font-[var(--font-pos-display)] font-extrabold leading-none tracking-[-0.03em] text-[var(--color-bone)]"
        style={{ fontSize: '48px' }}
      >
        {initial}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Pareando con
        </p>
        <p className="truncate font-[var(--font-pos-display)] text-[18px] font-extrabold uppercase tracking-[0.02em] text-[var(--color-bone)]">
          {shortName}
        </p>
      </div>
    </div>
  )
}
