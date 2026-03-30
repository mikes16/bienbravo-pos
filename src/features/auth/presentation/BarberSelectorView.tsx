import type { PosStaffUser } from '@/core/auth/auth.types.ts'
import { cn } from '@/shared/lib/cn.ts'

interface BarberSelectorViewProps {
  barbers: PosStaffUser[]
  loading: boolean
  error: string | null
  onSelect: (barber: PosStaffUser) => void
  locationName?: string | null
  onChangeLocation?: () => void
}

export function BarberSelectorView({
  barbers,
  loading,
  error,
  onSelect,
  locationName,
  onChangeLocation,
}: BarberSelectorViewProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="text-center">
        <h1 className="font-bb-display text-3xl font-bold tracking-tight">Bien Bravo</h1>
        <p className="mt-2 text-bb-muted">Selecciona tu perfil para entrar</p>
        {locationName && (
          <p className="mt-2 text-xs text-bb-muted">Sucursal: {locationName}</p>
        )}
        {onChangeLocation && (
          <button
            type="button"
            onClick={onChangeLocation}
            className="mt-2 text-xs font-semibold text-bb-primary hover:underline"
          >
            Cambiar sucursal
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-2xl bg-bb-danger/10 px-4 py-3 text-sm text-bb-danger">{error}</p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-36 w-36 animate-pulse rounded-2xl bg-bb-surface"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {barbers.map((barber) => (
            <button
              key={barber.id}
              type="button"
              onClick={() => onSelect(barber)}
              className={cn(
                'flex flex-col items-center gap-3 rounded-2xl bg-bb-surface p-5',
                'transition-transform duration-[var(--bb-motion-duration-fast)]',
                'active:scale-[0.97] hover:bg-bb-surface-2',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-bb-primary',
                'touch-target-lg',
              )}
            >
              {barber.photoUrl ? (
                <img
                  src={barber.photoUrl}
                  alt={barber.fullName}
                  className="h-20 w-20 rounded-full object-cover bg-bb-surface-2"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-bb-surface-2 text-2xl font-semibold text-bb-muted">
                  {barber.fullName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium leading-tight text-center">
                {barber.fullName}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
