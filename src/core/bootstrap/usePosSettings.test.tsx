import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { MockedProvider, type MockedProviderProps } from '@apollo/client/testing/react'
import { ApolloClient } from '@apollo/client'
import { describe, it, expect, vi } from 'vitest'
import { RepositoryProvider } from '@/core/repositories/RepositoryProvider'
import { PosAuthProvider } from '@/core/auth/PosAuthProvider'
import {
  FreshnessContext,
  type FreshnessContextValue,
  type FreshnessLoader,
  type FreshnessTopic,
} from '@/core/freshness/FreshnessProvider'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'
import { POS_SETTINGS } from './posSettings.queries'
import { usePosSettings, sanitizePosSettings, DEFAULT_POS_SETTINGS } from './usePosSettings'

type Mocks = MockedProviderProps['mocks']

/** Sesión de staff viva: el hook no consulta sin ella. */
function authedRepos() {
  class Repo extends InMemoryAuthRepository {
    override async getViewer() {
      return MOCK_VIEWER
    }
  }
  return createMockRepositories({ auth: new Repo() })
}

function settingsMock(idle: number, checkout: number, maxUsageCount = 20) {
  return {
    request: { query: POS_SETTINGS },
    maxUsageCount,
    result: {
      data: {
        posSettings: {
          __typename: 'PosSettings',
          posAutoLockIdleSeconds: idle,
          posAutoLockCheckoutSeconds: checkout,
        },
      },
    },
  }
}

interface Registration {
  load: FreshnessLoader
  topics: readonly FreshnessTopic[]
}

/**
 * Canal de frescura de mentira (identidad estable: si cambiara en cada render
 * el hook se re-registraría en bucle). El test hace de servidor con
 * `announce('settings')`, igual que el stub de renderWithProviders.
 */
function createFreshnessStub() {
  const registrations = new Set<Registration>()
  const value: FreshnessContextValue = {
    connection: 'connected',
    lastUpdatedAt: null,
    refreshAll: () => {},
    setPaused: () => {},
    register: (load, topics) => {
      const entry: Registration = { load, topics }
      registrations.add(entry)
      return () => {
        registrations.delete(entry)
      }
    },
  }
  async function announce(topic: FreshnessTopic) {
    await act(async () => {
      await Promise.allSettled(
        [...registrations].filter((r) => r.topics.includes(topic)).map((r) => r.load()),
      )
    })
  }
  return { value, announce }
}

function renderPosSettings({
  mocks = [],
  authenticated = true,
  withChannel = true,
}: { mocks?: Mocks; authenticated?: boolean; withChannel?: boolean } = {}) {
  const repos = authenticated ? authedRepos() : createMockRepositories()
  const freshness = createFreshnessStub()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      // `delay: 0` explícito: el mock link de Apollo 4 responde con una demora
      // ALEATORIA de 20-50 ms por default, y con eso "todavía cargando" y "ya
      // falló" se confunden (una consulta en vuelo se deduplica con la
      // siguiente y un test de error pasaría por la razón equivocada).
      <MockedProvider mocks={mocks} mockLinkDefaultOptions={{ delay: 0 }}>
        <RepositoryProvider value={repos}>
          <PosAuthProvider>
            {withChannel ? (
              <FreshnessContext.Provider value={freshness.value}>{children}</FreshnessContext.Provider>
            ) : (
              children
            )}
          </PosAuthProvider>
        </RepositoryProvider>
      </MockedProvider>
    )
  }

  return { ...renderHook(() => usePosSettings(), { wrapper: Wrapper }), announce: freshness.announce }
}

/**
 * Deja correr la resolución de la sesión Y la respuesta del mock link, que
 * llega en un `setTimeout(0)`: vaciar sólo microtareas dejaría la consulta en
 * vuelo y un `refetch` se colgaría de ESA petición en lugar de salir de nuevo.
 */
async function settle() {
  // Varias vueltas de macrotarea: la primera resuelve la sesión (y recién ahí
  // sale la consulta, que agenda SU propio timer) y las siguientes dejan
  // llegar la respuesta y el re-render.
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }
}

