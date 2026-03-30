import { useContext } from 'react'
import { PosAuthContext, type PosAuthContextValue } from './PosAuthProvider.tsx'

export function usePosAuth(): PosAuthContextValue {
  const ctx = useContext(PosAuthContext)
  if (!ctx) throw new Error('usePosAuth must be used within PosAuthProvider')
  return ctx
}
