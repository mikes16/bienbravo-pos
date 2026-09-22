import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useApolloClient } from '@apollo/client/react'
import type { TypedDocumentNode } from '@apollo/client'
import { useLocation } from '@/core/location/useLocation'
import { getWsStatus, subscribeWsStatus, type WsStatusState } from '@/core/apollo/wsStatus'
import {
  POS_HOME_SALE_EVENT,
  POS_HOME_WALK_IN_QUEUE_UPDATED,
  POS_HOME_APPOINTMENT_UPDATED,
} from '@/features/home/data/home.queries'

/**
 * Canal ÚNICO de frescura del POS.
 *
 * Decisión del dueño (18 sep 2026): **no hay latido**. Nada consulta al
 * servidor "por si acaso" cada N segundos; el servidor avisa por WebSocket y
 * el cliente se pone al día cuando se reconecta. Por eso aquí no existe
 * ningún temporizador periódico — hay un check de lint que lo verifica; los
 * únicos temporizadores son de UNA vez (cierre de la ventana de ráfagas).
 *
 * El bug que origina esto (R8): "Ventas del día" mostraba 2 ventas habiendo
 * 14. La terminal pintó su caché, no recibió los eventos, y como es un iPad
 * dedicado que nunca pierde el foco tampoco disparaba `focus` /
 * `visibilitychange`. Además cada página abría SUS suscripciones sólo mientras
 * estaba montada: al salir de la pantalla se perdían los avisos.
 *
 * Aquí se abren UNA vez por sucursal para toda la app y se traducen a TEMAS;
 * las pantallas registran su carga con `useLiveRefresh` y reciben sólo el suyo.
 * Dispara "refrescar" para el tema del evento que llega, y para TODOS cuando el
 * socket pasa de caído a conectado (puesta al día: UNA consulta por reconexión
 * — el pubsub del API es en memoria y no reenvía lo ocurrido durante la caída),
 * cuando la pestaña vuelve a ser visible o gana foco, y en `refreshAll()`.
 *
 * Reglas: mínimo 5 s entre refrescos del MISMO tema (la ráfaga se agrupa en un
 * refresco, más uno final al cerrar la ventana si llegaron más) y nada se
 * refresca mientras un cobro se está enviando (`setPaused`).
 */

/**
 * Temas del canal. Una pantalla se registra sólo en los suyos (una carga por
 * CLASE de dato, no una por pantalla).
 *
 * `register` (Caja) es un tema SIN fuente de eventos todavía, y eso es
 * deliberado: la suscripción del API que avisará de apertura/cierre/corrección
 * de caja (spec 3.3 c: "eventos que hoy no existen") llega en una tarea
 * posterior del API. Por eso `EVENT_SOURCES` sigue teniendo tres entradas — no
 * hay nada que cablear aquí ni un olvido que arreglar. Mientras tanto el tema
 * sí se dispara por reconexión, por foco/visibilidad y por `refreshAll()`,
 * porque los tres usan `FRESHNESS_TOPICS` completo. El día que la suscripción
 * exista, agregar su entrada a `EVENT_SOURCES` es todo el cambio.
 */
export type FreshnessTopic = 'sales' | 'walkins' | 'appointments' | 'register'

/** Orden estable; se usa como "todos los temas". */
export const FRESHNESS_TOPICS: readonly FreshnessTopic[] = [
  'sales',
  'walkins',
  'appointments',
  'register',
]

/** Mínimo entre dos refrescos del mismo tema. Agrupa ráfagas de eventos. */
export const MIN_REFRESH_GAP_MS = 5_000

export type FreshnessLoader = () => void | Promise<void>

/**
 * Lo que la UI puede decir del canal en vivo. `reconnecting` cubre también el
 * arranque (todavía sin ACK): en ninguno de los dos casos hay push confiable.
 */
export type FreshnessConnection = 'connected' | 'reconnecting' | 'offline'

export interface FreshnessContextValue {
  connection: FreshnessConnection
  /** Momento del último refresco exitoso ("Actualizado 18:36"). */
  lastUpdatedAt: Date | null
  /** Red de seguridad manual: refresca todos los temas ignorando la ventana. */
  refreshAll: () => void
  /** `true` mientras un cobro se está enviando: los refrescos quedan pendientes. */
  setPaused: (paused: boolean) => void
  /** Uso interno de `useLiveRefresh`; devuelve la función para desregistrar. */
  register: (load: FreshnessLoader, topics: readonly FreshnessTopic[]) => () => void
}

