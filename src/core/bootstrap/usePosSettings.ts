import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { FreshnessContext, type FreshnessTopic } from '@/core/freshness/FreshnessProvider'
import { POS_SETTINGS } from './posSettings.queries'

/** Los dos tiempos (en segundos) del bloqueo automático del POS. */
export interface PosAutoLockSettings {
  /** Inactividad general: nadie tocó la tablet y no hay venta en curso. */
  idleSeconds: number
  /** Inactividad con venta en curso (carrito con líneas o pantalla de pago). */
  checkoutSeconds: number
}

/**
 * Decisión del dueño (spec § 3.1): 15 s de inactividad y 90 s con venta en
 * curso. Se usan mientras la consulta no ha cargado y siempre que el dato del
 * servidor no sirva.
 *
 * REGLA: **el bloqueo nunca depende de la red.** Es una protección de
 * atribución (que el siguiente barbero no cobre en el perfil del anterior),
 * así que una consulta lenta, caída o con basura no puede dejar la tablet
 * abierta: se cae a estos números y el POS sigue bloqueando.
 */
export const DEFAULT_POS_SETTINGS: PosAutoLockSettings = {
  idleSeconds: 15,
  checkoutSeconds: 90,
}

/** Límites de la spec § 3.1, los mismos que valida el API. */
export const POS_SETTINGS_MIN_SECONDS = 10
export const POS_SETTINGS_MAX_SECONDS = 600

/** Lo que devuelve el API; `unknown` adentro porque en runtime nadie valida. */
interface RawPosSettings {
  readonly posAutoLockIdleSeconds?: number | null
  readonly posAutoLockCheckoutSeconds?: number | null
}

/** Tema del canal de frescura que obliga a releer: el admin guardó ajustes. */
const SETTINGS_TOPICS: readonly FreshnessTopic[] = ['settings']

/** Entero dentro de los límites, o el default. Nada de clamp silencioso. */
function secondsOrDefault(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return fallback
  if (value < POS_SETTINGS_MIN_SECONDS || value > POS_SETTINGS_MAX_SECONDS) return fallback
  return value
}

/**
 * Saneo en el cliente. El API ya valida los límites; esto es defensa en
 * profundidad (schema viejo, valor migrado a mano, respuesta corrupta): un
 * `posAutoLockIdleSeconds` de 0 dejaría la tablet bloqueándose sola sin parar,
 * y uno de 86400 no la bloquearía nunca.
 *
 * El tiempo con venta en curso nunca puede quedar por DEBAJO del general (si
 * lo estuviera, cobrar bloquearía antes que estar sin hacer nada): si el
 * servidor manda esa combinación, ese campo cae al default y, si ni el default
 * alcanza, se iguala al general.
 */
export function sanitizePosSettings(raw: RawPosSettings | null | undefined): PosAutoLockSettings {
  const idleSeconds = secondsOrDefault(raw?.posAutoLockIdleSeconds, DEFAULT_POS_SETTINGS.idleSeconds)
  const checkout = secondsOrDefault(
    raw?.posAutoLockCheckoutSeconds,
    DEFAULT_POS_SETTINGS.checkoutSeconds,
  )
  const checkoutSeconds =
    checkout >= idleSeconds ? checkout : Math.max(DEFAULT_POS_SETTINGS.checkoutSeconds, idleSeconds)
  return { idleSeconds, checkoutSeconds }
}

/**
 * Registro en el canal de frescura, tolerante a que NO haya canal.
 *
 * No usa `useLiveRefresh` a propósito ([D-029] llevado a un hook): el consumidor
 * natural de estos ajustes es el bloqueo automático, que vive en el shell de la
 * app — y ese shell también se monta SIN sesión (lock screen), donde
 * `FreshnessGate` no monta el provider. `useLiveRefresh` lanzaría y tiraría la
 * pantalla de PIN entera. Aquí, sin canal arriba, simplemente no hay registro.
 */
function useSettingsChannel(load: () => void | Promise<void>): void {
  const register = useContext(FreshnessContext)?.register
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })
  useEffect(() => {
    if (!register) return
    return register(() => loadRef.current(), SETTINGS_TOPICS)
  }, [register])
}

/**
 * Los tiempos de bloqueo automático configurados por el dueño.
 *
 * Política de datos: `posSettings` está clasificado LIVE en
 * `core/apollo/dataClasses.ts` (ajustes del negocio, sin dinero). Se lee
 * `cache-first` (cero red en el critical path de cada montaje) y se revalida
 * por EVENTO, nunca por tiempo ([D-015] sigue intacto):
 * - el canal de frescura avisa del tema `settings` cuando el admin guarda
 *   (`posDataChanged` con `kind: SETTINGS`), así que un cambio llega a todas
 *   las terminales sin recargar y sin sondeo;
 * - ese mismo registro cubre la puesta al día al reconectar el socket, el
 *   `refreshAll()` del desbloqueo con PIN y el botón "Actualizar", porque los
 *   tres disparan TODOS los temas.
 *
 * Ser LIVE (no STATIC/SESSION) significa que nunca se persiste ([D-003]): los
 * defaults ya cubren el arranque y así el dispositivo nunca guarda un ajuste
 * viejo que sobreviva a un reinicio. Si la revalidación de red falla DESPUÉS
 * de una carga buena, se conserva ese último valor en memoria en vez de caer
 * a los defaults ([D-031] — no es dinero, [D-018] no aplica).
 *
 * Devuelve SIEMPRE un par usable: mientras carga, si la consulta falla o si el
 * valor no pasa el saneo, los defaults (15 / 90).
 */
export function usePosSettings(): PosAutoLockSettings {
  const client = useApolloClient()
  const { isAuthenticated } = usePosAuth()
  const [raw, setRaw] = useState<RawPosSettings | null>(null)

  // Arranque: `cache-first`, así que en el segundo montaje (y tras desbloquear
  // con PIN) no hay red. Sin sesión no se consulta — la query es de staff y en
  // el lock screen la cookie puede estar muerta; los defaults cubren ese rato.
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    client
      .query({ query: POS_SETTINGS, fetchPolicy: 'cache-first' })
      .then((result) => {
        if (!cancelled) setRaw(result.data?.posSettings ?? null)
      })
      .catch(() => {
        /* best-effort: el bloqueo sigue con los defaults */
      })
    return () => {
      cancelled = true
    }
  }, [client, isAuthenticated])

  /**
   * Lo que corre cuando el canal avisa: consulta de red de verdad (el aviso
   * dice justamente que lo cacheado ya no vale).
   *
   * Best-effort como el gate de catálogo: nunca rechaza, porque un ajuste que
   * no se pudo releer no debe marcar como fallido el refresco de las pantallas
   * de dinero (ni mover su "Actualizado HH:MM"). Y si falla, se conserva el
   * último valor bueno en vez de volver a los defaults: es un ajuste, no
   * dinero — [D-018] no aplica.
   */
  const revalidate = useCallback((): Promise<void> => {
    if (!isAuthenticated) return Promise.resolve()
    return client
      .query({ query: POS_SETTINGS, fetchPolicy: 'network-only' })
      .then((result) => {
        setRaw(result.data?.posSettings ?? null)
      })
      .catch(() => {
        /* best-effort */
      })
  }, [client, isAuthenticated])

  useSettingsChannel(revalidate)

  // Identidad estable mientras el dato no cambie: estos valores se usan como
  // dependencia de los temporizadores del bloqueo y un objeto nuevo por render
  // los reprogramaría sin parar.
  return useMemo(() => sanitizePosSettings(raw), [raw])
}
