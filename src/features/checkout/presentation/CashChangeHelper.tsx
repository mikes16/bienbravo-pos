import { useEffect, useState } from 'react'
import { formatMoney } from '@/shared/lib/money'

interface CashChangeHelperProps {
  totalCents: number
  receivedPesos: number
  onReceivedChange: (pesos: number) => void
}

export function CashChangeHelper({ totalCents, receivedPesos, onReceivedChange }: CashChangeHelperProps) {
  const [display, setDisplay] = useState(receivedPesos)

  useEffect(() => {
    setDisplay(receivedPesos)
  }, [receivedPesos])

  const receivedCents = display * 100
  const changeCents = Math.max(0, receivedCents - totalCents)

  return (
    <div className="flex flex-col gap-3 border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Recibido
        </span>
        <div className="flex items-center gap-2 border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2">
          <span className="text-[var(--color-bone-muted)]">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={display}
            onChange={(e) => {
              const raw = e.target.value
              const pesos = raw === '' ? 0 : Math.max(0, Number(raw) || 0)
              setDisplay(pesos)
              if (raw !== '') onReceivedChange(pesos)
            }}
            aria-label="Monto recibido"
            className="w-24 bg-transparent text-right text-[18px] font-bold tabular-nums text-[var(--color-bone)] outline-none"
          />
        </div>
      </div>
      <div className="flex items-baseline justify-between border-t border-[var(--color-leather-muted)]/40 pt-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          {`Cambio ${formatMoney(changeCents)}`}
        </span>
      </div>
    </div>
  )
}
