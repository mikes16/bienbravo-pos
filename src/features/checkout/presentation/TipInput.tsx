import { useState } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { cn } from '@/shared/lib/cn'

interface TipInputProps {
  totalCents: number
  tipCents: number
  onChange: (cents: number) => void
}

const PRESETS = [10, 15, 20]

export function TipInput({ totalCents, tipCents, onChange }: TipInputProps) {
  const [otroOpen, setOtroOpen] = useState(false)
  const [otroPesos, setOtroPesos] = useState(0)

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
        Propina (opcional)
      </span>
      <div className="flex gap-2">
        {PRESETS.map((p) => {
          const cents = Math.round((totalCents * p) / 100)
          const isSelected = tipCents === cents && !otroOpen
          return (
            <TouchButton
              key={p}
              variant="secondary"
              size="min"
              onClick={() => {
                setOtroOpen(false)
                onChange(cents)
              }}
              className={cn(
                'flex-1 tabular-nums',
                isSelected && 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
              )}
            >
              {p}%
            </TouchButton>
          )
        })}
        <TouchButton
          variant="secondary"
          size="min"
          onClick={() => setOtroOpen((v) => !v)}
          className={cn(
            'flex-1',
            otroOpen && 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
          )}
        >
          Otro
        </TouchButton>
      </div>
      {otroOpen && (
        <div className="flex items-center gap-2 border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2">
          <span className="text-[var(--color-bone-muted)]">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={otroPesos}
            onChange={(e) => {
              const raw = e.target.value
              const pesos = raw === '' ? 0 : Math.max(0, Number(raw) || 0)
              setOtroPesos(pesos)
              if (raw !== '') onChange(pesos * 100)
            }}
            aria-label="Otro monto"
            className="w-24 bg-transparent text-right text-[16px] font-bold tabular-nums text-[var(--color-bone)] outline-none"
          />
        </div>
      )}
    </div>
  )
}
