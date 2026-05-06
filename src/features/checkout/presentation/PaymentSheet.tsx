import { useState } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'
import { CashChangeHelper } from './CashChangeHelper'
import { type CashCounts, emptyCashCounts, totalCountedCents } from '@/shared/cash/cashCounts'
import { TipInput } from './TipInput'

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER'

interface PaymentInput {
  method: PaymentMethod
  tipCents: number
}

interface PaymentSheetProps {
  open: boolean
  totalCents: number
  /**
   * Sale is currently being recorded against the API. While true, the sheet
   * locks every interactive element and shows a "Procesando…" CTA so the
   * operator never wonders whether their tap landed.
   */
  submitting?: boolean
  onClose: () => void
  onConfirm: (input: PaymentInput) => void
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
}

export function PaymentSheet({ open, totalCents, submitting = false, onClose, onConfirm }: PaymentSheetProps) {
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [cashCounts, setCashCounts] = useState<CashCounts>(emptyCashCounts())
  const [tipCents, setTipCents] = useState(0)

  if (!open) return null

  // Cash payments must cover the total exactly or higher — anything less is a
  // shortfall the operator has to hand the customer back as "debes $X". The
  // POS doesn't model partial cash payments, so the safer rule is to lock the
  // confirm button until the bills counted reach the total.
  const cashReceivedCents = totalCountedCents(cashCounts)
  const cashIsShort = method === 'CASH' && cashReceivedCents < totalCents
  const canConfirm = method !== null && !cashIsShort && !submitting

  return (
    <div
      role="dialog"
      aria-label="Pago"
      aria-busy={submitting}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={() => {
        // Don't dismiss mid-submit — losing the sheet now would leave the
        // operator wondering whether the sale recorded.
        if (!submitting) onClose()
      }}
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
              disabled={submitting}
              onClick={() => {
                setMethod(m)
                setCashCounts(emptyCashCounts())
                setTipCents(0)
              }}
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
            aria-busy={submitting}
            onClick={() => method && onConfirm({ method, tipCents: method === 'CASH' ? 0 : tipCents })}
            className="rounded-none uppercase tracking-[0.06em]"
          >
            {submitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
                Procesando…
              </span>
            ) : (
              'Confirmar pago'
            )}
          </TouchButton>
          {submitting && (
            <p
              role="status"
              aria-live="polite"
              className="mt-3 text-center font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]"
            >
              Registrando venta · no cierres la tablet
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
