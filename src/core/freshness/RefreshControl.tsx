import { useEffect, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { formatTimeInTz } from '@/shared/lib/date'
import { useFreshness } from './useLiveRefresh'

/**
 * Cuánto tiene que llevar caída la conexión en vivo antes de decirlo en
 * pantalla. El spec pide "más de unos segundos": un parpadeo del socket no
 * debe alarmar al operador, pero una caída real sí tiene que verse.
 * (El provider degrada a `offline` a los 8 s por su cuenta; `offline` se
 * anuncia de inmediato, sin esperar esta ventana.)
 */
const RECONNECTING_GRACE_MS = 5_000

/**
 * Tope del giro del ícono. `refreshAll()` es `void` y la hora sólo avanza si
 * TODOS los cargadores resolvieron: si uno falla, nadie nos avisa. Sin este
 * tope el botón se quedaría deshabilitado para siempre tras un error.
 */
const SPIN_TIMEOUT_MS = 4_000

/** Ícono de recarga dibujado a mano: una librería de íconos por un glifo no paga. */
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

interface RefreshControlProps {
  /** Tz de la SUCURSAL. La hora del último dato jamás se lee en la del device. */
  timezone: string
  className?: string
}

/**
 * Botón "Actualizar" + hora del último dato + estado de la conexión en vivo.
 *
 * Es la red de seguridad del esquema de frescura (spec § 3.3 e/f) y, sobre
 * todo, una señal de confianza: el operador sabe qué tan fresco es lo que ve y
 * tiene una salida que NO es recargar la página. No es el mecanismo principal
 * —de eso se encarga el canal de eventos del `FreshnessProvider`—, por eso
 * aquí no se consulta nada: sólo se dispara `refreshAll()`.
 *
 * La regla dura es la de R8: **nunca presentar datos viejos como actuales**.
 * Con la conexión caída el texto deja de decir "ACTUALIZADO" (que suena a
 * "esto es lo de ahora") y pasa a "DATOS DE LAS 18:36", con la etiqueta roja
 * al lado. Sin hora conocida no se inventa ninguna.
 *
 * Presentacional respecto del contexto: recibe la tz por prop (igual que
 * IdentityStripV2) y se monta en la barra por un slot, para que la barra no
 * dependa del FreshnessProvider.
 */
export function RefreshControl({ timezone, className }: RefreshControlProps) {
  const { connection, lastUpdatedAt, refreshAll } = useFreshness()

  // "Refrescando" no existe en el contexto (`refreshAll()` es `void`): se
  // deriva aquí. El giro termina cuando la hora del último dato avanza —el
  // ajuste va en el render comparando contra el valor visto, patrón oficial de
  // React para estado derivado, no en un efecto— o cuando vence el tope.
  const [refreshing, setRefreshing] = useState(false)
  const [seenUpdatedAt, setSeenUpdatedAt] = useState(lastUpdatedAt)
  if (seenUpdatedAt !== lastUpdatedAt) {
    setSeenUpdatedAt(lastUpdatedAt)
    setRefreshing(false)
  }

  useEffect(() => {
    if (!refreshing) return
    const id = setTimeout(() => setRefreshing(false), SPIN_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [refreshing])

  // Igual para la ventana de gracia de la reconexión: el efecto sólo programa
  // y cancela el temporizador; el reinicio al cambiar de estado va en render.
  const [warnDisconnected, setWarnDisconnected] = useState(false)
  const [seenConnection, setSeenConnection] = useState(connection)
  if (seenConnection !== connection) {
    setSeenConnection(connection)
    setWarnDisconnected(false)
  }

  useEffect(() => {
    if (connection !== 'reconnecting') return
    const id = setTimeout(() => setWarnDisconnected(true), RECONNECTING_GRACE_MS)
    return () => clearTimeout(id)
  }, [connection])

  const stale = connection === 'offline' || (connection === 'reconnecting' && warnDisconnected)
  const timeStr = lastUpdatedAt ? formatTimeInTz(lastUpdatedAt.toISOString(), timezone) : null

  return (
    <div className={cn('flex shrink-0 items-center gap-2', className)}>
      <button
        type="button"
        onClick={() => {
          setRefreshing(true)
          refreshAll()
        }}
        disabled={refreshing}
        aria-label="Actualizar datos"
        // aria-busy sólo mientras refresca (ausente el resto), como MoneyValue.
        aria-busy={refreshing || undefined}
        // Área táctil de 44 px como style inline además de la clase: jsdom no
        // calcula layout y así el test puede asertarla.
        style={{ minHeight: '44px', minWidth: '44px' }}
        className="flex shrink-0 cursor-pointer items-center justify-center border border-[var(--color-leather-muted)] px-2 text-[var(--color-bone)] hover:bg-[var(--color-cuero-viejo)] disabled:cursor-default disabled:opacity-60"
      >
        <RefreshIcon
          className={cn(
            'h-[15px] w-[15px] shrink-0',
            // Sin giro para quien pidió menos movimiento: el botón deshabilitado
            // ya comunica que algo está pasando.
            refreshing && 'animate-spin motion-reduce:animate-none',
          )}
        />
      </button>

      <div className="flex min-w-0 flex-col items-start gap-0.5 leading-none">
        {stale && (
          // role="status" para que también se anuncie: perder el canal en vivo
          // no es decorativo. Se ve en TODOS los anchos —la hora cede, el
          // aviso no—: el operador tiene que saber que está a ciegas.
          <span
            role="status"
            className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--color-bravo)]"
          >
            SIN CONEXIÓN EN VIVO
          </span>
        )}
        {timeStr && (
          <span className="hidden whitespace-nowrap font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] sm:inline">
            {stale ? `DATOS DE LAS ${timeStr}` : `ACTUALIZADO ${timeStr}`}
          </span>
        )}
      </div>
    </div>
  )
}
