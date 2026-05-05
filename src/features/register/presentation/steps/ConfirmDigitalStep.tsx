import { useState } from 'react'
import { formatMoney } from '@/shared/lib/money'
import { cn } from '@/shared/lib/cn'
import { TouchButton } from '@/shared/pos-ui/TouchButton'

export interface DigitalCounted {
  cardCents: number | null
  transferCents: number | null
}

interface ConfirmDigitalStepProps {
  expectedCardCents: number
  expectedTransferCents: number
  counted: DigitalCounted
  onChange: (next: DigitalCounted) => void
}

interface RowProps {
  label: string
  expected: number
  counted: number | null
  onConfirm: () => void
  onAdjust: (cents: number) => void
}

function ConfirmRow({ label, expected, counted, onConfirm, onAdjust }: RowProps) {
  const [adjusting, setAdjusting] = useState(false)
  const [pesos, setPesos] = useState(Math.round(expected / 100))
  const isConfirmed = counted !== null

  return (
    <div
      className={cn(
        'border p-4',
        isConfirmed
          ? 'border-[var(--color-success)]/40 bg-[var(--color-success)]/[0.04]'
          : 'border-[var(--color-leather-muted)]/40',
      )}
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
        {label}
      </p>
      <p className="mt-1 text-[13px] text-[var(--color-bone-muted)]">
        Esperado del sistema:{' '}
        <strong className="text-[var(--color-bone)]">{formatMoney(expected)}</strong>
      </p>

      {adjusting ? (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-2 border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2">
            <span className="text-[var(--color-bone-muted)]">$</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={pesos}
              onChange={(e) => setPesos(Math.max(0, Number(e.target.value || '0')))}
              className="w-24 bg-transparent text-right text-[16px] font-bold tabular-nums text-[var(--color-bone)] outline-none"
              aria-label={`Monto contado de ${label.toLowerCase()}`}
            />
          </div>
          <TouchButton
            variant="primary"
            size="min"
            onClick={() => {
              onAdjust(pesos * 100)
              setAdjusting(false)
            }}
            className="rounded-none"
          >
            Guardar
          </TouchButton>
        </div>
      ) : isConfirmed ? (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[13px] text-[var(--color-success)]">
            ✓ Confirmado: {formatMoney(counted!)}
          </span>
          <button
            type="button"
            onClick={() => {
              setPesos(Math.round((counted ?? expected) / 100))
              setAdjusting(true)
            }}
            className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
          >
            Ajustar →
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <TouchButton
            variant="secondary"
            size="secondary"
            onClick={onConfirm}
            className="flex-1 tabular-nums"
          >
            Sí, {formatMoney(expected)}
          </TouchButton>
          <button
            type="button"
            onClick={() => {
              setPesos(Math.round(expected / 100))
              setAdjusting(true)
            }}
            className="cursor-pointer border border-[var(--color-leather-muted)] px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)]"
          >
            Ajustar →
          </button>
        </div>
      )}
    </div>
  )
}

export function ConfirmDigitalStep({
  expectedCardCents,
  expectedTransferCents,
  counted,
  onChange,
}: ConfirmDigitalStepProps) {
  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      <p className="font-[var(--font-pos-display)] text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--color-bone)]">
        Confirma los totales digitales
      </p>
      <p className="max-w-[540px] text-[13px] text-[var(--color-bone-muted)]">
        Tarjeta y Stripe los reconcilias contra el sistema externo. Solo confirmar; ajustar si hubo
        un cobro fallido o reverso.
      </p>

      <ConfirmRow
        label="TARJETA"
        expected={expectedCardCents}
        counted={counted.cardCents}
        onConfirm={() => onChange({ ...counted, cardCents: expectedCardCents })}
        onAdjust={(cents) => onChange({ ...counted, cardCents: cents })}
      />
      <ConfirmRow
        label="STRIPE"
        expected={expectedTransferCents}
        counted={counted.transferCents}
        onConfirm={() => onChange({ ...counted, transferCents: expectedTransferCents })}
        onAdjust={(cents) => onChange({ ...counted, transferCents: cents })}
      />
    </div>
  )
}
