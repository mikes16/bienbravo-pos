import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { MoneyDisplay } from '@/shared/pos-ui/MoneyDisplay'
import { CashCounter } from '@/shared/cash'
import { type CashCounts, emptyCashCounts, totalCountedCents } from '@/shared/cash/cashCounts'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'

export function OpenCajaPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const registerId = params.get('reg') ?? ''
  const { register } = useRepositories()
  const { viewer } = usePosAuth()
  // Defensive: gate by deeplink. CajaPage también gatea, esto es por si
  // alguien navega directo con la URL. Solo bloqueamos cuando estamos
  // SEGUROS que el viewer ya cargó y no tiene el perm — si todavía está
  // cargando (viewer === null), dejamos pasar para no romper SSR / tests
  // que renderizan antes del fetch del viewer.
  const hasOpenPerm = !viewer || viewer.permissions.includes('pos.register.open')

  // Hooks PRIMERO — react-hooks/rules-of-hooks no permite que un return
  // condicional preceda a useState. El early-return de gating se hace después.
  const [counts, setCounts] = useState<CashCounts>(emptyCashCounts())
  const [explicitZero, setExplicitZero] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!hasOpenPerm) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-bone-muted)]">
            Sin acceso
          </p>
          <h1 className="mb-2 text-2xl font-bold text-[var(--color-bone)]">Abrir caja</h1>
          <p className="mb-4 text-sm text-[var(--color-bone-muted)]">
            Tu rol no incluye <code className="font-mono text-[var(--color-bone)]">pos.register.open</code>.
          </p>
          <TouchButton variant="secondary" size="min" onClick={() => navigate('/caja')}>
            ← Volver
          </TouchButton>
        </div>
      </div>
    )
  }

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

  // Copy consistente del CTA — siempre dice el monto, incluso cuando es $0.
  // El disabled state comunica "no puedes proceder", no el texto. Antes
  // disabled mostraba "Selecciona el fondo" que se sentía como una acción
  // distinta y confundía.
  const ctaLabel = submitting
    ? 'Abriendo…'
    : explicitZero && cents === 0
      ? 'Abrir caja sin fondo →'
      : `Abrir caja · ${formatMoney(cents)} →`

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
        <p className="max-w-[480px] text-[13px] text-[var(--color-bone-muted)]">
          Cuenta los billetes y monedas de tu fondo.
        </p>

        {/* Hero: total prominent — el dato más importante de la pantalla.
            Crece en vivo mientras el cajero cuenta. Label arriba en eyebrow
            mono, total enorme abajo en display. */}
        <div className="flex flex-col gap-2 border-y border-[var(--color-leather-muted)]/40 py-5 sm:py-6">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
            Fondo inicial
          </span>
          <MoneyDisplay cents={cents} size="L" className="sm:text-[var(--pos-text-numeral-xl)]" />
        </div>

        <CashCounter
          counts={counts}
          onChange={(next) => {
            setCounts(next)
            if (totalCountedCents(next) > 0) setExplicitZero(false)
          }}
        />

        {error && (
          <div role="alert" className="border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/[0.06] px-4 py-3">
            <p className="text-[13px] text-[var(--color-bravo)]">{error}</p>
          </div>
        )}
      </div>

      {/* CTA bar — botón primario + toggle táctil para abrir sin fondo. El
          toggle reemplaza el checkbox grande del cuerpo: es un edge case,
          pero como vivimos en tablet touch debe cumplir el mínimo de 44px
          de tap target. Por eso le doy min-h y padding generoso, manteniendo
          el peso visual subordinado al CTA primario. */}
      <div className={cn(
        'col-start-1 row-start-2 flex flex-col gap-1 border-t border-[var(--color-leather-muted)]/40',
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
        <button
          type="button"
          onClick={() => {
            const next = !explicitZero
            setExplicitZero(next)
            if (next) setCounts(emptyCashCounts())
          }}
          aria-pressed={explicitZero}
          className={cn(
            'flex min-h-[44px] cursor-pointer items-center justify-center self-stretch px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.22em] underline-offset-4 transition-colors',
            explicitZero
              ? 'text-[var(--color-bravo)] underline'
              : 'text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]',
          )}
        >
          <span className="inline-flex items-center gap-2">
            {explicitZero && (
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 bg-[var(--color-bravo)]"
              />
            )}
            Abrir sin fondo · caja vacía
          </span>
        </button>
      </div>
    </div>
  )
}
