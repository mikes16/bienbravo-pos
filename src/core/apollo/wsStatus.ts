/**
 * Estado del socket de subscriptions (graphql-ws), como emisor mínimo de
 * módulo — sin React, sin Apollo.
 *
 * ¿Por qué un módulo y no un contexto? Porque quien conoce el estado real del
 * socket es `createClient()` de graphql-ws (se construye una vez, fuera del
 * árbol de React, en `createPosApolloClient`) y quien lo necesita es un
 * provider que se monta después: `client.ts` reporta desde los callbacks `on`,
 * `FreshnessProvider` escucha.
 *
 * El dato clave para la frescura NO es "estoy conectado", sino **"esta
 * conexión es la primera o es una reconexión"**: el pubsub del API es en
 * memoria y no reenvía lo que pasó mientras el socket estuvo caído, así que
 * cada reconexión obliga a una puesta al día (UNA consulta, no un sondeo). Por
 * eso contamos las conexiones exitosas de la pestaña. El único temporizador es
 * de una vez y sólo degrada la etiqueta a "sin conexión": no consulta nada.
 */

export type WsConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'

export interface WsStatusState {
  /**
   * - `connecting`: todavía no hay un ACK del servidor en esta pestaña.
   * - `connected`: socket vivo.
   * - `reconnecting`: se cayó una conexión que ya había funcionado; graphql-ws
   *   está reintentando (`retryAttempts: Infinity`).
   * - `offline`: la caída lleva más de `OFFLINE_AFTER_MS`. La UI debe decirlo:
   *   nunca presentar datos viejos como actuales.
   */
  readonly status: WsConnectionStatus
  /** Conexiones establecidas desde que cargó la app. La primera es `1`. */
  readonly connections: number
  /** `true` sólo mientras la conexión vigente sea una RE-conexión. */
  readonly reconnected: boolean
}

/**
 * Cuánto aguantamos una caída antes de llamarla "sin conexión". Por debajo de
 * este umbral el reintento de graphql-ws suele ganar y no vale la pena
 * alarmar al operador (el `keepAlive` del cliente es de 12 s).
 */
export const OFFLINE_AFTER_MS = 8_000

const INITIAL_STATE: WsStatusState = { status: 'connecting', connections: 0, reconnected: false }

let state: WsStatusState = INITIAL_STATE
const listeners = new Set<(next: WsStatusState) => void>()
let offlineTimer: ReturnType<typeof setTimeout> | null = null

function emit(next: WsStatusState): void {
  state = next
  // Copia defensiva: un listener puede desuscribirse dentro del callback.
  for (const listener of [...listeners]) listener(state)
}

function clearOfflineTimer(): void {
  if (offlineTimer === null) return
  clearTimeout(offlineTimer)
  offlineTimer = null
}

function startOfflineTimer(): void {
  // Si ya hay uno armado NO lo reiniciamos: graphql-ws emite `error` y
  // `closed` en cada intento fallido y reiniciarlo dejaría el estado en
  // "reconectando" para siempre, sin llegar nunca a avisar "sin conexión".
  if (offlineTimer !== null || state.status === 'offline') return
  offlineTimer = setTimeout(() => {
    offlineTimer = null
    if (state.status === 'connected') return
    emit({ ...state, status: 'offline' })
  }, OFFLINE_AFTER_MS)
}

export function getWsStatus(): WsStatusState {
  return state
}

/** Devuelve la función para desuscribirse. */
export function subscribeWsStatus(listener: (next: WsStatusState) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Lo llama `on.connected` de graphql-ws. `wasRetry` lo provee la propia
 * librería; el contador es el respaldo por si algún día cambia la firma.
 */
export function reportWsConnected(wasRetry = false): void {
  clearOfflineTimer()
  const connections = state.connections + 1
  emit({ status: 'connected', connections, reconnected: wasRetry || connections > 1 })
}

/** Lo llaman `on.closed` y `on.error` de graphql-ws. */
export function reportWsDisconnected(): void {
  if (state.status === 'connected' || state.status === 'connecting') {
    emit({
      status: state.connections > 0 ? 'reconnecting' : 'connecting',
      connections: state.connections,
      reconnected: false,
    })
  }
  startOfflineTimer()
}

/** Sólo para tests: devuelve el módulo a su estado de arranque. */
export function resetWsStatus(): void {
  clearOfflineTimer()
  listeners.clear()
  state = INITIAL_STATE
}
