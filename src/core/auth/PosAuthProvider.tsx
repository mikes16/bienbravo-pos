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
  // SSR-safe initial read: si hay viewer cached desde la sesión anterior
  // (Apollo cache hidratado desde localStorage al boot del client), lo
  // pintamos al instante. Si no, queda null y el efecto resuelve después.
  const [viewer, setViewer] = useState<PosViewer | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      return auth.getCachedViewer()
    } catch {
      return null
    }
  })
  // loading=false si ya tenemos viewer en cache: el shell renderiza con
  // datos cached sin spinner mientras la revalidación corre en background.
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      return auth.getCachedViewer() === null
    } catch {
      return true
    }
  })
  // Persisted across reload/server restart so the soft lock holds until the
  // operator types their PIN. If the cookie has since expired, the getViewer
  // effect below clears the flag.
  const [isLocked, setIsLockedState] = useState<boolean>(readPersistedLocked)

  const setIsLocked = useCallback((next: boolean) => {
    setIsLockedState(next)
    writePersistedLocked(next)
  }, [])

  // Revalidación silenciosa al mount. Si ya pintamos desde cache, esto solo
  // confirma que la sesión sigue válida y actualiza si el server tiene info
  // más fresca. Si no había cache, esto es el primer fetch que desbloquea
  // el shell.
  useEffect(() => {
    auth
      .revalidateViewer()
      .then((v) => {
        setViewer(v)
        if (!v) setIsLocked(false)
      })
      .catch(() => {
        // Si la red falla pero teníamos viewer cached, lo mantenemos —
        // mejor experiencia offline corta que kickear al lock screen.
        // Si no había cached, ya estamos en null.
      })
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
      // Cirugía: SOLO se evicta el campo viewer del cache. Antes purgábamos
      // todo el cache persistido, lo cual tiraba barberos, locations,
      // catálogo, etc. y hacía que el próximo login esperara TODO de nuevo.
      // El cookie ya es inválido server-side, así que keepar esos otros
      // datos no es leak — son datos compartidos entre sesiones del mismo
      // device.
      auth.evictViewerCache()
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
