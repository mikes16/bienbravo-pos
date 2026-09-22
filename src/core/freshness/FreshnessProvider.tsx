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
import { POS_DATA_CHANGED } from './freshness.queries'
import { PosDataEventKind } from '@/core/graphql/generated/graphql'

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
 *
 * Un error a nivel de SUSCRIPCIÓN (el servidor rechaza esa operación) no es lo
 * mismo que una caída del socket: termina ese observable y graphql-ws NO lo
 * reabre al reconectar — sólo re-suscribe las operaciones vivas. Tragárselo
 * dejaría esa fuente muerta con el socket diciendo "conectado": el fallo
 * silencioso de R8 otra vez, ahora sin síntoma visible. Por eso cada fuente se
 * reabre sola con espera creciente (1 s, 2 s, 4 s… con tope de 30 s, cadena de
 * temporizadores de UNA vez), el canal se anuncia degradado mientras tanto y al
 * recuperarse se pone al día con los temas de esa fuente. El error se registra
 * SIEMPRE, también en producción: un canal roto en una iPad de sucursal no
 * puede depender de que alguien tenga la consola de dev abierta.
 */

/**
 * Temas del canal. Una pantalla se registra sólo en los suyos (una carga por
 * CLASE de dato, no una por pantalla).
 *
 * Todos tienen ya fuente de eventos: `sales`, `walkins` y `appointments` por
 * las tres suscripciones de Hoy, y `register`, `catalog` y `settings` (más
 * otra vía a `sales`) por el aviso genérico `posDataChanged` (spec 3.3 c).
 * Además se disparan todos por reconexión, por foco/visibilidad y por
 * `refreshAll()`, porque los tres usan `FRESHNESS_TOPICS` completo.
 */
export type FreshnessTopic =
  | 'sales'
  | 'walkins'
  | 'appointments'
  | 'register'
  | 'catalog'
  | 'settings'

/** Orden estable; se usa como "todos los temas". */
export const FRESHNESS_TOPICS: readonly FreshnessTopic[] = [
  'sales',
  'walkins',
  'appointments',
  'register',
  'catalog',
  'settings',
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
  readonly label: string
  /**
   * Temas que invalida el aviso recibido. Lista vacía = el aviso no aplica
   * (p. ej. un `kind` que esta versión del POS todavía no conoce): se ignora
   * sin refrescar nada y sin romper el canal.
   */
  readonly topicsOf: (data: unknown) => readonly FreshnessTopic[]
  /**
   * TODO lo que esta fuente puede invalidar. Es lo que se pone al día cuando
   * la suscripción se recupera tras un rechazo: mientras estuvo muerta pudimos
   * perdernos cualquiera de sus avisos, no sólo el último.
   */
  readonly topics: readonly FreshnessTopic[]
}

/**
 * Espera antes de reabrir una suscripción rechazada: 1 s, 2 s, 4 s… con tope
 * de 30 s. Cada intento arma UN temporizador de una sola vez que, si vuelve a
 * fallar, arma el siguiente ([D-015]: el POS no repite nada por reloj).
 */
const RESUBSCRIBE_BASE_DELAY_MS = 1_000
const RESUBSCRIBE_MAX_DELAY_MS = 30_000

/**
 * Cuánto tiene que sobrevivir una re-suscripción para darla por buena. No hay
 * ACK por operación en graphql-ws: un rechazo del servidor llega en
 * milisegundos, así que aguantar esta ventana sin error es la mejor señal
 * disponible de "la fuente volvió" (un aviso recibido antes también vale).
 */
const RESUBSCRIBE_SETTLE_MS = 2_000

/** A partir de aquí el fallo dejó de ser un tropiezo y el log lo dice fuerte. */
const PERSISTENT_FAILURE_STREAK = 5

function resubscribeDelayMs(failures: number): number {
  const step = Math.max(failures - 1, 0)
  return Math.min(RESUBSCRIBE_BASE_DELAY_MS * 2 ** step, RESUBSCRIBE_MAX_DELAY_MS)
}

/**
 * Deja rastro del error SIEMPRE (no sólo en dev). `core/telemetry` no sirve
 * aquí: sólo manda web-vitals/navegación por beacon y no tiene canal de
 * errores, así que hasta que exista un ingest el log del dispositivo es el
 * rastro. Lo que no puede pasar es que el canal muera en silencio.
 */
function reportSourceError(
  source: EventSource,
  err: unknown,
  failures: number,
  retryInMs: number,
): void {
  const streak =
    failures >= PERSISTENT_FAILURE_STREAK
      ? ` · ${failures} fallos seguidos: el POS está sin avisos de ${source.topics.join(', ')}`
      : ''
  console.error(
    `[freshness] la suscripción ${source.label} falló; se reabre en ${Math.round(retryInMs / 1000)} s${streak}`,
    err,
  )
}

