import { useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'
import { BarberPickerInline } from './BarberPickerInline'
import type { CartLine } from '../lib/cart'

interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
}

interface CartLineRowProps {
  line: CartLine
  barbers: Barber[]
  onIncQty: (lineId: string) => void
  onDecQty: (lineId: string) => void
  onSetBarber: (lineId: string, barberId: string) => void
  onRemove: (lineId: string) => void
}

export function CartLineRow({ line, barbers, onIncQty, onDecQty, onSetBarber, onRemove }: CartLineRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const currentBarber = barbers.find((b) => b.id === line.staffUserId)
  const lineTotalCents = line.unitPriceCents * line.qty

  return (
    <div className="flex flex-col gap-2 border-b border-[var(--color-leather-muted)]/30 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-bold text-[var(--color-bone)]">{line.name}</span>
        <span className="text-[14px] font-extrabold tabular-nums text-[var(--color-bone)]">{formatMoney(lineTotalCents)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Disminuir cantidad"
            onClick={() => onDecQty(line.id)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[16px] font-bold text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)]"
          >
            −
          </button>
          <span className="w-8 text-center text-[16px] font-extrabold tabular-nums text-[var(--color-bone)]">{line.qty}</span>
          <button
            type="button"
            aria-label="Aumentar cantidad"
            onClick={() => onIncQty(line.id)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[16px] font-bold text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)]"
          >
            +
          </button>
        </div>
        <button
          type="button"
          aria-label={`Cambiar barbero: ${currentBarber?.fullName ?? 'sin asignar'}`}
          onClick={() => setPickerOpen((v) => !v)}
          className={cn(
            'cursor-pointer border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em]',
            pickerOpen
              ? 'border-[var(--color-bravo)] text-[var(--color-bone)]'
              : 'border-[var(--color-leather-muted)] text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)]',
          )}
        >
          <span aria-hidden>{currentBarber?.fullName.split(' ')[0] ?? '— Barbero'} ↓</span>
        </button>
        <button
          type="button"
          aria-label="Quitar línea"
          onClick={() => onRemove(line.id)}
          className="cursor-pointer font-mono text-[14px] text-[var(--color-bone-muted)] hover:text-[var(--color-bravo)]"
        >
          ×
        </button>
      </div>
      {pickerOpen && (
        <BarberPickerInline
          barbers={barbers}
          currentBarberId={line.staffUserId}
          onSelect={(id) => {
            onSetBarber(line.id, id)
            setPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}
