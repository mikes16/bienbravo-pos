import { useEffect, useRef, useState } from 'react'
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

/**
 * Fila de cart compacta con controles on-demand.
 *
 * Vista por defecto (densidad reducida):
 *   `{qty}× {nombre}    {barbero}   {precio}  ×`
 *
 * Tap en la fila → expande controles (qty stepper + barbero picker). La
 * mayoría de líneas son qty=1 con el barbero default; el cajero rara vez
 * necesita los controles, así que esconderlos por defecto baja muchísimo el
 * ruido visual cuando hay 3-5 servicios en el cart. Patrón inspirado en
 * Shopify POS 2026 — controles aparecen solo cuando se necesitan.
 */
export function CartLineRow({ line, barbers, onIncQty, onDecQty, onSetBarber, onRemove }: CartLineRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const currentBarber = barbers.find((b) => b.id === line.staffUserId)
  const lineTotalCents = line.unitPriceCents * line.qty

  useEffect(() => {
    if (pickerOpen) {
      pickerRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    }
  }, [pickerOpen])

  return (
    <div className="border-b border-[var(--color-leather-muted)]/30">
      {/* Fila compacta: tap-target completo para expandir controles. El
          botón × tiene stopPropagation para que tap no expanda al borrar. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-cuero-viejo)]/30"
        aria-expanded={expanded}
        aria-label={`${line.qty}× ${line.name}, ${currentBarber?.fullName ?? 'sin barbero'}, ${formatMoney(lineTotalCents)}. Toca para modificar.`}
      >
        {/* Qty — tabular nums para que dos dígitos no descoloquen el layout. */}
        <span className="w-6 shrink-0 text-center font-mono text-[12px] font-bold tabular-nums text-[var(--color-bone-muted)]">
          {line.qty}×
        </span>
        {/* Nombre — toma todo el espacio disponible. */}
        <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-[var(--color-bone)]">
          {line.name}
        </span>
        {/* Barbero pill — info, no acción. La acción es expandir la fila. */}
        <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
          {currentBarber?.fullName.split(' ')[0] ?? '—'}
        </span>
        {/* Precio — peso visual del total de la línea. */}
        <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-[var(--color-bone)]">
          {formatMoney(lineTotalCents)}
        </span>
        {/* Remove — stopPropagation evita expandir al borrar. */}
        <span
          role="button"
          aria-label="Quitar línea"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            onRemove(line.id)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation()
              e.preventDefault()
              onRemove(line.id)
            }
          }}
          className="shrink-0 cursor-pointer font-mono text-[14px] text-[var(--color-bone-muted)] hover:text-[var(--color-bravo)]"
        >
          ×
        </span>
      </button>

      {/* Controles expandidos — solo on-demand. Qty stepper + cambio de
          barbero. Animación implícita por mount/unmount (no transition
          deliberada para que sea instantáneo cuando el cajero tiene prisa). */}
      {expanded && (
        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-leather-muted)]/20 bg-[var(--color-carbon-elevated)]/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Disminuir cantidad"
              onClick={(e) => {
                e.stopPropagation()
                onDecQty(line.id)
              }}
              className="flex h-10 w-10 cursor-pointer items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[16px] font-bold text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)]"
            >
              −
            </button>
            <span className="w-8 text-center text-[16px] font-extrabold tabular-nums text-[var(--color-bone)]">
              {line.qty}
            </span>
            <button
              type="button"
              aria-label="Aumentar cantidad"
              onClick={(e) => {
                e.stopPropagation()
                onIncQty(line.id)
              }}
              className="flex h-10 w-10 cursor-pointer items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[16px] font-bold text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)]"
            >
              +
            </button>
          </div>
          <button
            type="button"
            aria-label={`Cambiar barbero: ${currentBarber?.fullName ?? 'sin asignar'}`}
            onClick={(e) => {
              e.stopPropagation()
              setPickerOpen((v) => !v)
            }}
            className={cn(
              'cursor-pointer border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em]',
              pickerOpen
                ? 'border-[var(--color-bravo)] text-[var(--color-bone)]'
                : 'border-[var(--color-leather-muted)] text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)]',
            )}
          >
            <span aria-hidden>Cambiar barbero ↓</span>
          </button>
        </div>
      )}

      {expanded && pickerOpen && (
        <div ref={pickerRef} className="border-t border-[var(--color-leather-muted)]/20">
          <BarberPickerInline
            barbers={barbers}
            currentBarberId={line.staffUserId}
            onSelect={(id) => {
              onSetBarber(line.id, id)
              // Cerrar picker + colapsar fila — terminó la modificación, no
              // hay razón para mantener controles expandidos. El cajero
              // puede re-expandir con un tap si necesita otra cosa.
              setPickerOpen(false)
              setExpanded(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
