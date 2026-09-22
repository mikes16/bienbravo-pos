import { AUTO_LOCK_WARNING_SECONDS, useAutoLock } from './useAutoLock.ts'
import { usePosAuth } from './usePosAuth.ts'

/**
 * Lo que oye un lector de pantalla cuando aparece la franja. Es un texto
 * CONSTANTE a propósito: si el número vivo entrara aquí, la región viva
 * volvería a hablar cada segundo ("…en 4", "…en 3") y taparía cualquier otra
 * cosa que el operador estuviera escuchando. Se anuncia UNA vez —al insertarse
 * la región— y el resto de la cuenta atrás es sólo visual.
 */
const ANNOUNCEMENT = `El POS se bloqueará en ${AUTO_LOCK_WARNING_SECONDS} segundos`

/**
 * Evento de actividad que `useAutoLock` escucha sobre `document` (uno de sus
 * `ACTIVITY_EVENTS`). Tocar la franja ya lo produce solo; publicarlo a mano
 * cubre el hueco de la activación que NO viene de un dedo — ver `keepUsing`.
 */
const ACTIVITY_EVENT = 'pointerdown'

/**
 * Reinicio explícito del contador.
 *
 * Cualquier toque o tecla reinicia el bloqueo por su cuenta (el hook escucha
 * sobre `document`), así que la franja se retira sola sin que nadie la
 * "cierre". El hueco está en la activación por tecnología asistiva o por
 * voz: ahí llega un `click` sin `pointerdown` ni `keydown` previos, y sin esto
 * el operador tocaría "Seguir usando el POS" y la tablet se bloquearía igual.
 *
 * `useAutoLock` no expone un `reset()` (hoy su contrato es sólo de lectura),
 * así que se publica el mismo evento que ya escucha. Si algún día lo expone,
 * este es el único call site que cambia.
 */
function keepUsing() {
  document.dispatchEvent(new Event(ACTIVITY_EVENT))
}

/**
 * Franja de aviso de los últimos segundos antes del bloqueo automático
 * (spec § 3.3 punto 3).
 *
 * Con 15 s de reposo el bloqueo llega rápido y a propósito; sin aviso, al
 * operador se le apaga el POS a media lectura y no entiende por qué. La franja
 * da el margen: dice cuánto falta y que un toque basta para seguir.
 *
 * Decisiones de layout (`PosShell`):
 * - **Va en el flujo del shell, no flotando sobre él.** Ocupa su propia fila
 *   entre el contenido y la barra de pestañas: su alto se lo quita a la
 *   pantalla, que es la forma más simple de no tapar el CTA de cobro (vive
 *   pegado al fondo del carrito) ni los tabs.
 * - **`z-index` por encima de las hojas** (`PaymentSheet` y el carrito móvil
 *   son `fixed z-50`): con una hoja abierta corre el tiempo largo de cobro y
 *   es justo cuando el aviso tiene que verse. Sigue por debajo de los toasts.
 *
 * Accesibilidad:
 * - Toda la franja es un botón con nombre estable ("Seguir usando el POS")
 *   para quien navega con teclado. El nombre no puede ser el texto visible
 *   porque cambia cada segundo: un control que se renombra cinco veces
 *   seguidas es ruido puro para un lector de pantalla.
 * - El número vivo va `aria-hidden` y el anuncio sale una sola vez por la
 *   región `role="status"`.
 * - La barra se vacía con una transición de 1 s, o por pasos secos con
 *   `prefers-reduced-motion` (además de la regla global de `index.css`).
 */
export function AutoLockWarning() {
  const { isAuthenticated, isLocked } = usePosAuth()
  const { secondsRemaining } = useAutoLock()

  // Sin sesión o con el POS ya bloqueado no hay nada que avisar. El hook ya
  // devuelve `null` en esos casos y `PosShell` ni se monta bloqueado: esto es
  // el cinturón, porque una franja que sobreviva al candado sería una fuga de
  // estado de la sesión anterior en la pantalla de PIN.
  if (!isAuthenticated || isLocked) return null
  if (secondsRemaining === null) return null
  if (secondsRemaining <= 0 || secondsRemaining > AUTO_LOCK_WARNING_SECONDS) return null

  const remainingPct = (secondsRemaining / AUTO_LOCK_WARNING_SECONDS) * 100

  return (
    <div className="relative z-[55] shrink-0 border-t border-[var(--color-bravo)] bg-[var(--color-carbon-elevated)]">
      <button
        type="button"
        onClick={keepUsing}
        aria-label="Seguir usando el POS"
        // Área táctil mínima como estilo inline además de la clase: jsdom no
        // calcula layout y así el test puede asertarla (igual que RefreshControl).
        style={{ minHeight: '44px' }}
        className="flex w-full cursor-pointer items-center justify-center px-4 py-3 text-center hover:bg-[var(--color-cuero-viejo)]"
      >
        <span
          // Decorativo para el lector de pantalla: el anuncio ya lo dio la
          // región de abajo y este texto cambia cada segundo.
          aria-hidden
          className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone)]"
        >
          {`Se bloquea en ${secondsRemaining}… toca para seguir`}
        </span>
      </button>

      {/* Barra de tiempo. `progressbar` NO es región viva: el valor cambia cada
          segundo sin que nadie lo cante, y aun así queda consultable. */}
      <div
        role="progressbar"
        aria-label="Tiempo antes del bloqueo"
        aria-valuemin={0}
        aria-valuemax={AUTO_LOCK_WARNING_SECONDS}
        aria-valuenow={secondsRemaining}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-[var(--color-leather-muted)]/30"
      >
        <div
          style={{ width: `${remainingPct}%` }}
          className="h-full bg-[var(--color-bravo)] transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
        />
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {ANNOUNCEMENT}
      </span>
    </div>
  )
}
