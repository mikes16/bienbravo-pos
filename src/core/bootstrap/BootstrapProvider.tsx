import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { useApolloClient } from '@apollo/client/react'
import type { ApolloClient } from '@apollo/client'
import { useLocation } from '@/core/location/useLocation'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { CATALOG_EVICTION_FIELDS } from '@/core/apollo/dataClasses'
import { FreshnessContext, type FreshnessTopic } from '@/core/freshness/FreshnessProvider'
import { useLiveRefresh } from '@/core/freshness/useLiveRefresh'
import { POS_CATALOG_VERSION } from './catalogVersion.queries'

const CATALOG_VERSION_KEY = 'bb-pos-catalog-version'

/**
 * Temas del canal cuyo aviso obliga a revisar el hash: el admin publicó
 * catálogo o tocó los ajustes del negocio (spec § 3.4).
 *
 * Con esto quedan cubiertos también los otros dos disparadores que pide la
 * spec sin código extra, porque los tres emiten TODOS los temas: la puesta al
 * día al reconectar el socket y el `refreshAll()` del desbloqueo con PIN (y
 * del botón "Actualizar"). Ninguno es por tiempo — aquí no hay temporizadores
 * periódicos ([D-015]).
 */
const CATALOG_TOPICS: readonly FreshnessTopic[] = ['catalog', 'settings']

export interface CatalogVersionContextValue {
  /**
   * Revisa el hash del catálogo y, si cambió, evicta el catálogo cacheado y
   * pide a las pantallas montadas que recarguen. Best-effort: nunca lanza y
   * nunca bloquea al que la llama (devuelve la promesa para poder esperarla
   * en tests y para que el canal sepa cuándo terminó).
   */
  checkCatalogVersion: () => Promise<void>
}

export const CatalogVersionContext = createContext<CatalogVersionContextValue | null>(null)

/** Sin provider arriba (una pantalla montada suelta) la revisión es un no-op. */
const NO_CHECK = (): Promise<void> => Promise.resolve()

/**
 * La revisión de versión de catálogo, para dispararla por ACCIÓN del usuario:
 * hoy, al entrar a "Nueva venta" (spec § 3.4), que es el momento en que un
 * precio viejo hace daño de verdad.
 *
 * Identidad estable mientras no cambien el cliente Apollo ni la sucursal, así
 * que se puede usar como dependencia de un efecto de montaje sin re-disparar.
 */
export function useCatalogVersionCheck(): () => Promise<void> {
  return useContext(CatalogVersionContext)?.checkCatalogVersion ?? NO_CHECK
}

/**
 * Registro de la revisión en el canal de frescura.
 *
 * Vive en un sub-componente porque `BootstrapProvider` también se monta sin
 * sesión (lock screen), y ahí no hay canal arriba (`FreshnessGate` sólo lo
 * monta autenticado): `useLiveRefresh` lanzaría. Se monta únicamente cuando el
 * contexto existe.
 */
function CatalogVersionListener({ onTopic }: { onTopic: () => void | Promise<void> }) {
  useLiveRefresh(onTopic, CATALOG_TOPICS)
  return null
}

/**
 * El "gate" de datos estáticos. No fetchea el catálogo: solo consulta un hash
 * barato (`catalogVersion`) y, si difiere del persistido, evicta el catálogo
 * cacheado para que se refetchee una vez. Mientras el hash coincida, las
 * pantallas estáticas se sirven 100% del cache Apollo persistido — cero red en
 * el critical path.
 *
 * Cuándo revisa (spec § 3.4). Todo es por EVENTO o por acción del usuario;
 * nada por tiempo:
 * - al autenticarse (una vez, diferido a idle) y en `visibilitychange`;
 * - cuando el canal de frescura avisa de `catalog` / `settings` — que incluye
 *   la reconexión del socket y el `refreshAll()` del PIN, ver `CATALOG_TOPICS`;
 * - al entrar a "Nueva venta" (`useCatalogVersionCheck` en `CheckoutPage`).
 *
 * El defecto que arregla: una terminal de sucursal está SIEMPRE en primer
 * plano, así que `visibilitychange` nunca dispara y un cambio de precio del
 * admin podía no llegar jamás — hasta que el cobro lo rechazaba.
 *
 * Es un provider casi transparente (renderiza children tal cual): su lógica es
 * best-effort. Si la consulta falla, seguimos sirviendo del cache.
 */
