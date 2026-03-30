import { createContext, useState, useCallback, type ReactNode } from 'react'

const POS_LOCATION_STORAGE_KEY = 'bb-pos-location-id'

export interface LocationContextValue {
  locationId: string | null
  setLocationId: (id: string | null) => void
}

export const LocationContext = createContext<LocationContextValue | null>(null)

export function LocationProvider({ children }: { children: ReactNode }) {
  const [locationId, setLocationIdState] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(POS_LOCATION_STORAGE_KEY)
  })

  const setLocationId = useCallback((id: string | null) => {
    setLocationIdState(id)
    if (typeof window === 'undefined') return
    if (id) {
      window.localStorage.setItem(POS_LOCATION_STORAGE_KEY, id)
    } else {
      window.localStorage.removeItem(POS_LOCATION_STORAGE_KEY)
    }
  }, [])

  return (
    <LocationContext.Provider value={{ locationId, setLocationId }}>
      {children}
    </LocationContext.Provider>
  )
}