/**
 * Qué invalida cada `kind` de `posDataChanged`.
 *
 * - `REGISTER`: otra iPad abrió o cerró la caja.
 * - `PAYMENT`: una corrección de forma de pago mueve montos entre canales de
 *   la caja, así que toca `sales` Y `register`.
 * - `COMMISSION`: cambia lo que el barbero tiene ganado (`sales`).
 * - `CATALOG` / `SETTINGS`: precios y ajustes del negocio, cada uno al suyo.
 *
 * Tipado con el enum generado: si el API agrega un `kind`, esto no compila
 * hasta decidir a qué tema va (y mientras tanto, en runtime, se ignora).
 */
const POS_DATA_TOPICS: Readonly<Record<PosDataEventKind, readonly FreshnessTopic[]>> = {
  [PosDataEventKind.Register]: ['register'],
  [PosDataEventKind.Payment]: ['sales', 'register'],
  [PosDataEventKind.Commission]: ['sales'],
  [PosDataEventKind.Catalog]: ['catalog'],
  [PosDataEventKind.Settings]: ['settings'],
}

const NO_TOPICS: readonly FreshnessTopic[] = []

/**
 * Todo lo que `posDataChanged` puede invalidar (unión del mapa, en el orden
 * estable del canal). Derivado a propósito: un `kind` nuevo clasificado entra
 * solo en la puesta al día tras re-suscribir.
 */
const POS_DATA_ALL_TOPICS: readonly FreshnessTopic[] = FRESHNESS_TOPICS.filter((topic) =>
  Object.values(POS_DATA_TOPICS).some((topics) => topics.includes(topic)),
)

/** Fuente de temas fijos: el evento siempre invalida los mismos. */
function fixedSource(
  query: TypedDocumentNode<unknown, { slug: string }>,
  label: string,
  topics: readonly FreshnessTopic[],
): EventSource {
  return { query, label, topics, topicsOf: () => topics }
}

/** Fuente de temas por `kind`, leyendo el payload de forma defensiva. */
function posDataTopics(data: unknown): readonly FreshnessTopic[] {
  const event = (data as { posDataChanged?: { kind?: unknown } } | null | undefined)?.posDataChanged
  const kind = event?.kind
  if (typeof kind !== 'string' || !Object.hasOwn(POS_DATA_TOPICS, kind)) return NO_TOPICS
  return POS_DATA_TOPICS[kind as PosDataEventKind]
}

/**
 * Las suscripciones del canal. Su carga útil es mínima a propósito (tipo +
 * sucursal + id/hora, sin montos ni nombres): son pings de invalidación; el
 * dato viaja después por la consulta HTTP autenticada.
 *
 * `posDataChanged` es el aviso genérico por sucursal (spec 3.3 c) y cubre lo
 * que las otras tres no ven: caja, catálogo, ajustes, correcciones de pago y
 * ediciones de comisión.
 */
