import { useMemo, type ReactNode } from 'react'
import { ApolloProvider } from '@apollo/client/react'
import { createPosApolloClient } from '@/core/apollo/client.ts'
import { RepositoryProvider } from '@/core/repositories/RepositoryProvider.tsx'
import { createRepositories } from '@/core/repositories/registry.ts'
import { PosAuthProvider } from '@/core/auth/PosAuthProvider.tsx'
import { LocationProvider } from '@/core/location/LocationProvider.tsx'
import { ToastProvider } from '@/core/toast/ToastProvider.tsx'
import { BootstrapProvider } from '@/core/bootstrap/BootstrapProvider.tsx'

export function Providers({ children }: { children: ReactNode }) {
  const client = useMemo(() => createPosApolloClient(), [])
  const repos = useMemo(() => createRepositories(client), [client])

  return (
    <ApolloProvider client={client}>
      <RepositoryProvider value={repos}>
        <LocationProvider>
          <PosAuthProvider>
            <BootstrapProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </BootstrapProvider>
          </PosAuthProvider>
        </LocationProvider>
      </RepositoryProvider>
    </ApolloProvider>
  )
}
