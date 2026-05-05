import { CartLineRow } from './CartLineRow'
import type { CartLine } from '../lib/cart'

interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
}

interface CartListProps {
  lines: CartLine[]
  barbers: Barber[]
  onIncQty: (lineId: string) => void
  onDecQty: (lineId: string) => void
  onSetBarber: (lineId: string, barberId: string) => void
  onRemove: (lineId: string) => void
}

export function CartList({ lines, barbers, onIncQty, onDecQty, onSetBarber, onRemove }: CartListProps) {
  if (lines.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12 text-center">
        <p className="text-[13px] text-[var(--color-bone-muted)]">
          Toca un servicio o producto para empezar.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {lines.map((line) => (
        <CartLineRow
          key={line.id}
          line={line}
          barbers={barbers}
          onIncQty={onIncQty}
          onDecQty={onDecQty}
          onSetBarber={onSetBarber}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
