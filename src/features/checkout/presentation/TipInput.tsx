import { useState } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { formatMoney } from '@/shared/lib/money'
import { cn } from '@/shared/lib/cn'

interface TipInputProps {
  /** Subtotal después de descuentos. Base para calcular la propina. */
  totalCents: number
  /** Propina actualmente seleccionada en cents. */
  tipCents: number
  onChange: (cents: number) => void
}

type Mode = 'none' | 'preset' | 'custom-tip' | 'fixed-total'

const PRESETS = [10, 15, 20]

/**
 * Propinas en el POS.
 *
 * 3 modos:
 *  - Preset (10%/15%/20%): el cajero elige el % y se calcula la propina.
 *  - Otro: el cajero entra la propina directa en pesos.
 *  - Cierre: el cliente dice "que sea $250" → cajero entra el TOTAL deseado
 *    y el sistema deriva la propina como `total - subtotal`. Caso real
 *    constante en barbería ("redondéamelo a tantos").
 *
 * Panel de desglose visible siempre que hay propina, así el cajero ve a
 * ojo de qué se trata: subtotal + propina = total a cobrar.
 */
export function TipInput({ totalCents, tipCents, onChange }: TipInputProps) {
  const [mode, setMode] = useState<Mode>('none')
  const [customTipPesos, setCustomTipPesos] = useState(0)
  const [fixedTotalPesos, setFixedTotalPesos] = useState(0)

  const subtotalPesos = totalCents / 100
  const fixedTotalCents = Math.round(fixedTotalPesos * 100)
  const fixedTotalValid = fixedTotalCents >= totalCents

  function selectPreset(percent: number) {
    const cents = Math.round((totalCents * percent) / 100)
    setMode('preset')
    onChange(cents)
  }

  function selectCustomTip() {
    setMode('custom-tip')
    onChange(customTipPesos * 100)
  }

  function selectFixedTotal() {
    setMode('fixed-total')
    if (fixedTotalValid) {
      onChange(fixedTotalCents - totalCents)
    } else {
      onChange(0)
    }
  }

  function updateCustomTip(pesos: number) {
    setCustomTipPesos(pesos)
    onChange(Math.round(pesos * 100))
  }

  function updateFixedTotal(pesos: number) {
    setFixedTotalPesos(pesos)
    const cents = Math.round(pesos * 100)
    if (cents >= totalCents) {
      onChange(cents - totalCents)
    } else {
      onChange(0)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
        Propina (opcional)
      </span>

      <div className="flex gap-2">
        {PRESETS.map((p) => {
          const cents = Math.round((totalCents * p) / 100)
          const isSelected = mode === 'preset' && tipCents === cents
          return (
            <TouchButton
              key={p}
              variant="secondary"
              size="min"
              onClick={() => selectPreset(p)}
              className={cn(
                'flex-1 tabular-nums',
                isSelected &&
                  'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
              )}
            >
              {p}%
            </TouchButton>
          )
        })}
        <TouchButton
          variant="secondary"
          size="min"
          onClick={selectCustomTip}
          className={cn(
            'flex-1',
            mode === 'custom-tip' &&
              'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
          )}
        >
          Otro
        </TouchButton>
        <TouchButton
          variant="secondary"
          size="min"
          onClick={selectFixedTotal}
          className={cn(
            'flex-1',
            mode === 'fixed-total' &&
              'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
          )}
        >
          Cierre
        </TouchButton>
      </div>

      {/* Input para "Otro" — propina directa en pesos */}
      {mode === 'custom-tip' && (
        <PesosInput
          label="Otra propina"
          value={customTipPesos}
          onChange={updateCustomTip}
          ariaLabel="Otra propina en pesos"
        />
      )}

      {/* Input para "Cierre" — total fijo, sistema deriva propina */}
      {mode === 'fixed-total' && (
        <div className="flex flex-col gap-1">
          <PesosInput
            label="Cierra en"
            value={fixedTotalPesos}
            onChange={updateFixedTotal}
            ariaLabel="Total a cobrar en pesos"
            hint={`Mínimo ${formatMoney(totalCents)}`}
          />
          {fixedTotalPesos > 0 && fixedTotalPesos < subtotalPesos && (
            <p
              role="alert"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bravo)]"
            >
              El total debe ser mayor o igual al subtotal
            </p>
          )}
        </div>
      )}

      {/* Desglose — siempre visible cuando hay propina */}
      {tipCents > 0 && (
        <div className="mt-1 flex flex-col gap-1.5 border-l-[2px] border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.05] px-3 py-2.5">
          <BreakdownRow label="Subtotal" value={formatMoney(totalCents)} />
          <BreakdownRow label="Propina" value={formatMoney(tipCents)} accent />
          <div className="my-0.5 h-px bg-[var(--color-leather-muted)]/40" />
          <BreakdownRow
            label="Total a cobrar"
            value={formatMoney(totalCents + tipCents)}
            strong
          />
        </div>
      )}
    </div>
  )
}

function PesosInput({
  label,
  value,
  onChange,
  ariaLabel,
  hint,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  ariaLabel: string
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2">
        <span className="min-w-[88px] font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          {label}
        </span>
        <span className="text-[var(--color-bone-muted)]">$</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value || ''}
          onChange={(e) => {
            const raw = e.target.value
            const n = raw === '' ? 0 : Math.max(0, Number(raw) || 0)
            onChange(n)
          }}
          aria-label={ariaLabel}
          className="flex-1 bg-transparent text-right text-[16px] font-bold tabular-nums text-[var(--color-bone)] outline-none"
        />
      </div>
      {hint && (
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
          {hint}
        </p>
      )}
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  accent,
  strong,
}: {
  label: string
  value: string
  accent?: boolean
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span
        className={cn(
          'font-mono font-bold uppercase tracking-[0.2em]',
          strong ? 'text-[11px] text-[var(--color-bone)]' : 'text-[10px] text-[var(--color-bone-muted)]',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'tabular-nums',
          strong
            ? 'text-[20px] font-extrabold leading-none text-[var(--color-bone)]'
            : 'text-[14px] font-bold text-[var(--color-bone)]',
          accent && !strong && 'text-[var(--color-bravo)]',
        )}
      >
        {value}
      </span>
    </div>
  )
}
