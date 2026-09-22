import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { MoneyDisplay } from './MoneyDisplay'
import { SkeletonText } from './Skeleton'
import { TouchButton } from './TouchButton'

/**
 * Estados de una cifra de dinero en pantalla.
 * Spec: docs/superpowers/specs/2026-09-18-frescura-y-consistencia-pos-admin-design.md § 3.1b
 *
 * - loading    → esqueleto; nunca "$0" ni la cifra anterior
 * - fresh      → la cifra que acaba de responder el servidor
 * - updating   → la cifra atenuada mientras llega el dato nuevo (máx. 1 s)
 * - offline    → "—" + "Sin conexión"; nunca la última cifra como si fuera actual
 * - error      → "No se pudo cargar" + reintentar; nunca "$0"
 */
export type MoneyValueStatus = 'loading' | 'fresh' | 'updating' | 'offline' | 'error'

type Size = 'S' | 'M' | 'L'

/**
 * Tiempo máximo que una cifra puede quedarse atenuada. Pasado ese punto ya no
 * se puede afirmar que sea "de hace instantes" y cae a esqueleto (= "no sé").
 */
const UPDATING_GRACE_MS = 1000

/** Ancho aproximado del numeral ("$1,234") en el mismo cuerpo de letra. */
const SKELETON_WIDTH_CH = 4.5

const numeralSizeClasses: Record<Size, string> = {
  S: 'text-[var(--pos-text-numeral-s)]',
  M: 'text-[var(--pos-text-numeral-m)]',
  L: 'text-[var(--pos-text-numeral-l)]',
}

/** Caja del numeral: misma tipografía/cuerpo que MoneyDisplay para no saltar el layout. */
const numeralBoxClasses =
  'inline-flex items-center font-[var(--font-pos-display)] font-extrabold leading-[0.95] tabular-nums'

interface MoneyValueProps {
  status: MoneyValueStatus
  /** Monto en centavos. `null` = "no sé": se pinta esqueleto, jamás $0. */
  cents: number | null
  /** Etiqueta accesible de la cifra, ej. "Total del día". */
  label: string
  /** Mismo escalón tipográfico que MoneyDisplay. */
  size?: Size
  /** Si viene, el estado `error` ofrece el botón "Reintentar". */
  onRetry?: () => void
  className?: string
}

/**
 * Única forma de pintar en el POS una cifra de dinero que viene del servidor.
 *
 * Regla de negocio (Miguel, 18 sep 2026): el dinero nunca se muestra desde caché.
 * Con varias iPads cobrando a la vez, una cifra guardada está mal en cuanto otra
 * cobra: o es la que acaba de responder el servidor, o es un esqueleto/guion.
 * Un `0` REAL (`status="fresh"`, `cents={0}`) sí se pinta como $0 — "no hay ventas"
 * es información; "no sé" nunca se disfraza de cero.
 *
 * El formato lo hace MoneyDisplay y el esqueleto Skeleton: acá no se duplica ninguno.
 */
export function MoneyValue({
  status,
  cents,
  label,
  size = 'M',
  onRetry,
  className,
}: MoneyValueProps) {
  // El grace de "updating" se reinicia en render cuando cambia el estado
  // (patrón oficial de React para ajustar estado derivado de props) en vez de
  // hacerlo dentro del efecto.
  const [renderedStatus, setRenderedStatus] = useState<MoneyValueStatus>(status)
  const [graceExpired, setGraceExpired] = useState(false)
  if (renderedStatus !== status) {
    setRenderedStatus(status)
    setGraceExpired(false)
  }

  useEffect(() => {
    if (status !== 'updating') return
    const id = setTimeout(() => setGraceExpired(true), UPDATING_GRACE_MS)
    return () => clearTimeout(id)
  }, [status])

  const unknownAmount = cents === null
  const showSkeleton =
    status === 'loading' ||
    ((status === 'fresh' || status === 'updating') &&
      (unknownAmount || (status === 'updating' && graceExpired)))
  const busy = status === 'loading' || status === 'updating'

  let main: ReactNode
  let hint: ReactNode = null

  if (status === 'offline' || status === 'error') {
    main = (
      <span
        aria-hidden="true"
        className={cn(numeralBoxClasses, numeralSizeClasses[size], 'text-[var(--color-bone-muted)]')}
      >
        —
      </span>
    )
    hint =
      status === 'offline' ? (
        <span className="text-[var(--pos-text-caption)] font-medium uppercase tracking-[0.16em] text-[var(--color-bone-muted)]">
          Sin conexión
        </span>
      ) : (
        <span className="inline-flex items-center gap-[var(--pos-space-3)]">
          <span className="text-[var(--pos-text-caption)] font-medium uppercase tracking-[0.16em] text-[var(--color-error)]">
            No se pudo cargar
          </span>
          {onRetry && (
            <TouchButton
              variant="secondary"
              size="min"
              onClick={onRetry}
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              Reintentar
            </TouchButton>
          )}
        </span>
      )
  } else if (showSkeleton || cents === null) {
    main = (
      <span
        aria-hidden="true"
        className={cn(numeralBoxClasses, numeralSizeClasses[size])}
        style={{ width: `${SKELETON_WIDTH_CH}ch` }}
      >
        <SkeletonText widthPercent={100} className="motion-reduce:animate-none" />
      </span>
    )
  } else {
    main = (
      <>
        <MoneyDisplay
          cents={cents}
          size={size}
          className={cn(
            'transition-opacity duration-200',
            status === 'updating' && 'opacity-40',
          )}
        />
        {status === 'updating' && (
          <span
            aria-hidden="true"
            className="h-[6px] w-[6px] shrink-0 animate-pulse bg-[var(--color-leather)] motion-reduce:animate-none"
          />
        )}
      </>
    )
  }

  return (
    <span
      role="group"
      aria-label={label}
      aria-busy={busy || undefined}
      className={cn('inline-flex flex-col items-start gap-[var(--pos-space-1)]', className)}
    >
      <span className="inline-flex items-center gap-[var(--pos-space-2)]">{main}</span>
      {hint}
    </span>
  )
}
