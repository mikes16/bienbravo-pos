import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client'
import type { NormalizedCacheObject } from '@apollo/client'
import { BatchHttpLink } from '@apollo/client/link/batch-http'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { getMainDefinition } from '@apollo/client/utilities'
import { createClient } from 'graphql-ws'
import { PERSISTED_ROOT_FIELDS, rootFieldName } from './dataClasses'

/**
 * Identificador del build, inyectado por Vite (`define: { __BUILD_ID__ }` en
 * vite.config.ts). Sustituye a la vieja constante manual que había que acordarse
 * de subir a mano tras cada cambio de schema: si alguien la olvidaba, el POS
 * restauraba datos con forma vieja. Ahora cada deploy trae un id distinto y
 * purga el cache guardado UNA vez. En test (vitest no aplica el `define`) cae a
 * un valor fijo para que los casos sean deterministas.
 */
const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'test'

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
          // keyArgs ensure separate cache buckets per filter/search, while
          // repeated identical requests hit a single entry. Each entry below
          // was verified against schema.graphql's Query field signature AND
          // the actual query documents in src/features/**/data/*.repository.ts
          // — args that don't appear in keyArgs get dropped from the cache
          // key, so a wrong/missing arg here silently collapses unrelated
          // requests (e.g. different sucursales) into one bucket.
          //
          // `appointments(dateFrom: String!, dateTo: String!, locationId: ID,
          // status: AppointmentStatus)` — PosAppointments passes all four.
          // Previously keyed on ['filter','locationId','status']: 'filter'
          // isn't a real arg (no-op) and dateFrom/dateTo were missing, so the
          // IN_SERVICE safety-check query (CajaPage), Hoy's today-range query,
          // and any other date-ranged agenda query collided in one bucket.
          appointments: { keyArgs: ['locationId', 'dateFrom', 'dateTo', 'status'] },
          // `products(locationId: ID)` / `services(locationId: ID)` — PosProducts
          // and PosServices only ever pass locationId (services' $staffUserId
          // is used inside the `pricingFor` subfield, not as an arg to
          // `services` itself). Previously keyed on ['filter','categoryId'] —
          // neither is a real arg on these fields, so locationId was excluded
          // from the key and every sucursal shared one products/services bucket.
          products: { keyArgs: ['locationId'] },
          services: { keyArgs: ['locationId'] },
          catalogCategories: { keyArgs: ['appliesTo'] },
          catalogCombos: { keyArgs: ['activeOnly'] },
          // DEAD entries removed: `stockLevels` and `customers` are not real
          // Query field names — no query in this repo selects them (grepped
          // src/features/**/data/*.ts). The fields the POS actually reads are:
          //   - `posInventoryLevels(locationId: ID!, limit: Int)` — PosInventoryLevels
          //     passes locationId only.
          //   - `searchCustomers(query: String!, limit: Int)` — PosSearchCustomers,
          //     the typeahead lookup (always fetched network-only, but an explicit
          //     entry keeps the bucket scoped to the search text, not `limit`).
          posInventoryLevels: { keyArgs: ['locationId'] },
          searchCustomers: { keyArgs: ['query'] },
        },
      },
    },
  })
}

/**
 * Filtra un snapshot de `cache.extract()` dejando SOLO lo que puede vivir en el
 * dispositivo. Función pura (sin `window`, sin cache): es el corazón testeable
 * de la garantía "el dinero nunca se guarda".
 *
 * Criterio — LISTA DE PERMITIDOS, no de excluidos:
 *   1. De `ROOT_QUERY` se conservan únicamente las llaves cuyo nombre de campo
 *      está en PERSISTED_ROOT_FIELDS (catálogo + sesión). Un campo raíz nuevo
 *      que nadie clasificó NO se persiste: olvidarse de clasificar falla hacia
 *      el lado seguro.
 *   2. Se arrastran las entidades alcanzables desde esas llaves siguiendo
 *      `__ref` de forma recursiva (Service → CatalogCategory → …).
 *   3. Todo lo demás se descarta: ROOT_MUTATION, ROOT_SUBSCRIPTION, `__META`,
 *      y cualquier entidad huérfana (Sale, Customer, Register…) que solo era
 *      alcanzable desde un campo de dinero.
 */
export function pickPersistable(snapshot: NormalizedCacheObject): NormalizedCacheObject {
  const out: NormalizedCacheObject = {}
  const rootQuery = snapshot.ROOT_QUERY
  if (!rootQuery || typeof rootQuery !== 'object') return out

  const keptRoot: Record<string, unknown> = {}
  for (const [storeFieldName, value] of Object.entries(rootQuery)) {
    if (storeFieldName === '__typename') {
      keptRoot.__typename = value
      continue
    }
    if (!PERSISTED_ROOT_FIELDS.has(rootFieldName(storeFieldName))) continue
    keptRoot[storeFieldName] = value
  }
  out.ROOT_QUERY = keptRoot as NormalizedCacheObject[string]

  // Alcance transitivo por __ref. Una entidad solo sobrevive si algún campo
  // permitido la referencia (directa o indirectamente).
  const pending: string[] = []
  collectRefs(keptRoot, pending)
  const seen = new Set<string>(['ROOT_QUERY'])
  while (pending.length > 0) {
    const id = pending.pop() as string
    if (seen.has(id)) continue
    seen.add(id)
    const entity = snapshot[id]
    if (!entity) continue
    out[id] = entity
    collectRefs(entity, pending)
  }

  return out
}