describe('usePosSettings', () => {
  it('usa los defaults del dueño (15 / 90) mientras la consulta no responde', async () => {
    // `delay` alto: la respuesta no llega dentro del test.
    const { result } = renderPosSettings({
      mocks: [{ ...settingsMock(45, 300), delay: 10_000 }],
    })

    expect(result.current).toEqual({ idleSeconds: 15, checkoutSeconds: 90 })
    await settle()
    expect(result.current).toEqual(DEFAULT_POS_SETTINGS)
  })

  it('toma los valores configurados cuando el API responde', async () => {
    const { result } = renderPosSettings({ mocks: [settingsMock(30, 180)] })

    await waitFor(() => expect(result.current).toEqual({ idleSeconds: 30, checkoutSeconds: 180 }))
  })

  it('un tiempo de inactividad por debajo del mínimo cae al default y no arrastra al otro', async () => {
    const { result } = renderPosSettings({ mocks: [settingsMock(5, 240)] })

    await waitFor(() => expect(result.current).toEqual({ idleSeconds: 15, checkoutSeconds: 240 }))
  })

  it('un tiempo de cobro por encima del máximo cae al default', async () => {
    const { result } = renderPosSettings({ mocks: [settingsMock(45, 9999)] })

    await waitFor(() => expect(result.current).toEqual({ idleSeconds: 45, checkoutSeconds: 90 }))
  })

  it('un tiempo de cobro menor que el de inactividad cae al default', async () => {
    const { result } = renderPosSettings({ mocks: [settingsMock(60, 30)] })

    await waitFor(() => expect(result.current).toEqual({ idleSeconds: 60, checkoutSeconds: 90 }))
  })

  it('un error de red deja los defaults: el bloqueo nunca depende de la red', async () => {
    const { result, announce } = renderPosSettings({
      mocks: [
        { request: { query: POS_SETTINGS }, error: new Error('sin conexión'), maxUsageCount: 1 },
        settingsMock(30, 180, 1),
      ],
    })

    await settle()
    expect(result.current).toEqual(DEFAULT_POS_SETTINGS)

    // El segundo mock sólo se consume si el primero YA se usó: esto prueba que
    // la consulta salió y falló, y que el hook se recupera al siguiente aviso.
    await announce('settings')
    await waitFor(() => expect(result.current).toEqual({ idleSeconds: 30, checkoutSeconds: 180 }))
  })

  it('un aviso del tema settings vuelve a consultar (el admin cambió los tiempos)', async () => {
    const { result, announce } = renderPosSettings({
      mocks: [settingsMock(30, 180, 1), settingsMock(45, 300, 1)],
    })

    await waitFor(() => expect(result.current).toEqual({ idleSeconds: 30, checkoutSeconds: 180 }))

    await announce('settings')

    await waitFor(() => expect(result.current).toEqual({ idleSeconds: 45, checkoutSeconds: 300 }))
  })

  it('un aviso de otro tema no vuelve a consultar', async () => {
    const { result, announce } = renderPosSettings({
      mocks: [settingsMock(30, 180, 1)],
    })

    await waitFor(() => expect(result.current).toEqual({ idleSeconds: 30, checkoutSeconds: 180 }))

    // Si el hook estuviera registrado en 'sales', esto consumiría un mock que
    // no existe y la consulta fallaría.
    await announce('sales')
    await settle()

    expect(result.current).toEqual({ idleSeconds: 30, checkoutSeconds: 180 })
  })

  it('sin sesión no consulta: se queda en los defaults', async () => {
    const { result } = renderPosSettings({ mocks: [settingsMock(45, 300)], authenticated: false })

    await settle()

    expect(result.current).toEqual(DEFAULT_POS_SETTINGS)
  })

  it('arranca cache-first y el aviso del canal sí va a la red (network-only)', async () => {
    const querySpy = vi.spyOn(ApolloClient.prototype, 'query')
    try {
      const { announce } = renderPosSettings({
        mocks: [settingsMock(30, 180, 1), settingsMock(45, 300, 1)],
      })
      await settle()

      const policies = () =>
        querySpy.mock.calls
          .filter((call) => call[0].query === POS_SETTINGS)
          .map((call) => call[0].fetchPolicy)

      expect(policies()).toEqual(['cache-first'])

      await announce('settings')

      expect(policies()).toEqual(['cache-first', 'network-only'])
    } finally {
      querySpy.mockRestore()
    }
  })

  it('sin canal de frescura arriba (lock screen) no lanza', async () => {
    const { result } = renderPosSettings({ mocks: [settingsMock(30, 180)], withChannel: false })

    await waitFor(() => expect(result.current).toEqual({ idleSeconds: 30, checkoutSeconds: 180 }))
  })
})

describe('sanitizePosSettings', () => {
  it('acepta los límites exactos de la spec (10 y 600)', () => {
    expect(
      sanitizePosSettings({ posAutoLockIdleSeconds: 10, posAutoLockCheckoutSeconds: 600 }),
    ).toEqual({ idleSeconds: 10, checkoutSeconds: 600 })
  })

  it('rechaza lo que no es entero, lo nulo y lo ausente', () => {
    expect(
      sanitizePosSettings({ posAutoLockIdleSeconds: 15.5, posAutoLockCheckoutSeconds: 90.1 }),
    ).toEqual(DEFAULT_POS_SETTINGS)
    expect(
      sanitizePosSettings({ posAutoLockIdleSeconds: null, posAutoLockCheckoutSeconds: null }),
    ).toEqual(DEFAULT_POS_SETTINGS)
    expect(sanitizePosSettings(undefined)).toEqual(DEFAULT_POS_SETTINGS)
    expect(sanitizePosSettings(null)).toEqual(DEFAULT_POS_SETTINGS)
  })

  it('rechaza 0 y negativos (una tablet que se bloquea sola sin parar)', () => {
    expect(
      sanitizePosSettings({ posAutoLockIdleSeconds: 0, posAutoLockCheckoutSeconds: -1 }),
    ).toEqual(DEFAULT_POS_SETTINGS)
  })

  it('nunca deja el tiempo de cobro por debajo del de inactividad', () => {
    // idle válido y alto + cobro inválido: ni el default alcanza, así que se
    // iguala al general en vez de bloquear antes cobrando que sin hacer nada.
    expect(
      sanitizePosSettings({ posAutoLockIdleSeconds: 120, posAutoLockCheckoutSeconds: 5 }),
    ).toEqual({ idleSeconds: 120, checkoutSeconds: 120 })
  })
})
