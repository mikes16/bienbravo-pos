import { CartLineRow } from './CartLineRow'
import type { CartLine } from '../lib/cart'

interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
}

/**
 * Lo que el modo venta a staff sabe de UNA línea. Forma estructural de
 * `StaffSaleCartLine` (useCheckout) reducida a lo que pinta la fila: la marca
 * de línea staff sigue siendo `listUnitPriceCents` y nada más ([D-041]).
 */
interface StaffLineInfo {
  listUnitPriceCents: number | null
  blockMessage: string | null
}

interface CartListProps {
  lines: CartLine[]
  barbers: Barber[]
  // itemId → IDs de barberos excluidos de ese servicio o combo. Solo contiene
  // entradas para servicios/combos con exclusiones; el resto de líneas
  // (productos, servicios/combos sin exclusión) no filtran nada.
  excludedByCatalogItem?: Map<string, string[]>
  // lineId → vista staff de ESA línea. Sólo trae entradas para líneas de
  // producto y sólo con el modo venta a staff encendido; ausente o sin la
  // entrada, la fila se pinta exactamente como en una venta normal.
  staffLines?: Map<string, StaffLineInfo>
  onIncQty: (lineId: string) => void
  onDecQty: (lineId: string) => void
  onSetBarber: (lineId: string, barberId: string) => void
  onRemove: (lineId: string) => void
}

export function CartList({
  lines,
  barbers,
  excludedByCatalogItem,
  staffLines,
  onIncQty,
  onDecQty,
  onSetBarber,
  onRemove,
}: CartListProps) {
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
          excludedBarberIds={excludedByCatalogItem?.get(line.itemId)}
          staffListUnitPriceCents={staffLines?.get(line.id)?.listUnitPriceCents}
          staffBlockMessage={staffLines?.get(line.id)?.blockMessage}
          onIncQty={onIncQty}
          onDecQty={onDecQty}
          onSetBarber={onSetBarber}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
