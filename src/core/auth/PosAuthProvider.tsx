import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { PosViewer, AuthState } from './auth.types.ts'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'

export interface PosAuthContextValue extends AuthState {
  pinLogin: (email: string, pin4: string) => Promise<void>
  logout: () => Promise<void>
  lock: () => void
  unlock: () => void
}

export const PosAuthContext = createContext<PosAuthContextValue | null>(null)

export function PosAuthProvider({ children }: { children: ReactNode }) {
  const { auth } = useRepositories()
  const [viewer, setViewer] = useState<PosViewer | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    auth
      .getViewer()
      .then((v) => {
        setViewer(v)
        if (!v) setIsLocked(false)
      })
      .catch(() => setViewer(null))
      .finally(() => setLoading(false))
  }, [auth])

  const pinLogin = useCallback(
    async (email: string, pin4: string) => {
      const v = await auth.pinLogin(email, pin4)
      setViewer(v)
      setIsLocked(false)
    },
    [auth],
  )

  const logout = useCallback(async () => {
    try {
      await auth.logout()
    } finally {
      setViewer(null)
      setIsLocked(false)
    }
  }, [auth])

  const lock = useCallback(() => setIsLocked(true), [])
  const unlock = useCallback(() => setIsLocked(false), [])

  return (
    <PosAuthContext.Provider
      value={{
        viewer,
        isAuthenticated: viewer !== null,
        isLocked,
        loading,
        pinLogin,
        logout,
        lock,
        unlock,
      }}
    >
      {children}
    </PosAuthContext.Provider>
  )
}
