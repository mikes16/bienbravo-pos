import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import { useLocation } from '@/core/location/useLocation.ts'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import type { PosStaffUser, PosLocation } from '@/core/auth/auth.types.ts'
import { BarberSelectorView } from './BarberSelectorView.tsx'
import { PinPadView } from './PinPadView.tsx'

export function LockPage() {
  const navigate = useNavigate()
  const { auth } = useRepositories()
  const { locationId, setLocationId } = useLocation()
  const { pinLogin, isAuthenticated, isLocked } = usePosAuth()

  const [barbers, setBarbers] = useState<PosStaffUser[]>([])
  const [locations, setLocations] = useState<PosLocation[]>([])
  const [pendingLocation, setPendingLocation] = useState<PosLocation | null>(null)
  const [locationPassword, setLocationPassword] = useState('')
  const [verifyingLocation, setVerifyingLocation] = useState(false)
  const [selectedBarber, setSelectedBarber] = useState<PosStaffUser | null>(null)
  const [selectingLocation, setSelectingLocation] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || isLocked) return
    navigate('/home', { replace: true })
  }, [isAuthenticated, isLocked, navigate])

  useEffect(() => {
    if (!selectingLocation) return
    setLoading(true)
    setError(null)
    auth
      .getLocations()
      .then(setLocations)
      .catch(() => setError('No se pudieron cargar las sucursales'))
      .finally(() => setLoading(false))
  }, [auth, selectingLocation])

  useEffect(() => {
    if (!locationId || selectingLocation) {
      setBarbers([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    auth
      .getBarbers(locationId)
      .then(setBarbers)
      .catch(() => setError('No se pudo cargar el equipo'))
      .finally(() => setLoading(false))
  }, [auth, locationId, selectingLocation])

  async function handleLocationAccessSubmit() {
    if (!pendingLocation || !locationPassword.trim()) return
    setVerifyingLocation(true)
    setError(null)
    try {
      const ok = await auth.verifyLocationAccess(pendingLocation.id, locationPassword.trim())
      if (!ok) {
        setError('Contraseña de sucursal incorrecta')
        return
      }
      setLocationId(pendingLocation.id)
      setSelectingLocation(false)
      setLocationPassword('')
      setPendingLocation(null)
    } catch {
      setError('No se pudo validar la sucursal')
    } finally {
      setVerifyingLocation(false)
    }
  }

  async function handlePinSubmit(pin: string) {
    if (!selectedBarber) return
    setError(null)
    try {
      await pinLogin(selectedBarber.email, pin)
    } catch {
      setError('PIN incorrecto')
    }
  }

  if (selectingLocation) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-8 px-6 py-10">
        <div className="text-center">
          <h1 className="font-bb-display text-3xl font-bold tracking-tight">Bien Bravo</h1>
          <p className="mt-2 text-bb-muted">Selecciona sucursal</p>
        </div>

        {error && (
          <p className="rounded-2xl bg-bb-danger/10 px-4 py-3 text-sm text-bb-danger">{error}</p>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 w-64 animate-pulse rounded-2xl bg-bb-surface" />
            ))}
          </div>
        ) : (
          <>
            {locations.length > 0 && !pendingLocation ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      setPendingLocation(loc)
                      setError(null)
                    }}
                    className="w-64 rounded-2xl bg-bb-surface px-5 py-4 text-left font-semibold hover:bg-bb-surface-2 active:scale-[0.97]"
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            ) : pendingLocation ? (
              <div className="w-full max-w-sm space-y-3">
                <p className="text-sm text-bb-muted">
                  Sucursal: <span className="font-semibold text-bb-text">{pendingLocation.name}</span>
                </p>
                <input
                  type="password"
                  value={locationPassword}
                  onChange={(e) => setLocationPassword(e.target.value)}
                  placeholder="Contraseña de sucursal"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleLocationAccessSubmit()
                  }}
                  className="w-full rounded-xl border border-bb-border bg-bb-surface px-4 py-3 text-sm outline-none focus:border-bb-primary"
                />
                <button
                  type="button"
                  disabled={!locationPassword.trim() || verifyingLocation}
                  onClick={() => void handleLocationAccessSubmit()}
                  className="w-full rounded-2xl bg-bb-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {verifyingLocation ? 'Validando...' : 'Continuar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingLocation(null)
                    setLocationPassword('')
                    setError(null)
                  }}
                  className="w-full rounded-2xl bg-bb-surface px-5 py-3 text-sm font-semibold text-bb-text"
                >
                  Cambiar sucursal
                </button>
              </div>
            ) : (
              <p className="text-sm text-bb-muted">No hay sucursales activas disponibles.</p>
            )}
          </>
        )}
      </div>
    )
  }

  if (selectedBarber) {
    return (
      <PinPadView
        staffName={selectedBarber.fullName}
        photoUrl={selectedBarber.photoUrl}
        error={error}
        onSubmit={handlePinSubmit}
        onBack={() => {
          setSelectedBarber(null)
          setError(null)
        }}
      />
    )
  }

  return (
    <BarberSelectorView
      barbers={barbers}
      loading={loading}
      onSelect={setSelectedBarber}
      onChangeLocation={() => {
        setSelectedBarber(null)
        setPendingLocation(null)
        setLocationPassword('')
        setSelectingLocation(true)
      }}
    />
  )
}
