import { useEffect } from 'react'
import { render, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApolloClient, ApolloLink, InMemoryCache, Observable } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { BootstrapProvider, useCatalogVersionCheck } from './BootstrapProvider'
import {
  FreshnessContext,
  FRESHNESS_TOPICS,
  createFreshnessEngine,
  type FreshnessContextValue,
  type FreshnessEngine,
  type FreshnessTopic,
} from '@/core/freshness/FreshnessProvider'
import { useLiveRefresh } from '@/core/freshness/useLiveRefresh'
import { CATALOG_EVICTION_FIELDS, rootFieldName } from '@/core/apollo/dataClasses'

// La sucursal y la sesión vienen de contexto; aquí sólo importa que haya una
// sucursal estable y sesión abierta (el gate no corre sin ninguna de las dos).
vi.mock('@/core/location/useLocation', () => ({
  useLocation: () => ({
    locationId: 'loc1',
    locationName: 'Centro',
    locationSlug: 'centro',
    locationTimezone: 'America/Monterrey',
    setLocationId: () => {},
  }),
}))
vi.mock('@/core/auth/usePosAuth', () => ({
  usePosAuth: () => ({ isAuthenticated: true }),
}))

const VERSION_KEY = 'bb-pos-catalog-version'
/** Marca reconocible del catálogo viejo dentro del store serializado. */
const SEED = 'PRECIO-VIEJO'

interface FakeServer {
  version: string
  fails: boolean
  /** Consultas de red (PosCatalogVersion) que salieron de verdad. */
  calls: number
}

function createServerLink(server: FakeServer): ApolloLink {
  return new ApolloLink(
    () =>
      new Observable<ApolloLink.Result>((observer) => {
        server.calls += 1
        if (server.fails) {
          observer.error(new Error('sin red'))
          return
        }
        observer.next({ data: { catalogVersion: server.version } })
        observer.complete()
      }),
  )
}

/**
 * Store de catálogo generado DESDE la lista fuente de la evicción: si mañana
 * `CATALOG_EVICTION_FIELDS` crece, el caso cubre el campo nuevo sin tocar este
 * test. Incluye los singulares `service`/`catalogCombo` del precio por línea,
 * que se sirven cache-first al cobrar.
 */
function seedCatalog(cache: InMemoryCache): void {
  const rootQuery: Record<string, string> = { __typename: 'Query' }
  for (const field of CATALOG_EVICTION_FIELDS) {
    rootQuery[`${field}({"locationId":"loc1"})`] = `${SEED}-${field}`
  }
  cache.restore({ ROOT_QUERY: rootQuery })
}

/** Campos de catálogo que siguen en el store (con o sin argumentos pegados). */
function catalogFieldsLeft(cache: InMemoryCache): string[] {
  const root = cache.extract().ROOT_QUERY ?? {}
  return Object.keys(root).filter((key) => CATALOG_EVICTION_FIELDS.includes(rootFieldName(key)))
}

function Probe({ load, topics }: { load: () => void; topics: readonly FreshnessTopic[] }) {
  useLiveRefresh(load, topics)
  return null
}

/** Pantalla que revisa la versión al montar, como hace "Nueva venta". */
function ScreenThatChecks({ onCheck }: { onCheck: (fn: () => Promise<void>) => void }) {
  const checkCatalogVersion = useCatalogVersionCheck()
  useEffect(() => {
    onCheck(checkCatalogVersion)
    void checkCatalogVersion()
  }, [checkCatalogVersion, onCheck])
  return null
}

const engines: FreshnessEngine[] = []

