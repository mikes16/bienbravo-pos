import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { MoneyDisplay } from '@/shared/pos-ui/MoneyDisplay'
import { CashCounter } from '@/shared/cash'
import { type CashCounts, emptyCashCounts, totalCountedCents } from '@/shared/cash/cashCounts'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'

export function OpenCajaPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const registerId = params.get('reg') ?? ''
  const { register } = useRepositories()
  const [counts, setCounts] = useState<CashCounts>(emptyCashCounts())
  const [explicitZero, setExplicitZero] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cents = totalCountedCents(counts)
  const canOpen = !!registerId && (cents > 0 || explicitZero) && !submitting

  const handleSubmit = async () => {
    if (!registerId || submitting) return
    if (cents <= 0 && !explicitZero) return
    setSubmitting(true)
    setError(null)
    try {
      await register.openSession(registerId, cents)
      navigate('/caja')
    } catch (e) {
      const msg =
        (e as { message?: string }).message ??
        'No se pudo abrir la caja. Intenta de nuevo.'
      setError(msg)
      setSubmitting(false)
    }
  }

  const ctaLabel = submitting
    ? 'Abriendo…'
    : explicitZero && cents === 0
      ? 'Abrir sin fondo →'
      : cents > 0
        ? `Abrir caja · ${formatMoney(cents)} →`
        : 'Selecciona el fondo →'

  return (
    <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[1fr_auto]">
      {/* Scroll area: header, fondo display, denomination counter, sin-fondo, error */}
      <div className="col-start-1 row-start-1 flex flex-col gap-4 overflow-y-auto px-5 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 lg:px-10 lg:py-6">
        <button
          type="button"
          onClick={() => navigate('/caja')}
          className="self-start cursor-pointer font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
        >
          ← Cancelar
        </button>

        <p className="font-[var(--font-pos-display)] text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--color-bone)] sm:text-[28px]">
          Abrir caja
        </p>
        <p className="max-w-[480px] text-[12px] text-[var(--color-bone-muted)] sm:text-[13px]">
          Cuenta los billetes que dejaste de fondo. Toca + por cada billete, o tap el número para escribir cantidad. Las monedas van en una sola línea.
        </p>

        <div className="flex flex-col gap-2 border-y border-[var(--color-leather-muted)]/40 py-3 sm:py-4">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
            Fondo inicial
          </span>
          <MoneyDisplay cents={cents} size="M" className="sm:text-[var(--pos-text-numeral-l)]" />
        </div>

        <CashCounter
          counts={counts}
          onChange={(next) => {
            setCounts(next)
            if (totalCountedCents(next) > 0) setExplicitZero(false)
          }}
        />

        <label className="flex cursor-pointer items-center gap-3 border border-dashed border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 py-3">
          <input
            type="checkbox"
            checked={explicitZero}
            onChange={(e) => {
              setExplicitZero(e.target.checked)
              if (e.target.checked) setCounts(emptyCashCounts())
            }}
            className="h-4 w-4 cursor-pointer accent-[var(--color-bravo)]"
          />
          <span className="flex flex-col leading-tight">
            <span className="text-[14px] font-bold text-[var(--color-bone)]">Abrir sin fondo</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
              caja vacía
            </span>
          </span>
        </label>

        {error && (
          <div role="alert" className="border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/[0.06] px-4 py-3">
            <p className="text-[13px] text-[var(--color-bravo)]">{error}</p>
          </div>
        )}
      </div>

      {/* CTA bar */}
      <div className={cn(
        'col-start-1 row-start-2 border-t border-[var(--color-leather-muted)]/40',
        'bg-[var(--color-carbon)] px-5 py-3 sm:px-6 lg:px-10 lg:py-4',
      )}>
        <TouchButton
          variant="primary"
          size="primary"
          disabled={!canOpen}
          onClick={handleSubmit}
          aria-label={ctaLabel}
          className="w-full rounded-none uppercase tracking-[0.06em]"
        >
          {ctaLabel}
        </TouchButton>
      </div>
    </div>
  )
}