export function BootstrapProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient()
  const { locationId } = useLocation()
  const { isAuthenticated } = usePosAuth()
  // El canal sólo existe con sesión y este provider también se monta en el
  // lock screen: leemos el contexto directo (puede ser null) en vez de
  // `useFreshness()`, que lanza cuando no hay provider arriba. `refreshAll`
  // es estable en el provider real, así que sirve como dependencia.
  const freshness = useContext(FreshnessContext)
  const refreshAll = freshness?.refreshAll
  const checkingRef = useRef(false)
  const notifyingRef = useRef(false)

  /**
   * Punto (5) del diagnóstico: evictar sin avisar deja a las pantallas ya
   * montadas pintando el catálogo viejo. Emitimos un refresco por el canal
   * para que los cargadores registrados vuelvan a pedir su dato.
   *
   * Sobre el alcance: `FreshnessContextValue` sólo expone `refreshAll()` (no
   * hay `trigger` por tema público, y `FreshnessProvider` está fuera del
   * alcance de esta tarea), así que el aviso llega a todos los temas. Es el
   * mismo barrido que ya hace un `focus` de la pestaña, ocurre sólo cuando el
   * hash CAMBIÓ de verdad (raro: el admin publica) y respeta la pausa del
   * cobro en vuelo, porque pasa por el motor del canal.
   */
  const notifyCatalogReload = useCallback(() => {
    if (!refreshAll) return
    // Bandera anti-ciclo: este mismo componente está registrado en `catalog`,
    // así que el refresco que acabamos de emitir vuelve a entrar por
    // `onChannelRefresh` en el mismo tick. Con la bandera se ignora.
    notifyingRef.current = true
    try {
      refreshAll()
    } finally {
      notifyingRef.current = false
    }
  }, [refreshAll])

  const checkCatalogVersion = useCallback(async (): Promise<void> => {
    if (!locationId) return
    // Una revisión a la vez: los disparadores son varios y pueden coincidir
    // en el mismo tick (aviso del canal + entrar a cobrar, p. ej.).
    if (checkingRef.current) return
    checkingRef.current = true
    try {
      const result = await client.query({
        query: POS_CATALOG_VERSION,
        variables: { locationId },
        fetchPolicy: 'network-only',
      })
      const remote = result.data?.catalogVersion
      if (!remote) return

      let stored: string | null = null
      try {
        stored = window.localStorage.getItem(CATALOG_VERSION_KEY)
      } catch {
        /* private mode / quota — tratamos como "sin versión" */
      }

      // stored === null cubre el primer arranque en el device (o un cache
      // pre-feature): stored !== remote es true → evictamos para partir de
      // una base limpia y registramos la versión. En boots posteriores sin
      // cambios, stored === remote → no hacemos nada (cero red de catálogo).
      if (stored === remote) return
      evictStaticCatalog(client)
      // La versión se persiste ANTES de avisar: si el aviso volviera a entrar
      // aquí por cualquier vía, ya encuentra `stored === remote` y para. El
      // ciclo no depende sólo de la bandera.
      persistVersion(remote)
      notifyCatalogReload()
    } catch {
      /* gate best-effort: si falla, seguimos con el cache persistido */
    } finally {
      checkingRef.current = false
    }
  }, [client, locationId, notifyCatalogReload])

  /** Lo que se registra en el canal: la revisión, menos nuestro propio aviso. */
  const onChannelRefresh = useCallback((): void | Promise<void> => {
    if (notifyingRef.current) return
    return checkCatalogVersion()
  }, [checkCatalogVersion])

  useEffect(() => {
    if (!isAuthenticated || !locationId) return

    // El primer poll se difiere a idle: el gate no es urgente y no debe
    // competir con el burst de carga inicial (Hoy/MyDay/checkout). Va por su
    // propio HttpLink (ver client.ts), así que tampoco comparte POST con ellas.
    let idleId: number | undefined
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => void checkCatalogVersion(), { timeout: 3000 })
    } else {
      idleId = window.setTimeout(() => void checkCatalogVersion(), 1500)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkCatalogVersion()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (idleId !== undefined) {
        if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId)
        else window.clearTimeout(idleId)
      }
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isAuthenticated, locationId, checkCatalogVersion])

  const value = useMemo<CatalogVersionContextValue>(
    () => ({ checkCatalogVersion }),
    [checkCatalogVersion],
  )

  return (
    <CatalogVersionContext.Provider value={value}>
      {freshness && <CatalogVersionListener onTopic={onChannelRefresh} />}
      {children}
    </CatalogVersionContext.Provider>
  )
}

function persistVersion(version: string): void {
  try {
    window.localStorage.setItem(CATALOG_VERSION_KEY, version)
  } catch {
    /* best-effort */
  }
}

/**
 * Qué se tira cuando cambia la versión: `CATALOG_EVICTION_FIELDS` de
 * `core/apollo/dataClasses.ts`, la única lista de campos del POS ([D-003]) —
 * aquí no vive una copia. Es la clase ESTÁTICO **más** los singulares
 * `service`/`catalogCombo` del precio por línea, que se sirven cache-first al
 * cobrar; la MISMA lista que usa `ApolloCheckoutRepository.evictCatalogCache`
 * al recuperarse de un rechazo, para que las dos vías tiren exactamente lo
 * mismo. Lo demás vivo (stock, `posAvailableBarbers`) no se evicta porque no
 * se sirve de cache de todos modos.
 */
function evictStaticCatalog(client: ApolloClient): void {
  for (const fieldName of CATALOG_EVICTION_FIELDS) {
    client.cache.evict({ id: 'ROOT_QUERY', fieldName })
  }
  client.cache.gc()
}
