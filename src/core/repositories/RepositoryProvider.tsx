import { createContext, useContext, type ReactNode } from 'react'
import type { Repositories } from './registry.ts'

const RepositoryContext = createContext<Repositories | null>(null)

export function RepositoryProvider({
  value,
  children,
}: {
  value: Repositories
  children: ReactNode
}) {
  return (
    <RepositoryContext.Provider value={value}>
      {children}
    </RepositoryContext.Provider>
  )
}

export function useRepositories(): Repositories {
  const ctx = useContext(RepositoryContext)
  if (!ctx) throw new Error('useRepositories must be used within RepositoryProvider')
  return ctx
}
