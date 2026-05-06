import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { PosViewer, AuthState } from './auth.types.ts'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'

export interface PosAuthContextValue extends AuthState {
  pinLockedUntil: Date | null
  pinLogin: (email: string, pin4: string) => Promise<void>
  logout: () => Promise<void>
  lock: () => void
  unlock: () => void
}

export const PosAuthContext = createContext<PosAuthContextValue | null>(null)

const STORAGE_KEY_LOCKED = 'bb-pos-locked'
const STORAGE_KEY_LAST_BARBER = 'bb-pos-last-barber-id'

function readPersistedLocked(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY_LOCKED) === 'true'
}

function writePersistedLocked(locked: boolean): void {
  if (typeof window === 'undefined') return
  if (locked) window.localStorage.setItem(STORAGE_KEY_LOCKED, 'true')
  else window.localStorage.removeItem(STORAGE_KEY_LOCKED)
}

export function PosAuthProvider({ children }: { children: ReactNode }) {
  const { auth } = useRepositories()
  const [viewer, setViewer] = useState<PosViewer | null>(null)
  const [loading, setLoading] = useState(true)
  // Persisted across reload/server restart so the soft lock holds until the
  // operator types their PIN. If the cookie has since expired, the getViewer
  // effect below clears the flag.
  const [isLocked, setIsLockedState] = useState<boolean>(readPersistedLocked)

  const setIsLocked = useCallback((next: boolean) => {
    setIsLockedState(next)
    writePersistedLocked(next)
  }, [])

  useEffect(() => {
    auth
      .getViewer()
      .then((v) => {
        setViewer(v)
        if (!v) setIsLocked(false)
      })
      .catch(() => setViewer(null))
      .finally(() => setLoading(false))
  }, [auth, setIsLocked])

  const pinLogin = useCallback(
    async (email: string, pin4: string) => {
      const v = await auth.pinLogin(email, pin4)
      setViewer(v)
      setIsLocked(false)
    },
    [auth, setIsLocked],
  )

  const logout = useCallback(async () => {
    try {
      await auth.logout()
    } finally {
      setViewer(null)
      setIsLocked(false)
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY_LAST_BARBER)
      }
    }
  }, [auth, setIsLocked])

  const lock = useCallback(() => {
    setIsLocked(true)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY_LAST_BARBER)
    }
  }, [setIsLocked])
  const unlock = useCallback(() => setIsLocked(false), [setIsLocked])

  return (
    <PosAuthContext.Provider
      value={{
        viewer,
        isAuthenticated: viewer !== null,
        isLocked,
        loading,
        pinLockedUntil: viewer?.staff?.pinLockedUntil ?? null,
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
