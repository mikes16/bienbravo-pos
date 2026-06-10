/**
 * RUM (Real User Monitoring) sender — best-effort, cero impacto en el render.
 *
 * Destino configurable vía `VITE_RUM_ENDPOINT`. Si no está seteado, en DEV
 * imprime a consola y en PROD es no-op silencioso (no agrega red). Cuando el
 * API exponga un endpoint de ingest, se setea la env y los eventos fluyen sin
 * tocar este código.
 *
 * Se usa `navigator.sendBeacon` para no bloquear la descarga ni competir por
 * el hilo principal — el beacon se entrega en background aunque la pestaña se
 * cierre.
 */

export type BootKind = 'cold' | 'warm'

/**
 * Heurística barata: si ya había cache Apollo persistido al boot, el device
 * ya pasó por aquí → "warm". Primer arranque en el device → "cold". No es
 * exacto (no distingue bfcache) pero separa el caso que importa: ¿el operador
 * está esperando una descarga fría o ya tiene todo en disco?
 */
export function bootKind(): BootKind {
  try {
    return window.localStorage.getItem('bb-pos-apollo-cache') ? 'warm' : 'cold'
  } catch {
    return 'cold'
  }
}

export interface RumEvent {
  kind: 'web-vital' | 'nav'
  name: string
  value: number
  rating?: string
  route: string
  boot: BootKind
}

export function sendRum(event: RumEvent): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[rum:${event.kind}]`, event.name, Math.round(event.value), event.rating ?? '')
  }
  const endpoint = import.meta.env.VITE_RUM_ENDPOINT as string | undefined
  if (!endpoint) return
  try {
    navigator.sendBeacon(endpoint, JSON.stringify(event))
  } catch {
    /* sendBeacon no disponible / payload rechazado — RUM es best-effort */
  }
}
