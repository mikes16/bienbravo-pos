import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client'
import { BatchHttpLink } from '@apollo/client/link/batch-http'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { getMainDefinition } from '@apollo/client/utilities'
import { createClient } from 'graphql-ws'

// Bump cuando el shape del schema cambie de forma que el cache persistido
// pueda quedar inconsistente (campos requeridos nuevos, enums renombrados,
// type policies modificadas). El cliente compara contra lo guardado en
// localStorage y purga si difieren — evita renders con fields faltantes.
const SCHEMA_VERSION = '2026-06-04-v1'

const STORAGE_KEY = 'bb-pos-apollo-cache'
const STORAGE_VERSION_KEY = 'bb-pos-apollo-cache-version'

// 1.5MB cap antes de tirar el cache. localStorage es síncrono — si crece
// mucho el reload se pone lento. Hoy un POS típico tiene <500KB de cache
// (servicios + productos + barberos + walkins recientes). Si algún día
// se acerca al cap, monitoreamos y subimos o movemos a IndexedDB.
const MAX_CACHE_SIZE_BYTES = 1_500_000

function makeCache(): InMemoryCache {
  return new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // keyArgs ensure separate cache buckets per filter/search,
          // while repeated identical requests hit a single entry.
          appointments: { keyArgs: ['filter', 'locationId', 'status'] },
          customers: { keyArgs: ['search'] },
          products: { keyArgs: ['filter', 'categoryId'] },
          services: { keyArgs: ['filter', 'categoryId'] },
          catalogCategories: { keyArgs: ['appliesTo'] },
          catalogCombos: { keyArgs: ['activeOnly'] },
          stockLevels: { keyArgs: ['locationId'] },
        },
      },
    },
  })
}

/**
 * Persistencia inline del InMemoryCache a localStorage. Decisión: NO usar
 * apollo3-cache-persist porque su peer dep está pegada a Apollo 3.x.
 *
 * Patrón:
 *   - Al boot: restaurar desde localStorage si la versión persistida coincide
 *     con SCHEMA_VERSION (evita drift después de deploys del API)
 *   - Polling cada 2s: si cache.extract() cambió desde la última escritura,
 *     persistimos. Más simple y robusto que monkey-patchear broadcastWatches.
 *   - pagehide: flush sincrónico al cerrar la pestaña para no perder los
 *     últimos updates del usuario.
 *   - Cap a 1.5MB; si excede, descartamos el cache stored (el session en
 *     memoria sigue vivo). Próximo boot empieza limpio.
 */
function attachCachePersistence(cache: InMemoryCache): { purge: () => void } {
  const purge = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
      window.localStorage.removeItem(STORAGE_VERSION_KEY)
    } catch {
      /* ignore quota / private mode */
    }
  }

  // Restore al boot — solo si la versión coincide.
  try {
    const persistedVersion = window.localStorage.getItem(STORAGE_VERSION_KEY)
    if (persistedVersion === SCHEMA_VERSION) {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        cache.restore(JSON.parse(raw))
      }
    } else if (persistedVersion !== null) {
      // Versión vieja → purga el cache stale.
      purge()
    }
  } catch {
    // JSON.parse fail o quota → purga y sigue limpio.
    purge()
  }

  // Polling cada 2s: si snapshot cambió desde la última escritura, persiste.
  // Comparación por string serializada es cheap (<1ms para caches normales)
  // y evita falsos positivos por mutaciones internas que no cambian datos.
  let lastSerialized = ''
  const PERSIST_INTERVAL_MS = 2000

  const persistOnce = (): void => {
    try {
      const snapshot = JSON.stringify(cache.extract())
      if (snapshot === lastSerialized) return
      if (snapshot.length > MAX_CACHE_SIZE_BYTES) {
        purge()
        return
      }
      window.localStorage.setItem(STORAGE_KEY, snapshot)
      window.localStorage.setItem(STORAGE_VERSION_KEY, SCHEMA_VERSION)
      lastSerialized = snapshot
    } catch {
      // QuotaExceeded o similar → purga para que el próximo boot empiece
      // limpio en vez de cargar parcialmente.
      purge()
    }
  }

  window.setInterval(persistOnce, PERSIST_INTERVAL_MS)
  // pagehide es lo más confiable para "tab cerrando" — se dispara también
  // en bfcache navigations en mobile, donde unload puede no correr.
  window.addEventListener('pagehide', persistOnce)

  return { purge }
}

