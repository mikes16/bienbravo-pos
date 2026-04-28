import { useEffect, useState } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'

interface State {
  loading: boolean
  sessionId: string | null
  registerName: string | null
  /** True after the first fetch resolves, regardless of result. */
  ready: boolean
}

/**
 * Reads the single OPEN register session for a location. The business rule
 * is: at most one OPEN session per location at a time, so we expect 0 or 1
 * here. Returns the id (or null) so callers can attach sales to the active
 * cash drawer and gate checkout when nothing is open.
 */
export function useActiveRegisterSession(locationId: string | null): State {
  const { register } = useRepositories()
  const [state, setState] = useState<State>({
    loading: true,
    sessionId: null,
    registerName: null,
    ready: false,
  })

  useEffect(() => {
    if (!locationId) {
      setState({ loading: false, sessionId: null, registerName: null, ready: true })
      return
    }
    let cancelled = false
    setState((s) => ({ ...s, loading: true, ready: false }))
    register
      .getRegisters(locationId)
      .then((registers) => {
        if (cancelled) return
        const open = registers.find((r) => r.openSession)
        setState({
          loading: false,
          sessionId: open?.openSession?.id ?? null,
          registerName: open?.name ?? null,
          ready: true,
        })
      })
      .catch(() => {
        if (cancelled) return
        setState({ loading: false, sessionId: null, registerName: null, ready: true })
      })
    return () => {
      cancelled = true
    }
  }, [register, locationId])

  return state
}
