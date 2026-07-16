import { formatMoney } from '@/shared/lib/money'

interface CartTotalsProps {
  subtotalCents: number
  /**
   * Suma de descuentos aplicados por cupones (positivo). Cuando es 0 el
   * desglose "Subtotal / Descuentos" se omite y solo se muestra Total —
   * para no agregar ruido visual en la mayoría de ventas que no usan
   * cupones.
   */
  discountTotalCents?: number
  /**
   * Cobro de cita prepagada: monto ya cobrado por adelantado. Cuando es
   * non-null, se muestra una línea discreta "Pagado antes: $X" y el label del
   * total cambia a "A cobrar" (solo los extras nuevos, nunca lo prepagado).
   * Undefined/null en el flujo normal de venta.
   */
  prepaidTotalCents?: number | null
}

export function CartTotals({ subtotalCents, discountTotalCents = 0, prepaidTotalCents = null }: CartTotalsProps) {
  const totalCents = Math.max(0, subtotalCents - discountTotalCents)
  const hasDiscount = discountTotalCents > 0
  const isPrepaid = prepaidTotalCents != null
  const totalLabel = isPrepaid ? 'A cobrar' : 'Total'

  return (
    <div className="flex flex-col gap-1 border-t border-[var(--color-leather-muted)]/40 px-4 py-3">
      {isPrepaid && (
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
            Pagado antes
          </span>
          <span className="font-mono text-[14px] tabular-nums text-[var(--color-bone-muted)]">
            {formatMoney(prepaidTotalCents)}
          </span>
        </div>
      )}
      {hasDiscount && (
        <>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
              Subtotal
            </span>
            <span className="font-mono text-[14px] tabular-nums text-[var(--color-bone-muted)]">
              {formatMoney(subtotalCents)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-success)]">
              Descuentos
            </span>
            <span className="font-mono text-[14px] tabular-nums text-[var(--color-success)]">
              −{formatMoney(discountTotalCents)}
            </span>
          </div>
        </>
      )}
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          {totalLabel}
        </span>
        <span className="font-[var(--font-pos-display)] text-[28px] font-extrabold tabular-nums leading-none text-[var(--color-bone)]">
          {formatMoney(totalCents)}
        </span>
      </div>
    </div>
  )
}