const EVENT_SOURCES: readonly EventSource[] = [
  fixedSource(POS_HOME_SALE_EVENT, 'saleEvent', ['sales']),
  fixedSource(POS_HOME_WALK_IN_QUEUE_UPDATED, 'walkInQueueUpdated', ['walkins']),
  fixedSource(POS_HOME_APPOINTMENT_UPDATED, 'appointmentUpdated', ['appointments']),
  {
    query: POS_DATA_CHANGED,
    label: 'posDataChanged',
    topicsOf: posDataTopics,
    topics: POS_DATA_ALL_TOPICS,
  },
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
    catalog: 0,
    settings: 0,
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
  const [wsConnection, setWsConnection] = useState<FreshnessConnection>(() =>
    toConnection(getWsStatus().status),
  )
  /**
   * Fuentes con la suscripción caída y un reintento en vuelo. Se guarda junto
   * al slug que las abrió: si cambia la sucursal, el canal es otro y el conteo
   * viejo deja de aplicar sin necesidad de resetearlo desde un efecto.
   */
  const [downSources, setDownSources] = useState<{ slug: string | null; count: number }>({
    slug: null,
    count: 0,
  })
  const channelDegraded = downSources.count > 0 && downSources.slug === locationSlug
  // El socket puede estar perfecto y el canal muerto (una operación rechazada
  // no lo tira): mientras haya una fuente caída la UI NO puede decir
  // "connected". Derivado en render, no en un efecto.
  const connection: FreshnessConnection =
    channelDegraded && wsConnection === 'connected' ? 'reconnecting' : wsConnection
  // `useState` perezoso (no `useMemo`): React puede descartar un `useMemo`
  // para liberar memoria y eso se llevaría el registro de cargadores.
  // `setLastUpdatedAt` ya existe en este mismo render y es estable.
  const [engine] = useState(() => createFreshnessEngine(setLastUpdatedAt))

  useEffect(() => () => { engine.dispose() }, [engine])

  // UN canal por sucursal para toda la app. Se reabre sólo si cambia el slug.
  useEffect(() => {
    if (!locationSlug) return
    const slug = locationSlug
    let disposed = false
    /** Etiquetas de las fuentes caídas AHORA (con reintento en vuelo). */
    const down = new Set<string>()
    const publishHealth = () => {
      // Misma cuenta = mismo objeto: un rechazo repetido de la misma fuente no
      // re-renderiza el árbol.
      setDownSources((prev) =>
        prev.slug === slug && prev.count === down.size ? prev : { slug, count: down.size },
      )
    }

    /** Abre una fuente y la mantiene viva; devuelve su cierre. */
    const superviseSource = (source: EventSource): (() => void) => {
      let subscription: { unsubscribe: () => void } | null = null
      let retryTimer: ReturnType<typeof setTimeout> | null = null
      let settleTimer: ReturnType<typeof setTimeout> | null = null
      let failures = 0

      const clearTimers = () => {
        if (retryTimer !== null) {
          clearTimeout(retryTimer)
          retryTimer = null
        }
        if (settleTimer !== null) {
          clearTimeout(settleTimer)
          settleTimer = null
        }
      }

      /** La fuente volvió a estar viva: fin de la degradación + puesta al día. */
      const markAlive = () => {
        clearTimers()
        failures = 0
        if (!down.delete(source.label)) return
        publishHealth()
        // Mientras estuvo muerta se pudo perder CUALQUIERA de sus avisos (el
        // pubsub del API es en memoria y no reenvía), así que la puesta al día
        // es del paquete completo de temas de la fuente, igual que al
        // reconectar el socket.
        engine.trigger(source.topics, true)
      }

      /** Esta apertura murió (rechazo o cierre): se reabre con espera. */
      const onDead = (err: unknown) => {
        if (disposed) return
        clearTimers()
        subscription = null
        failures += 1
        const retryInMs = resubscribeDelayMs(failures)
        down.add(source.label)
        publishHealth()
        reportSourceError(source, err, failures, retryInMs)
        // Cadena de temporizadores de UNA vez (el siguiente lo arma el
        // siguiente fallo): nada repetitivo, y reabrir una suscripción no
        // consulta datos — no es un latido disfrazado.
        retryTimer = setTimeout(() => {
          retryTimer = null
          open(true)
        }, retryInMs)
      }

      function open(isRetry: boolean): void {
        // OJO (Apollo 4): un rechazo de la operación NO llega por el callback
        // `error` — `startGraphQLSubscription` lo convierte en un resultado
        // con `error` y acto seguido COMPLETA el observable. Y una suscripción
        // completada está tan muerta como una que falló: no vuelven a llegar
        // avisos. Por eso los tres caminos terminan en `onDead`, y `ended`
        // evita contar dos veces el par resultado-con-error + complete.
        let ended = false
        const end = (err: unknown) => {
          if (ended) return
          ended = true
          onDead(err)
        }
        subscription = client
          .subscribe({
            query: source.query,
            variables: { slug },
            // Los eventos no se guardan: son avisos, no datos. Así tampoco
            // ensucian el cache (ni lo que se evalúa para persistir).
            fetchPolicy: 'no-cache',
          })
          .subscribe({
            next: (result) => {
              if (result.error) {
                end(result.error)
                return
              }
              // Un aviso recibido prueba que la fuente revivió; su puesta al
              // día cubre los temas de este evento y los que se perdieron.
              if (down.has(source.label)) {
                markAlive()
                return
              }
              const topics = source.topicsOf(result.data)
              if (topics.length === 0) return
              engine.trigger(topics)
            },
            error: end,
            complete: () => {
              end(new Error(`la suscripción ${source.label} se cerró sin error`))
            },
          })
        if (isRetry) {
          settleTimer = setTimeout(() => {
            settleTimer = null
            markAlive()
          }, RESUBSCRIBE_SETTLE_MS)
        }
      }

      open(false)
      return () => {
        clearTimers()
        subscription?.unsubscribe()
        subscription = null
      }
    }

    const closers = EVENT_SOURCES.map(superviseSource)
    return () => {
      disposed = true
      for (const close of closers) close()
      down.clear()
    }
  }, [client, locationSlug, engine])

  // Puesta al día al reconectar: UNA vez por reconexión, nunca en la primera
  // conexión (esa no se perdió nada).
  useEffect(() => {
    let seenConnections = getWsStatus().connections
    return subscribeWsStatus((next) => {
      setWsConnection(toConnection(next.status))
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
