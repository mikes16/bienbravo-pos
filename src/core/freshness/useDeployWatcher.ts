import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { getSaleActivitySnapshot, subscribeSaleActivity } from '@/core/auth/saleActivity.ts'
import { getWsStatus, subscribeWsStatus } from '@/core/apollo/wsStatus.ts'

/**
 * Identificador del build que está CORRIENDO en esta pestaña. Lo inyecta Vite
 * con `define` (ver vite.config.ts) y es el mismo valor que el build escribe en
 * `dist/version.json`. Bajo vitest el `define` no se aplica y cae a `'test'`,
 * igual que en `src/core/apollo/client.ts`.
 */
const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'test'

/** Manifiesto que publica el build. `vercel.json` lo sirve con `no-store`. */
export const VERSION_URL = '/version.json'

/**
 * Build por el que esta pestaña YA se recargó. Vive en `sessionStorage`
 * (sobrevive al reload, muere con la pestaña) y es la protección contra el
 * ciclo: si el hosting sirve un `version.json` nuevo pero un `index.html`
 * viejo, recargar no arregla nada y sin esta marca el POS se quedaría
 * recargándose para siempre. Preferimos un POS viejo y usable a uno inservible.
 */
export const RELOADED_BUILD_KEY = 'bb-pos-reloaded-build'

export interface DeployWatcherState {
  /**
   * Hay una versión nueva publicada y todavía no se puede recargar (hay una
   * venta en curso o un cobro en vuelo). El shell pinta la franja; en cuanto la
   * venta termina, la recarga ocurre sola.
   */
  readonly updateAvailable: boolean
}

/** Forma mínima que esperamos del manifiesto; todo lo demás se ignora. */
interface VersionManifest {
  readonly buildId?: unknown
}

/**
 * Lee el build desplegado. Nunca lanza: sin red, con un 404 o con un JSON roto
 * devuelve `null` y el POS sigue trabajando con lo que tiene. Esta consulta no
 * puede ser la que rompa el turno.
 */
async function readDeployedBuildId(): Promise<string | null> {
  try {
    // `no-store`: el manifiesto es justamente lo que no debe venir de ningún
    // caché intermedio (ni del navegador ni del CDN).
    const response = await fetch(VERSION_URL, { cache: 'no-store' })
    if (!response.ok) return null
    const manifest = (await response.json()) as VersionManifest
    const deployed = manifest?.buildId
    return typeof deployed === 'string' && deployed.length > 0 ? deployed : null
  } catch {
    return null
  }
}

function alreadyReloadedFor(buildId: string): boolean {
  try {
    return window.sessionStorage.getItem(RELOADED_BUILD_KEY) === buildId
  } catch {
    // Almacenamiento bloqueado (modo privado): sin marca no hay protección
    // contra el ciclo, pero tampoco vamos a impedir la actualización.
    return false
  }
}

function rememberReload(buildId: string): void {
  try {
    window.sessionStorage.setItem(RELOADED_BUILD_KEY, buildId)
  } catch {
    // Ver arriba: mejor recargar sin marca que no recargar.
  }
}

/**
 * Detecta que se desplegó una versión nueva del POS y recarga la pestaña
 * cuando eso no le estorba a nadie (spec § 3.6).
 *
 * El problema: la tablet de la sucursal tiene la misma pestaña abierta todo el
 * día. Tras un deploy sigue corriendo el JavaScript viejo contra un API nuevo,
 * y eso se nota justo el día en que el lote cambia las dos mitades a la vez.
 *
 * **Sin sondeo.** No hay temporizadores ni consultas en reposo ([D-015], P3 del
 * spec): el manifiesto se lee sólo en dos momentos, los dos gratis porque ya
 * están ocurriendo cosas:
 *
 * 1. **Cuando el socket se RE-conecta.** Un deploy del API siempre tira la
 *    conexión, así que la reconexión es la señal más barata que existe de que
 *    algo se desplegó. La primera conexión no cuenta (esa no se perdió nada),
 *    misma regla que `FreshnessProvider`.
 * 2. **Al desbloquear con PIN.** En el POS eso es literalmente el montaje de
 *    este hook: `PosShell` está DESMONTADO mientras el candado está puesto
 *    (con `isLocked` la ruta se va al lock screen), así que cada desbloqueo lo
 *    monta de nuevo. También se cubre la transición bloqueado → desbloqueado
 *    dentro de un mismo montaje, por si algún día el hook sube de sitio.
 *
 * Política de recarga, en orden:
 * - Con un cobro ENVIÁNDOSE (`submitting`) no se recarga nunca: cortar a media
 *   petición dejaría al operador sin saber si la venta se registró.
 * - Con el POS bloqueado, o sin venta en curso, se recarga de inmediato: no hay
 *   nada que perder y es el mejor momento posible.
 * - Con venta en curso se espera. El carrito vive en memoria y una recarga lo
 *   borra: se avisa con la franja (`updateAvailable`) y la recarga sale sola en
 *   cuanto la venta se cierra.
 *
 * En desarrollo (`import.meta.env.DEV`) queda inerte: el HMR ya se encarga y
 * `version.json` ni siquiera existe fuera de un build.
 */
export function useDeployWatcher(): DeployWatcherState {
  const { isLocked } = usePosAuth()
  const { inProgress, submitting } = useSyncExternalStore(
    subscribeSaleActivity,
    getSaleActivitySnapshot,
    getSaleActivitySnapshot,
  )
  // Build desplegado que ya vimos y que todavía no hemos podido aplicar.
  const [pendingBuildId, setPendingBuildId] = useState<string | null>(null)

  const enabled = !import.meta.env.DEV

  const check = useCallback(() => {
    if (!enabled) return
    void readDeployedBuildId().then((deployed) => {
      // Sin respuesta utilizable, o ya estamos en esa versión: nada que hacer.
      if (deployed === null || deployed === BUILD_ID) return
      // Ya recargamos por este build y seguimos viendo el viejo: el hosting
      // está sirviendo mezcla. Recargar otra vez sería un ciclo infinito.
      if (alreadyReloadedFor(deployed)) return
      setPendingBuildId((prev) => (prev === deployed ? prev : deployed))
    })
  }, [enabled])

  // `null` = todavía no corrimos en este montaje.
  const previousLocked = useRef<boolean | null>(null)

  useEffect(() => {
    const previous = previousLocked.current
    previousLocked.current = isLocked
    if (isLocked) return
    // Montaje con el POS abierto (que en el shell ES el desbloqueo) o
    // transición bloqueado → desbloqueado sin desmontar.
    if (previous === null || previous) check()
  }, [isLocked, check])

  useEffect(() => {
    if (!enabled) return
    let seenConnections = getWsStatus().connections
    return subscribeWsStatus((next) => {
      if (next.status !== 'connected') return
      const isReconnection =
        next.connections > seenConnections && (next.reconnected || seenConnections > 0)
      seenConnections = next.connections
      if (isReconnection) check()
    })
  }, [enabled, check])

  // Aplicar la versión nueva. Se re-evalúa en cada cambio de la actividad de
  // venta, que es lo que hace que la recarga salga sola al cerrar el cobro.
  useEffect(() => {
    if (pendingBuildId === null) return
    if (submitting) return
    if (inProgress && !isLocked) return
    if (alreadyReloadedFor(pendingBuildId)) return
    rememberReload(pendingBuildId)
    window.location.reload()
  }, [pendingBuildId, isLocked, inProgress, submitting])

  return useMemo(() => ({ updateAvailable: pendingBuildId !== null }), [pendingBuildId])
}
