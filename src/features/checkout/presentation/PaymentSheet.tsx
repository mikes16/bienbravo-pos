import { useState } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'
import { CashChangeHelper } from './CashChangeHelper'
import { type CashCounts, emptyCashCounts } from '@/shared/cash/cashCounts'
import { TipInput } from './TipInput'

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER'

interface PaymentInput {
  method: PaymentMethod
  tipCents: number
}

interface PaymentSheetProps {
  open: boolean
  totalCents: number
  onClose: () => void
  onConfirm: (input: PaymentInput) => void
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
}

export function PaymentSheet({ open, totalCents, onClose, onConfirm }: PaymentSheetProps) {
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [cashCounts, setCashCounts] = useState<CashCounts>(emptyCashCounts())
  const [tipCents, setTipCents] = useState(0)

  if (!open) return null

  const canConfirm = method !== null

  return (
    <div
      role="dialog"
      aria-label="Pago"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl border-t border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-6 py-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between">
          <p className="font-[var(--font-pos-display)] text-[20px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
            Pago
          </p>
          <p className="text-[18px] font-extrabold tabular-nums text-[var(--color-bone)]">
            {formatMoney(totalCents)}
          </p>
        </div>

        <div className="mb-3 flex gap-2">
          {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
            <TouchButton
              key={m}
              variant="secondary"
              size="secondary"
              onClick={() => setMethod(m)}
              className={cn(
                'flex-1',
                method === m && 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
              )}
            >
              {METHOD_LABELS[m]}
            </TouchButton>
          ))}
        </div>

        {method === 'CASH' && (
          <CashChangeHelper
            totalCents={totalCents}
            counts={cashCounts}
            onCountsChange={setCashCounts}
          />
        )}

        {(method === 'CARD' || method === 'TRANSFER') && (
          <TipInput totalCents={totalCents} tipCents={tipCents} onChange={setTipCents} />
        )}

        <div className="mt-4">
          <TouchButton
            variant="primary"
            size="primary"
            disabled={!canConfirm}
            onClick={() => method && onConfirm({ method, tipCents: method === 'CASH' ? 0 : tipCents })}
            className="rounded-none uppercase tracking-[0.06em]"
          >
            Confirmar pago
          </TouchButton>
        </div>
      </div>
    </div>
  )
}
