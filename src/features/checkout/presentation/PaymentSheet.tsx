import { useState } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'
import { CashChangeHelper } from './CashChangeHelper'
import { type CashCounts, emptyCashCounts, totalCountedCents } from '@/shared/cash/cashCounts'
import { TipInput } from './TipInput'

// 'CARD' es el label UI; en el API es CARD_TERMINAL. La conversión se
// hace al emitir en onConfirm.
type UiMethod = 'CASH' | 'CARD' | 'TRANSFER'
type ApiProvider = 'CASH' | 'CARD_TERMINAL' | 'TRANSFER'

const UI_TO_API: Record<UiMethod, ApiProvider> = {
  CASH: 'CASH',
  CARD: 'CARD_TERMINAL',
  TRANSFER: 'TRANSFER',
}

interface SplitRow {
  method: UiMethod
  amountCents: number
}

interface PaymentInput {
  payments: Array<{ provider: ApiProvider; amountCents: number }>
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
  /**
   * Last submit error surfaced by the checkout hook. Rendered inline above
   * the confirm CTA — the cart-panel error region is hidden behind this
   * modal, so the sheet has to show its own copy or the failure is silent.
   */
  error?: string | null
  onClose: () => void
  onConfirm: (input: PaymentInput) => void
}

const METHOD_LABELS: Record<UiMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
}

export function PaymentSheet({ open, totalCents, submitting = false, error = null, onClose, onConfirm }: PaymentSheetProps) {
  const [method, setMethod] = useState<UiMethod | null>(null)
  const [cashCounts, setCashCounts] = useState<CashCounts>(emptyCashCounts())
  const [tipCents, setTipCents] = useState(0)
  const [mode, setMode] = useState<'simple' | 'split'>('simple')
  const [splits, setSplits] = useState<SplitRow[]>([
    { method: 'CASH', amountCents: 0 },
    { method: 'CARD', amountCents: 0 },
  ])

  if (!open) return null

  // Cash payments must cover the total exactly or higher — anything less is a
  // shortfall the operator has to hand the customer back as "debes $X". The
  // POS doesn't model partial cash payments, so the safer rule is to lock the
  // confirm button until the bills counted reach the total.
  const cashReceivedCents = totalCountedCents(cashCounts)
  const cashIsShort = method === 'CASH' && cashReceivedCents < totalCents

  const splitSum = splits.reduce((s, r) => s + r.amountCents, 0)
  const splitDelta = totalCents - splitSum
  const splitMatches = splitDelta === 0

  const canConfirm =
    !submitting &&
    (mode === 'simple'
      ? method !== null && !cashIsShort
      : splitMatches && splits.some((r) => r.amountCents > 0))

  function handleConfirm() {
    if (submitting) return

    if (mode === 'simple') {
      if (!method) return
      onConfirm({
        payments: [{ provider: UI_TO_API[method], amountCents: totalCents }],
        tipCents: method === 'CASH' ? 0 : tipCents,
      })
      return
    }

    // Split mode: filter zeros and emit
    const nonZero = splits.filter((r) => r.amountCents > 0)
    if (!splitMatches || nonZero.length === 0) return
    onConfirm({
      payments: nonZero.map((r) => ({ provider: UI_TO_API[r.method], amountCents: r.amountCents })),
      tipCents,
    })
  }

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

        {mode === 'simple' && (
          <>
            <div className="mb-3 flex gap-2">
              {(Object.keys(METHOD_LABELS) as UiMethod[]).map((m) => (
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

            <button
              type="button"
              onClick={() => setMode('split')}
              className="mt-2 w-full border border-dashed border-[var(--color-leather-muted)] py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-bone)] hover:bg-[var(--color-cuero-viejo)]/30"
            >
              + Dividir pago
            </button>
          </>
        )}

        {mode === 'split' && (
          <div className="flex flex-col gap-3 border border-[var(--color-leather-muted)] p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
              División de pago
            </p>
            {splits.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                <select
                  value={row.method}
                  onChange={(e) =>
                    setSplits((prev) => prev.map((r, i) => (i === idx ? { ...r, method: e.target.value as UiMethod } : r)))
                  }
                  aria-label={`Método ${idx + 1}`}
                  className="border border-[var(--color-leather-muted)] bg-[var(--color-carbon)] px-2 py-1 text-[13px] text-[var(--color-bone)]"
                >
                  {(['CASH', 'CARD', 'TRANSFER'] as UiMethod[])
                    .filter((m) => m === row.method || !splits.some((r) => r.method === m))
                    .map((m) => (
                      <option key={m} value={m}>
                        {METHOD_LABELS[m]}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  aria-label="Monto"
                  value={row.amountCents === 0 ? '' : (row.amountCents / 100).toString()}
                  onChange={(e) =>
                    setSplits((prev) =>
                      prev.map((r, i) =>
                        i === idx ? { ...r, amountCents: Math.max(0, Math.round((Number(e.target.value) || 0) * 100)) } : r,
                      ),
                    )
                  }
                  className="w-28 border border-[var(--color-leather-muted)] bg-[var(--color-carbon)] px-2 py-1 text-right tabular-nums text-[var(--color-bone)]"
                />
                <button
                  type="button"
                  onClick={() => setSplits((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={splits.length <= 1}
                  aria-label="Quitar"
                  className="text-[var(--color-bravo)] disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            ))}

            {splits.length < 3 && (
              <button
                type="button"
                onClick={() => {
                  const used = new Set(splits.map((r) => r.method))
                  const next = (['CASH', 'CARD', 'TRANSFER'] as UiMethod[]).find((m) => !used.has(m)) ?? 'CASH'
                  setSplits((prev) => [...prev, { method: next, amountCents: 0 }])
                }}
                className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
              >
                + Agregar método
              </button>
            )}

            <p
              className={cn(
                'font-mono text-[11px] uppercase tracking-[0.18em]',
                splitMatches && 'text-[var(--color-success)]',
                !splitMatches && splitDelta > 0 && 'text-[var(--color-bravo)]',
                !splitMatches && splitDelta < 0 && 'text-[var(--color-warning)]',
              )}
            >
              Asignado: {formatMoney(splitSum)} / {formatMoney(totalCents)}
              {splitMatches && ' · ✓ Cuadra'}
              {!splitMatches && splitDelta > 0 && ` · Falta ${formatMoney(splitDelta)}`}
              {!splitMatches && splitDelta < 0 && ` · Sobra ${formatMoney(-splitDelta)}`}
            </p>

            <button
              type="button"
              onClick={() => setMode('simple')}
              className="text-left font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
            >
              ← Volver al modo simple
            </button>
          </div>
        )}

        {error && !submitting && (
          <div
            role="alert"
            className="mt-4 border border-[var(--color-bravo)]/50 bg-[var(--color-bravo)]/[0.08] px-4 py-3"
          >
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">
              No se pudo cobrar
            </p>
            <p className="mt-1 whitespace-pre-line text-[13px] text-[var(--color-bone)]">{error}</p>
          </div>
        )}

        <div className="mt-4">
          <TouchButton
            variant="primary"
            size="primary"
            disabled={!canConfirm}
            aria-busy={submitting}
            onClick={handleConfirm}
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
            ) : error ? (
              'Reintentar pago'
            ) : mode === 'split' ? (
              'Cobrar'
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