/** Recorre cualquier valor del store y acumula los ids de las `Reference`. */
function collectRefs(value: unknown, into: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, into)
    return
  }
  if (value === null || typeof value !== 'object') return
  const ref = (value as { __ref?: unknown }).__ref
  if (typeof ref === 'string') {
    into.push(ref)
    return
  }
  for (const nested of Object.values(value)) collectRefs(nested, into)
}

/**
 * Persistencia inline del InMemoryCache a localStorage. Decisión: NO usar
 * apollo3-cache-persist porque su peer dep está pegada a Apollo 3.x.
 *
 * Patrón:
 *   - Al boot: restaurar desde localStorage si el build id persistido coincide
 *     con el actual (cada deploy purga una vez), y pasando lo guardado por
 *     pickPersistable — un cache viejo escrito por la versión anterior (que
 *     guardaba TODO) se descarta en el mismo paso.
 *   - Polling cada 2s: si el snapshot FILTRADO cambió desde la última
 *     escritura, persistimos. Más simple y robusto que monkey-patchear
 *     broadcastWatches, y como filtramos antes de comparar, el churn de
 *     ventas/caja ya no dispara escrituras.
 *   - pagehide: flush sincrónico al cerrar la pestaña para no perder los
 *     últimos updates del usuario.
 *   - Cap a 1.5MB; si excede, descartamos el cache stored (el session en
 *     memoria sigue vivo). Próximo boot empieza limpio.
 */
export function attachCachePersistence(cache: InMemoryCache): {
  purge: () => void
  flush: () => void
  stop: () => void
} {
  const purge = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
      window.localStorage.removeItem(STORAGE_VERSION_KEY)
    } catch {
      /* ignore quota / private mode */
    }
  }

  // Restore al boot — solo si el build id coincide. El filtro se aplica también
  // aquí (no solo al escribir): así un cache escrito por la versión anterior —o
  // por alguien que editó localStorage a mano— no puede reinyectar dinero ni
  // datos de clientes en la memoria de la app.
  try {
    const persistedVersion = window.localStorage.getItem(STORAGE_VERSION_KEY)
    if (persistedVersion === BUILD_ID) {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        cache.restore(pickPersistable(JSON.parse(raw) as NormalizedCacheObject))
      }
    } else if (persistedVersion !== null) {
      // Build anterior → purga el cache stale (migración de una sola vez por
      // deploy; también es lo que borra el cache "guardaba todo" de la versión
      // previa a la lista de permitidos).
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
      // FILTRAR ANTES DE SERIALIZAR: lo que no está en la lista de permitidos
      // nunca llega a tocar localStorage.
      const snapshot = JSON.stringify(pickPersistable(cache.extract()))
      if (snapshot === lastSerialized) return
      if (snapshot.length > MAX_CACHE_SIZE_BYTES) {
        purge()
        return
      }
      window.localStorage.setItem(STORAGE_KEY, snapshot)
      window.localStorage.setItem(STORAGE_VERSION_KEY, BUILD_ID)
      lastSerialized = snapshot
    } catch {
      // QuotaExceeded o similar → purga para que el próximo boot empiece
      // limpio en vez de cargar parcialmente.
      purge()
    }
  }

  const intervalId = window.setInterval(persistOnce, PERSIST_INTERVAL_MS)
  // pagehide es lo más confiable para "tab cerrando" — se dispara también
  // en bfcache navigations en mobile, donde unload puede no correr.
  window.addEventListener('pagehide', persistOnce)

  const stop = (): void => {
    window.clearInterval(intervalId)
    window.removeEventListener('pagehide', persistOnce)
  }

  return { purge, flush: persistOnce, stop }
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
  // HTTP va SAME-ORIGIN a /api/graphql. En prod, vercel.json reescribe esa ruta
  // a la API en Railway; en dev, el proxy de Vite la manda a :3001. ¿Por qué no
  // pegarle directo a Railway? Porque el POS vive en vercel.app y la API en
  // railway.app — sitios distintos, así que la cookie de sesión sería "de
  // terceros" y Safari/iPad (ITP) NO la manda → la sesión no se respeta en
  // tablet. Pasando por el mismo origen, la cookie es first-party del POS y
  // Safari sí la envía.
  const httpUri = '/api/graphql'
  // WS NO se puede proxiar por rewrites de Vercel: conecta directo al origen de
  // la API (VITE_API_URL). La única subscription (walkInQueueUpdated) es pública
  // — no depende de la cookie, así que el handshake cross-site funciona igual.
  const wsUri = ((import.meta.env.VITE_API_URL ?? '') + '/graphql').replace(/^http/, 'ws')

  const cache = makeCache()
  cachePersistor = attachCachePersistence(cache)

  // BatchHttpLink coalesce queries paralelas (Promise.all, render burst) en
  // 1 solo POST con un array de operations. batchInterval bajo (20ms) para
  // que no agregue latencia perceptible. batchMax 10 para evitar payloads
  // monstruosos en el rare caso de un burst grande.
  const batchHttpLink = new BatchHttpLink({
    uri: httpUri,
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
    uri: httpUri,
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
