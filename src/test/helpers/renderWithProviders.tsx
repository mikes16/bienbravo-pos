import type { ReactElement, ReactNode } from 'react'
import { act, render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MockedProvider, type MockedProviderProps } from '@apollo/client/testing/react'
import { RepositoryProvider } from '@/core/repositories/RepositoryProvider.tsx'
import { PosAuthProvider } from '@/core/auth/PosAuthProvider.tsx'
import { LocationProvider } from '@/core/location/LocationProvider.tsx'
import { ToastProvider } from '@/core/toast/ToastProvider.tsx'
import { ToastViewport } from '@/core/toast/ToastViewport.tsx'
import {
  FreshnessContext,
  type FreshnessContextValue,
  type FreshnessLoader,
  type FreshnessTopic,
} from '@/core/freshness/FreshnessProvider.tsx'
import { createMockRepositories } from '@/test/mocks/repositories.ts'
import type { Repositories } from '@/core/repositories/registry.ts'

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  repos?: Repositories
  initialRoute?: string
  apolloMocks?: MockedProviderProps['mocks']
}

interface Registration {
  load: FreshnessLoader
  topics: readonly FreshnessTopic[]
}

/**
 * Canal de frescura de mentira. Una pantalla migrada al canal usa
 * `useLiveRefresh`, que lanza si no hay contexto arriba; montar el
 * `FreshnessProvider` real abriría 3 suscripciones contra `MockedProvider`,
 * así que aquí va un stub: el test hace de servidor con `announce(tema)`.
 *
 * El valor se crea UNA vez por render (identidad estable): si cambiara en cada
 * render, el `register()` de cada pantalla se re-ejecutaría en bucle.
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
  /** Avisa del tema y espera a que las cargas registradas terminen. */
  async function announce(topic: FreshnessTopic) {
    await act(async () => {
      await Promise.allSettled(
        [...registrations].filter((r) => r.topics.includes(topic)).map((r) => r.load()),
      )
    })
  }
  return { value, announce }
}

export function renderWithProviders(
  ui: ReactElement,
  { repos = createMockRepositories(), initialRoute = '/', apolloMocks = [], ...renderOptions }: CustomRenderOptions = {},
) {
  const freshness = createFreshnessStub()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MockedProvider mocks={apolloMocks}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <RepositoryProvider value={repos}>
            <LocationProvider>
              <PosAuthProvider>
                <ToastProvider>
                  {/* Un test que necesite otro estado del canal (sin conexión,
                      espiar refreshAll) monta SU propio provider alrededor del
                      `ui`: por anidamiento gana sobre este stub. */}
                  <FreshnessContext.Provider value={freshness.value}>
                    {children}
                  </FreshnessContext.Provider>
                  {/* Igual que el shell real (PosShell): el viewport acompaña
                      al provider para que los toasts se rendericen en tests. */}
                  <ToastViewport />
                </ToastProvider>
              </PosAuthProvider>
            </LocationProvider>
          </RepositoryProvider>
        </MemoryRouter>
      </MockedProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    /** Dispara los cargadores registrados en ese tema, dentro de `act`. */
    announce: freshness.announce,
  }
}
