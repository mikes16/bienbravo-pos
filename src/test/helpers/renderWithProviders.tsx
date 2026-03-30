import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RepositoryProvider } from '@/core/repositories/RepositoryProvider.tsx'
import { PosAuthProvider } from '@/core/auth/PosAuthProvider.tsx'
import { LocationProvider } from '@/core/location/LocationProvider.tsx'
import { ToastProvider } from '@/core/toast/ToastProvider.tsx'
import { createMockRepositories } from '@/test/mocks/repositories.ts'
import type { Repositories } from '@/core/repositories/registry.ts'

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  repos?: Repositories
  initialRoute?: string
}

export function renderWithProviders(
  ui: ReactElement,
  { repos = createMockRepositories(), initialRoute = '/', ...renderOptions }: CustomRenderOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
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
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}
