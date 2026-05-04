import { TileGrid, TileButton, TouchButton, EmptyStateV2 } from '@/shared/pos-ui'
import type { PosStaffUser } from '@/core/auth/auth.types'

interface BarberSelectorViewProps {
  barbers: PosStaffUser[]
  loading: boolean
  onSelect: (barber: PosStaffUser) => void
  onChangeLocation: () => void
}

function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

export function BarberSelectorView({
  barbers,
  loading,
  onSelect,
  onChangeLocation,
}: BarberSelectorViewProps) {
  if (loading) {
    return (
      <p className="text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
        Cargando barberos…
      </p>
    )
  }

  if (barbers.length === 0) {
    return (
      <EmptyStateV2
        title="Sin barberos"
        description="No hay barberos activos en esta sucursal."
        action={{ label: 'Cambiar sucursal', onClick: onChangeLocation }}
      />
    )
  }

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <p className="text-center text-[var(--pos-text-body-lg)] text-[var(--color-bone-muted)]">
        Selecciona tu perfil
      </p>
      <TileGrid cols={4}>
        {barbers.map((b) => (
          <TileButton
            key={b.id}
            title={b.fullName}
            subtitle={getInitials(b.fullName)}
            onClick={() => onSelect(b)}
          />
        ))}
      </TileGrid>
      <div className="flex justify-center">
        <TouchButton variant="ghost" size="row" onClick={onChangeLocation}>
          Cambiar sucursal
        </TouchButton>
      </div>
    </div>
  )
}
