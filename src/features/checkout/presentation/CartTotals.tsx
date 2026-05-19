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
}

export function CartTotals({ subtotalCents, discountTotalCents = 0 }: CartTotalsProps) {
  const totalCents = Math.max(0, subtotalCents - discountTotalCents)
  const hasDiscount = discountTotalCents > 0

  return (
    <div className="flex flex-col gap-1 border-t border-[var(--color-leather-muted)]/40 px-4 py-3">
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
          Total
        </span>
        <span className="font-[var(--font-pos-display)] text-[28px] font-extrabold tabular-nums leading-none text-[var(--color-bone)]">
          {formatMoney(totalCents)}
        </span>
      </div>
    </div>
  )
}
