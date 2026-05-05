import { useEffect, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'

interface DenominationCounterProps {
  amountLabel: string
  subtotalCents: number              // cents (e.g., 100000 for $1,000)
  count?: number
  onCountChange?: (next: number) => void
  isLumpSum?: boolean
  lumpSumCents?: number
  onLumpSumChange?: (cents: number) => void
  denomination?: 500 | 200 | 100 | 50 | 20
  className?: string
}

export function DenominationCounter({
  amountLabel,
  subtotalCents,
  count = 0,
  onCountChange,
  isLumpSum,
  lumpSumCents = 0,
  onLumpSumChange,
  denomination,
  className,
}: DenominationCounterProps) {
  // Local display state for the lump-sum input so userEvent clear+type works
  // correctly with controlled inputs. Syncs from props when lumpSumCents changes.
  const [lumpSumDisplay, setLumpSumDisplay] = useState(Math.round(lumpSumCents / 100))
  useEffect(() => {
    setLumpSumDisplay(Math.round(lumpSumCents / 100))
  }, [lumpSumCents])

  const [editing, setEditing] = useState(false)
  const [countDraft, setCountDraft] = useState<string>(String(count))
  useEffect(() => {
    if (!editing) setCountDraft(String(count))
  }, [count, editing])

  const commitCount = () => {
    const n = Math.max(0, Number(countDraft) || 0)
    if (n !== count) onCountChange?.(n)
    setEditing(false)
  }

  const hasCount = isLumpSum ? lumpSumCents > 0 : count > 0

  const stripeColor =
    denomination && !isLumpSum
      ? {
          500: 'var(--color-bill-500)',
          200: 'var(--color-bill-200)',
          100: 'var(--color-bill-100)',
          50: 'var(--color-bill-50)',
          20: 'var(--color-bill-20)',
        }[denomination]
      : undefined

  return (
    <div
      className={cn(
        'relative grid grid-cols-[110px_1fr_auto] items-center gap-4 border-b border-[var(--color-leather-muted)]/40 px-4 py-3 last:border-b-0',
        hasCount && 'bg-[var(--color-bravo)]/[0.04]',
        isLumpSum && !hasCount && 'bg-[var(--color-cuero-viejo)]/[0.06]',
        className,
      )}
    >
      {stripeColor && (
        <span
          data-bill-stripe={denomination}
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: stripeColor }}
        />
      )}
      <span
        className={cn(
          'font-bold text-[var(--color-bone)] tabular-nums',
          isLumpSum
            ? 'font-mono text-[12px] uppercase tracking-[0.12em]'
            : 'text-[20px]',
        )}
      >
        {amountLabel}
      </span>

      {isLumpSum ? (
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2">
            <span className="text-[var(--color-bone-muted)]">$</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              aria-label={amountLabel}
              value={lumpSumDisplay}
              onChange={(e) => {
                const raw = e.target.value
                setLumpSumDisplay(raw === '' ? 0 : Math.max(0, Number(raw) || 0))
                if (raw !== '') {
                  const pesos = Math.max(0, Number(raw) || 0)
                  onLumpSumChange?.(pesos * 100)
                }
              }}
              className="w-20 bg-transparent text-right text-[16px] font-bold tabular-nums text-[var(--color-bone)] outline-none"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onCountChange?.(Math.max(0, count - 1))}
            disabled={count === 0}
            aria-label="Disminuir cantidad"
            className={cn(
              'flex h-11 w-11 items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[20px] font-bold transition-colors',
              count === 0
                ? 'cursor-not-allowed text-[var(--color-leather-muted)]'
                : 'cursor-pointer text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)] hover:text-[var(--color-bone)]',
            )}
          >
            −
          </button>
          {editing ? (
            <input
              type="number"
              inputMode="numeric"
              min={0}
              autoFocus
              value={countDraft}
              onChange={(e) => setCountDraft(e.target.value)}
              onBlur={commitCount}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitCount()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setCountDraft(String(count))
                  setEditing(false)
                }
              }}
              aria-label="Cantidad"
              className="w-12 border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-1 text-center text-[20px] font-extrabold tabular-nums text-[var(--color-bone)] outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Editar cantidad"
              className={cn(
                'w-10 cursor-pointer text-center text-[20px] font-extrabold tabular-nums',
                count === 0 ? 'text-[var(--color-leather-muted)]' : 'text-[var(--color-bone)]',
              )}
            >
              {count}
            </button>
          )}
          <button
            type="button"
            onClick={() => onCountChange?.(count + 1)}
            aria-label="Aumentar cantidad"
            className="flex h-11 w-11 cursor-pointer items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[20px] font-bold text-[var(--color-bone-muted)] transition-colors hover:bg-[var(--color-cuero-viejo)] hover:text-[var(--color-bone)]"
          >
            +
          </button>
        </div>
      )}

      <span
        className={cn(
          'min-w-[100px] text-right text-[18px] font-bold tabular-nums',
          hasCount ? 'text-[var(--color-bone)]' : 'text-[var(--color-leather-muted)]',
        )}
      >
        {formatMoney(subtotalCents)}
      </span>
    </div>
  )
}
