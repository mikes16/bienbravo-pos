import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MockedProvider, type MockedProviderProps } from '@apollo/client/testing/react'
import { RepositoryProvider } from '@/core/repositories/RepositoryProvider.tsx'
import { PosAuthProvider } from '@/core/auth/PosAuthProvider.tsx'
import { LocationProvider } from '@/core/location/LocationProvider.tsx'
import { ToastProvider } from '@/core/toast/ToastProvider.tsx'
import { createMockRepositories } from '@/test/mocks/repositories.ts'
import type { Repositories } from '@/core/repositories/registry.ts'

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  repos?: Repositories
  initialRoute?: string
  apolloMocks?: MockedProviderProps['mocks']
}

export function renderWithProviders(
  ui: ReactElement,
  { repos = createMockRepositories(), initialRoute = '/', apolloMocks = [], ...renderOptions }: CustomRenderOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MockedProvider mocks={apolloMocks}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <RepositoryProvider value={repos}>
            <LocationProvider>
              <PosAuthProvider>
                <ToastProvider>
                  {children}
                </ToastProvider>
              </PosAuthProvider>
            </LocationProvider>
          </RepositoryProvider>
        </MemoryRouter>
      </MockedProvider>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}