function setup(options: { stored: string | null; version: string; fails?: boolean }) {
  const server: FakeServer = { version: options.version, fails: options.fails ?? false, calls: 0 }
  const cache = new InMemoryCache()
  seedCatalog(cache)
  const client = new ApolloClient({ link: createServerLink(server), cache })
  if (options.stored !== null) window.localStorage.setItem(VERSION_KEY, options.stored)

  // Motor REAL del canal (ventana de 5 s, pausa del cobro, `force`): así el
  // caso del ciclo se prueba contra la mecánica de verdad, no contra un stub.
  const engine = createFreshnessEngine(() => {})
  engines.push(engine)
  const channel: FreshnessContextValue = {
    connection: 'connected',
    lastUpdatedAt: null,
    refreshAll: () => engine.trigger(FRESHNESS_TOPICS, true),
    setPaused: (paused) => engine.setPaused(paused),
    register: (load, topics) => engine.register(load, topics),
  }

  const loaders = { catalog: vi.fn(), sales: vi.fn() }
  render(
    <ApolloProvider client={client}>
      <FreshnessContext.Provider value={channel}>
        <BootstrapProvider>
          <Probe load={loaders.catalog} topics={['catalog']} />
          <Probe load={loaders.sales} topics={['sales']} />
        </BootstrapProvider>
      </FreshnessContext.Provider>
    </ApolloProvider>,
  )

  return {
    server,
    cache,
    loaders,
    channel,
    announce: async (topic: FreshnessTopic) => {
      await act(async () => {
        engine.trigger([topic])
      })
      await settle()
    },
  }
}

/** Deja correr el callback de idle del arranque y la promesa de la consulta. */
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