/**
 * Singleton del cache persistor, expuesto para que PosAuthProvider pueda
 * purgar al logout sin necesidad de pasar referencias por context.
 */
let cachePersistor: { purge: () => void } | null = null

export function purgePersistedCache(): void {
  cachePersistor?.purge()
}

export function createPosApolloClient(): ApolloClient {
  const uri = (import.meta.env.VITE_API_URL ?? '') + '/graphql'
  // WS endpoint = mismo path /graphql con esquema ws/wss según origen.
  const wsUri = uri.replace(/^http/, 'ws')

  const cache = makeCache()
  cachePersistor = attachCachePersistence(cache)

  // BatchHttpLink coalesce queries paralelas (Promise.all, render burst) en
  // 1 solo POST con un array de operations. batchInterval bajo (20ms) para
  // que no agregue latencia perceptible. batchMax 10 para evitar payloads
  // monstruosos en el rare caso de un burst grande.
  const batchHttpLink = new BatchHttpLink({
    uri,
    credentials: 'include',
    headers: { 'x-bb-client': 'pos' },
    batchInterval: 20,
    batchMax: 10,
  })

  // El gate de catálogo (PosCatalogVersion) NO debe viajar en el mismo POST que
  // las queries críticas. Apollo Server no devuelve la respuesta del batch hasta
  // que TODOS sus resolvers terminan; como catalogVersion hace trabajo de
  // catálogo, batcheado retendría la respuesta de Hoy/MyDay/checkout y las
  // dejaría colgadas en skeleton. Va por un HttpLink simple (su propio POST),
  // fuera del critical path.
  const singleHttpLink = new HttpLink({
    uri,
    credentials: 'include',
    headers: { 'x-bb-client': 'pos' },
  })

  const httpLink = split(
    (operation) => operation.operationName === 'PosCatalogVersion',
    singleHttpLink,
    batchHttpLink,
  )

  // WebSocket link para subscriptions. Reconnect automático infinito —
  // el POS de sucursal nunca debe quedar sin push silente. keepAlive 12s
  // detecta zombies antes de que el browser lo note.
  // Auth: las cookies bb_session_pos viajan en el WS upgrade request si el
  // server tiene CORS con credentials:true (ya configurado en api/main.ts).
  // Sin esto el handshake se haría unauthed, pero como la única subscription
  // hoy (walkInQueueUpdated) es pública, funciona igual.
  const wsLink = new GraphQLWsLink(
    createClient({
      url: wsUri,
      retryAttempts: Infinity,
      shouldRetry: () => true,
      keepAlive: 12_000,
      connectionAckWaitTimeout: 8_000,
    }),
  )

  // Split: subscriptions van por WS, queries/mutations por HTTP batch.
  const link = split(
    ({ query }) => {
      const def = getMainDefinition(query)
      return def.kind === 'OperationDefinition' && def.operation === 'subscription'
    },
    wsLink,
    httpLink,
  )

  return new ApolloClient({
    link,
    cache,
    assumeImmutableResults: true,
    defaultOptions: {
      // cache-first (no cache-and-network) como default: en datos STATIC no
      // queremos revalidación de red en cada mount. Los repos ya usan
      // client.query() con políticas explícitas; las lecturas LIVE (sesión de
      // caja, stock, búsqueda de clientes, prepay) llevan su 'network-only'
      // explícito y no se ven afectadas. Esto cierra el leak para cualquier
      // useQuery/watchQuery futuro que herede el default.
      watchQuery: { fetchPolicy: 'cache-first', nextFetchPolicy: 'cache-first' },
      query: { fetchPolicy: 'cache-first' },
    },
  })
}