export const FreshnessContext = createContext<FreshnessContextValue | null>(null)

interface EventSource {
  readonly query: TypedDocumentNode<unknown, { slug: string }>
  readonly topic: FreshnessTopic
  readonly label: string
}

/**
 * Las tres suscripciones que ya existen en el API. Su carga útil es mínima a
 * propósito (tipo + sucursal + id, sin montos ni nombres): son pings de
 * invalidación; el dato viaja después por la consulta HTTP autenticada.
 *
 * No hay entrada para `register` porque el API aún no publica ese evento (ver
 * el docblock de `FreshnessTopic`): la lista tiene tres elementos a propósito.
 */
const EVENT_SOURCES: readonly EventSource[] = [
  { query: POS_HOME_SALE_EVENT, topic: 'sales', label: 'saleEvent' },
  { query: POS_HOME_WALK_IN_QUEUE_UPDATED, topic: 'walkins', label: 'walkInQueueUpdated' },
  { query: POS_HOME_APPOINTMENT_UPDATED, topic: 'appointments', label: 'appointmentUpdated' },
]

interface RegisteredLoader {
  load: FreshnessLoader
  topics: readonly FreshnessTopic[]
}

export interface FreshnessEngine {
  register: (load: FreshnessLoader, topics: readonly FreshnessTopic[]) => () => void
  /** `force` salta la ventana de 5 s (puesta al día y botón "Actualizar"). */
  trigger: (topics: readonly FreshnessTopic[], force?: boolean) => void
  setPaused: (paused: boolean) => void
  dispose: () => void
}

/**
 * Motor de refresco en TypeScript puro (sin React): registro por tema, ventana
 * de agrupación y pausa. Fuera del componente para no depender del ciclo de
 * render — se crea UNA vez con el `useState` perezoso del provider.
 */
export function createFreshnessEngine(onRefreshed: (at: Date) => void): FreshnessEngine {
  const registered = new Set<RegisteredLoader>()
  /** Último refresco por tema. `0` = nunca: el primer evento entra de inmediato. */
  const lastRunAt: Record<FreshnessTopic, number> = {
    sales: 0,
    walkins: 0,
    appointments: 0,
    register: 0,
  }
  /** Temas que pidieron refresco dentro de la ventana o estando en pausa. */
  const pending = new Set<FreshnessTopic>()
  /** Un temporizador de CIERRE DE VENTANA por tema (one-shot, no periódico). */
  const timers = new Map<FreshnessTopic, ReturnType<typeof setTimeout>>()
  let paused = false

  function invoke(topics: readonly FreshnessTopic[]): void {
    const calls: Array<Promise<unknown>> = []
    // Copia: un cargador puede desregistrarse mientras iteramos.
    for (const entry of [...registered]) {
      if (!entry.topics.some((topic) => topics.includes(topic))) continue
      try {
        // Sincrónico: la pantalla pide su dato en el mismo tick del evento.
        calls.push(Promise.resolve(entry.load()))
      } catch (err) {
        calls.push(Promise.reject(err instanceof Error ? err : new Error(String(err))))
      }
    }
    if (calls.length === 0) return
    void Promise.allSettled(calls).then((results) => {
      // "Último refresco exitoso": si alguna pantalla falló, la hora no se
      // mueve — sería mentirle al operador sobre qué tan fresco es lo que ve.
      if (results.every((result) => result.status === 'fulfilled')) onRefreshed(new Date())
    })
  }

  function scheduleWindowClose(topic: FreshnessTopic, delayMs: number): void {
    if (timers.has(topic)) return
    const id = setTimeout(() => {
      timers.delete(topic)
      if (!pending.has(topic)) return
      trigger([topic])
    }, Math.max(delayMs, 0))
    timers.set(topic, id)
  }

  function trigger(topics: readonly FreshnessTopic[], force = false): void {
    if (paused) {
      // Cobro en vuelo: ni competimos por la red ni movemos la pantalla debajo
      // del operador. Se ejecuta al reanudar.
      for (const topic of topics) pending.add(topic)
      return
    }
    const now = Date.now()
    const due: FreshnessTopic[] = []
    for (const topic of topics) {
      if (force || now - lastRunAt[topic] >= MIN_REFRESH_GAP_MS) {
        due.push(topic)
        continue
      }
      pending.add(topic)
      scheduleWindowClose(topic, lastRunAt[topic] + MIN_REFRESH_GAP_MS - now)
    }
    if (due.length === 0) return
    for (const topic of due) {
      lastRunAt[topic] = now
      pending.delete(topic)
    }
    // Un cargador suscrito a dos temas que llegan juntos corre UNA vez.
    invoke(due)
  }

  return {
    register(load, topics) {
      const entry: RegisteredLoader = { load, topics }
      registered.add(entry)
      return () => {
        registered.delete(entry)
      }
    },
    trigger,
    setPaused(next) {
      if (paused === next) return
      paused = next
      if (next || pending.size === 0) return
      // Al reanudar se ejecuta lo pendiente sin esperar la ventana: la pausa
      // del cobro ya cumplió la función de agrupar.
      const queued = [...pending]
      pending.clear()
      const now = Date.now()
      for (const topic of queued) lastRunAt[topic] = now
      invoke(queued)
    },
    dispose() {
      for (const id of timers.values()) clearTimeout(id)
      timers.clear()
      registered.clear()
      pending.clear()
    },
  }
}

