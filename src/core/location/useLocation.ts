import { useContext } from 'react'
import { LocationContext, type LocationContextValue } from './LocationProvider.tsx'

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocation must be used within LocationProvider')
  return ctx
}
