import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider'

const POS_LOCATION_STORAGE_KEY = 'bb-pos-location-id'

export interface LocationContextValue {
  locationId: string | null
  locationName: string | null
  /**
   * Slug de la sucursal — necesario para las subscriptions reales-time
   * (walkInQueueUpdated usa slug, no id, porque es la clave compartida
   * entre kiosk display público y staff). Es null hasta que termina la
   * resolución vía auth.getLocations() en el mount del LocationProvider.
   */
  locationSlug: string | null
  setLocationId: (id: string | null) => void
}

export const LocationContext = createContext<LocationContextValue | null>(null)

export function LocationProvider({ children }: { children: ReactNode }) {
  const { auth } = useRepositories()
  const [locationId, setLocationIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(POS_LOCATION_STORAGE_KEY)
  })
  const [locationName, setLocationName] = useState<string | null>(null)
  const [locationSlug, setLocationSlug] = useState<string | null>(null)

  const setLocationId = useCallback((id: string | null) => {
    setLocationIdState(id)
    if (typeof window === 'undefined') return
    if (id) {
      window.localStorage.setItem(POS_LOCATION_STORAGE_KEY, id)
    } else {
      window.localStorage.removeItem(POS_LOCATION_STORAGE_KEY)
    }
  }, [])

  // Resolve locationName + locationSlug whenever locationId changes.
  // All setState calls are inside async callbacks to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false
    const resolvePromise = locationId
      ? auth.getLocations().then((locations) => {
          const match = locations.find((l) => l.id === locationId)
          return match ? { name: match.name, slug: match.slug } : null
        })
      : Promise.resolve(null)

    resolvePromise
      .then((data) => {
        if (cancelled) return
        setLocationName(data?.name ?? null)
        setLocationSlug(data?.slug ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setLocationName(null)
        setLocationSlug(null)
      })

    return () => {
      cancelled = true
    }
  }, [locationId, auth])

  return (
    <LocationContext.Provider value={{ locationId, locationName, locationSlug, setLocationId }}>
      {children}
    </LocationContext.Provider>
  )
}