function toConnection(status: WsStatusState['status']): FreshnessConnection {
  if (status === 'connected') return 'connected'
  if (status === 'offline') return 'offline'
  return 'reconnecting'
}

export function FreshnessProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient()
  const { locationSlug } = useLocation()
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [connection, setConnection] = useState<FreshnessConnection>(() =>
    toConnection(getWsStatus().status),
  )
  // `useState` perezoso (no `useMemo`): React puede descartar un `useMemo`
  // para liberar memoria y eso se llevaría el registro de cargadores.
  // `setLastUpdatedAt` ya existe en este mismo render y es estable.
  const [engine] = useState(() => createFreshnessEngine(setLastUpdatedAt))

  useEffect(() => () => { engine.dispose() }, [engine])

  // UN canal por sucursal para toda la app. Se reabre sólo si cambia el slug.
  useEffect(() => {
    if (!locationSlug) return
    const subscriptions = EVENT_SOURCES.map(({ query, topic, label }) =>
      client
        .subscribe({
          query,
          variables: { slug: locationSlug },
          // Los eventos no se guardan: son avisos, no datos. Así tampoco
          // ensucian el cache (ni lo que se evalúa para persistir).
          fetchPolicy: 'no-cache',
        })
        .subscribe({
          next: () => {
            engine.trigger([topic])
          },
          error: (err: unknown) => {
            // graphql-ws reintenta solo (retryAttempts: Infinity); aquí sólo
            // dejamos rastro en dev. La puesta al día al reconectar cubre el
            // hueco.
            if (import.meta.env.DEV) console.warn(`[freshness] ${label} error`, err)
          },
        }),
    )
    return () => {
      for (const subscription of subscriptions) subscription.unsubscribe()
    }
  }, [client, locationSlug, engine])

  // Puesta al día al reconectar: UNA vez por reconexión, nunca en la primera
  // conexión (esa no se perdió nada).
  useEffect(() => {
    let seenConnections = getWsStatus().connections
    return subscribeWsStatus((next) => {
      setConnection(toConnection(next.status))
      if (next.status !== 'connected') return
      const isReconnection =
        next.connections > seenConnections && (next.reconnected || seenConnections > 0)
      seenConnections = next.connections
      if (isReconnection) engine.trigger(FRESHNESS_TOPICS, true)
    })
  }, [engine])

  // Se conservan como red de seguridad (spec 3.3d), aunque en una terminal
  // dedicada casi nunca disparan: aquí sí respetan la ventana de 5 s.
  useEffect(() => {
    const onFocus = () => { engine.trigger(FRESHNESS_TOPICS) }
    const onVisible = () => {
      if (document.visibilityState === 'visible') engine.trigger(FRESHNESS_TOPICS)
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [engine])

  const refreshAll = useCallback(() => {
    engine.trigger(FRESHNESS_TOPICS, true)
  }, [engine])

  const setPaused = useCallback((paused: boolean) => {
    engine.setPaused(paused)
  }, [engine])

  const register = useCallback(
    (load: FreshnessLoader, topics: readonly FreshnessTopic[]) => engine.register(load, topics),
    [engine],
  )

  const value = useMemo<FreshnessContextValue>(
    () => ({ connection, lastUpdatedAt, refreshAll, setPaused, register }),
    [connection, lastUpdatedAt, refreshAll, setPaused, register],
  )

  return <FreshnessContext.Provider value={value}>{children}</FreshnessContext.Provider>
}
