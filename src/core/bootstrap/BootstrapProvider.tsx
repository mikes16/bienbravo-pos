import { useEffect, useRef, type ReactNode } from 'react'
import { useApolloClient } from '@apollo/client/react'
import type { ApolloClient } from '@apollo/client'
import { useLocation } from '@/core/location/useLocation'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { POS_CATALOG_VERSION } from './catalogVersion.queries'

const CATALOG_VERSION_KEY = 'bb-pos-catalog-version'

/**
 * Campos root del catálogo STATIC que el checkout lee con cache-first. Cuando
 * la versión del catálogo cambia, los evictamos para que la próxima lectura
 * refetchee UNA sola vez. `posInventoryLevels` (stock) NO está aquí: es LIVE
 * y se fuerza por separado al entrar a checkout.
 */
const STATIC_QUERY_FIELDS = [
  'barbers',
  'services',
  'products',
  'catalogCombos',
  'catalogCategories',
] as const

/**
 * El "gate" de datos estáticos. No fetchea el catálogo: solo consulta un hash
 * barato (`catalogVersion`) y, si difiere del persistido, evicta el catálogo
 * cacheado para que se refetchee una vez. Mientras el hash coincida, las
 * pantallas estáticas se sirven 100% del cache Apollo persistido — cero red en
 * el critical path. Corre al autenticarse y en cada `visibilitychange`, que es
 * cuando el admin pudo haber publicado un cambio.
 *
 * Es un provider transparente (renderiza children tal cual): toda su lógica es
 * un efecto best-effort. Si el poll falla, seguimos sirviendo del cache.
 */
export function BootstrapProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient()
  const { locationId } = useLocation()
  const { isAuthenticated } = usePosAuth()
  const checkingRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || !locationId) return

    const checkVersion = async () => {
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
        if (stored !== remote) {
          evictStaticCatalog(client)
          persistVersion(remote)
        }
      } catch {
        /* gate best-effort: si falla, seguimos con el cache persistido */
      } finally {
        checkingRef.current = false
      }
    }

    // El primer poll se difiere a idle: el gate no es urgente y no debe
    // competir con el burst de carga inicial (Hoy/MyDay/checkout). Va por su
    // propio HttpLink (ver client.ts), así que tampoco comparte POST con ellas.
    let idleId: number | undefined
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => void checkVersion(), { timeout: 3000 })
    } else {
      idleId = window.setTimeout(() => void checkVersion(), 1500)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkVersion()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (idleId !== undefined) {
        if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId)
        else window.clearTimeout(idleId)
      }
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [client, locationId, isAuthenticated])

  return <>{children}</>
}

function persistVersion(version: string): void {
  try {
    window.localStorage.setItem(CATALOG_VERSION_KEY, version)
  } catch {
    /* best-effort */
  }
}

function evictStaticCatalog(client: ApolloClient): void {
  for (const fieldName of STATIC_QUERY_FIELDS) {
    client.cache.evict({ id: 'ROOT_QUERY', fieldName })
  }
  client.cache.gc()
}