describe('BootstrapProvider · versión de catálogo', () => {
  beforeEach(() => {
    window.localStorage.clear()
    // jsdom no trae requestIdleCallback: lo emulamos como una tarea normal
    // para poder esperar la revisión del arranque.
    window.requestIdleCallback = ((cb: IdleRequestCallback) =>
      window.setTimeout(
        () => cb({ didTimeout: false, timeRemaining: () => 0 }),
        0,
      )) as typeof window.requestIdleCallback
    window.cancelIdleCallback = ((id: number) =>
      window.clearTimeout(id)) as typeof window.cancelIdleCallback
  })

  afterEach(() => {
    for (const engine of engines.splice(0)) engine.dispose()
    vi.restoreAllMocks()
  })

  it('versión distinta: evicta el catálogo (con service/catalogCombo) y avisa al canal UNA vez', async () => {
    const { server, cache, loaders } = setup({ stored: 'v1', version: 'v2' })
    await settle()

    expect(catalogFieldsLeft(cache)).toEqual([])
    // Los singulares del precio por línea entran en la MISMA evicción que los
    // plurales: un par (servicio/combo, barbero) ya resuelto cache-first no
    // puede seguir comiteando el precio viejo tras el cambio de versión.
    const rootKeys = Object.keys(cache.extract().ROOT_QUERY ?? {})
    expect(rootKeys.map(rootFieldName)).not.toContain('service')
    expect(rootKeys.map(rootFieldName)).not.toContain('catalogCombo')
    // Aserción por contenido, no por llaves: ningún precio viejo sobrevive.
    expect(JSON.stringify(cache.extract())).not.toContain(SEED)
    expect(window.localStorage.getItem(VERSION_KEY)).toBe('v2')
    // (3) Las pantallas montadas reciben el aviso para volver a pedir dato.
    expect(loaders.catalog).toHaveBeenCalledTimes(1)
    // El canal sólo expone `refreshAll()` (no hay disparo por tema público),
    // así que el aviso barre todos los temas — como un `focus` de la pestaña.
    expect(loaders.sales).toHaveBeenCalledTimes(1)
    // Una sola consulta: el aviso que emitimos no volvió a entrar a revisar.
    expect(server.calls).toBe(1)
  })

  it('misma versión: no evicta nada ni mueve a las pantallas', async () => {
    const { server, cache, loaders } = setup({ stored: 'v1', version: 'v1' })
    await settle()

    expect(catalogFieldsLeft(cache)).toHaveLength(CATALOG_EVICTION_FIELDS.length)
    expect(JSON.stringify(cache.extract())).toContain(SEED)
    expect(loaders.catalog).not.toHaveBeenCalled()
    expect(loaders.sales).not.toHaveBeenCalled()
    expect(server.calls).toBe(1)
  })

  // `catalogCalls` = 2 para el tema 'catalog' porque el propio aviso ya llega a
  // los cargadores de ese tema y el gate suma el suyo tras evictar; para
  // 'settings' sólo cuenta el del gate.
  it.each([
    ['catalog', 2],
    ['settings', 1],
  ] as const)(
    'un aviso de "%s" dispara la revisión (sin esperar a que la pestaña pierda el foco)',
    async (topic, catalogCalls) => {
      const { server, cache, loaders, announce } = setup({ stored: 'v1', version: 'v1' })
      await settle()
      expect(server.calls).toBe(1)

      // El admin publica un cambio de precio y el API avisa por el canal.
      server.version = 'v3'
      await announce(topic)

      expect(server.calls).toBe(2)
      expect(catalogFieldsLeft(cache)).toEqual([])
      expect(window.localStorage.getItem(VERSION_KEY)).toBe('v3')
      expect(loaders.catalog).toHaveBeenCalledTimes(catalogCalls)
    },
  )

  it('el refresco que emite el propio gate no vuelve a revisar: sin ciclo', async () => {
    // `refreshAll()` es lo que llega al desbloquear con PIN y al reconectar el
    // socket (los dos disparan TODOS los temas).
    const { server, cache, loaders, channel } = setup({ stored: 'v1', version: 'v1' })
    await settle()

    server.version = 'v4'
    await act(async () => {
      channel.refreshAll()
    })
    await settle()

    expect(catalogFieldsLeft(cache)).toEqual([])
    // Arranque + desbloqueo. La tercera consulta sería el ciclo (y con el
    // motor real, una recursión infinita).
    expect(server.calls).toBe(2)
    // Una vez por el `refreshAll` del desbloqueo y otra por el aviso del gate.
    expect(loaders.catalog).toHaveBeenCalledTimes(2)
  })

  it('fallo de red: no evicta, no avisa y no rompe nada', async () => {
    const { server, cache, loaders } = setup({ stored: 'v1', version: 'v2', fails: true })
    await settle()

    expect(server.calls).toBe(1)
    expect(catalogFieldsLeft(cache)).toHaveLength(CATALOG_EVICTION_FIELDS.length)
    expect(JSON.stringify(cache.extract())).toContain(SEED)
    // La versión persistida no se mueve: seguimos sirviendo el cache de antes.
    expect(window.localStorage.getItem(VERSION_KEY)).toBe('v1')
    expect(loaders.catalog).not.toHaveBeenCalled()
  })

  it('una pantalla revisa la versión al montar y el hook es estable entre renders', async () => {
    const seen: Array<() => Promise<void>> = []
    const server: FakeServer = { version: 'v2', fails: false, calls: 0 }
    const cache = new InMemoryCache()
    seedCatalog(cache)
    const client = new ApolloClient({ link: createServerLink(server), cache })
    window.localStorage.setItem(VERSION_KEY, 'v1')

    const tree = (
      <ApolloProvider client={client}>
        <BootstrapProvider>
          <ScreenThatChecks onCheck={(fn) => seen.push(fn)} />
        </BootstrapProvider>
      </ApolloProvider>
    )
    // Sin canal de frescura arriba (lock screen): el gate no debe lanzar.
    const { rerender } = render(tree)
    await settle()
    rerender(tree)
    await settle()

    expect(catalogFieldsLeft(cache)).toEqual([])
    // Identidad estable ⇒ el efecto de montaje de la pantalla no se repite.
    expect(new Set(seen).size).toBe(1)
  })

  it('la lista de evicción es la compartida e incluye los singulares de precio por línea', () => {
    // Si alguien saca `service`/`catalogCombo` de la lista, los casos de arriba
    // seguirían en verde (el fixture se genera de la misma lista): este guard
    // es el que lo detecta.
    expect(CATALOG_EVICTION_FIELDS).toEqual(expect.arrayContaining(['service', 'catalogCombo']))
  })

  it('sin provider arriba la revisión es un no-op estable (pantalla montada suelta)', async () => {
    const seen: Array<() => Promise<void>> = []
    render(<ScreenThatChecks onCheck={(fn) => seen.push(fn)} />)
    await settle()

    expect(seen).toHaveLength(1)
    await expect(seen[0]()).resolves.toBeUndefined()
  })
})
