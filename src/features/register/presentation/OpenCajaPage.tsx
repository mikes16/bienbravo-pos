import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Numpad, type NumpadKey } from '@/shared/pos-ui'
import { MoneyDisplay } from '@/shared/pos-ui/MoneyDisplay'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'

const PRESETS_CENTS = [20000, 50000, 100000, 200000]

export function OpenCajaPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const registerId = params.get('reg') ?? ''
  const { register } = useRepositories()
  const [cents, setCents] = useState(0)
  const [explicitZero, setExplicitZero] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const onKey = (k: NumpadKey) => {
    if (k === '.') return
    setExplicitZero(false)
    if (k === 'backspace') {
      setCents((c) => Math.floor(c / 10))
      return
    }
    setCents((c) => c * 10 + Number(k))
  }

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

  const onPhysicalKey: React.KeyboardEventHandler = (e) => {
    if (e.key >= '0' && e.key <= '9') {
      onKey(e.key as NumpadKey)
      e.preventDefault()
    } else if (e.key === 'Backspace') {
      onKey('backspace')
      e.preventDefault()
    } else if (e.key === 'Enter' && (cents > 0 || explicitZero) && !submitting) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const canOpen = (cents > 0 || explicitZero) && !submitting

  const ctaLabel = submitting
    ? 'Abriendo…'
    : explicitZero && cents === 0
      ? 'Abrir caja sin fondo →'
      : cents > 0
        ? `Abrir caja · ${formatMoney(cents)} →`
        : 'Selecciona el fondo →'

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onPhysicalKey}
      className={cn(
        'grid h-full min-h-0 outline-none',
        // Mobile / tablet portrait: 3 stacked rows — scroll / numpad / cta
        'grid-cols-1 grid-rows-[1fr_auto_auto]',
        // Tablet landscape & desktop: 2 cols, numpad sidebar spans full height on right
        'lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:grid-rows-[1fr_auto]',
      )}
    >
      {/* SCROLL AREA — header, description, fondo display, presets, error.
          Mobile: row 1. Landscape: row 1, col 1. */}
      <div
        className={cn(
          'col-start-1 row-start-1 flex flex-col gap-4 overflow-y-auto',
          'px-5 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 lg:px-10 lg:py-6',
        )}
      >
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
          ¿Con cuánto efectivo abre el día? Al cerrar se descuenta para calcular las ventas reales.
        </p>

        <div className="flex flex-col gap-2 border-y border-[var(--color-leather-muted)]/40 py-3 sm:py-4">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
            Fondo inicial
          </span>
          {/* Numeral-L (88px) is loud on mobile; keep it tight there, full size from sm. */}
          <MoneyDisplay cents={cents} size="M" className="sm:text-[var(--pos-text-numeral-l)]" />
        </div>

        {/* Presets — 3-col on mobile (wraps: 3 + 2), 5-col single row on sm+. */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {/* $0 — sin fondo: explicit safety opt-out chip, visually distinct with dashed border */}
          <TouchButton
            variant="secondary"
            size="min"
            onClick={() => { setCents(0); setExplicitZero(true) }}
            className={cn(
              'border-dashed tabular-nums',
              explicitZero && cents === 0
                ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]'
                : 'text-[var(--color-bone-muted)]',
            )}
          >
            <span className="flex flex-col items-center leading-none">
              <span>$0</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em]">sin fondo</span>
            </span>
          </TouchButton>

          {PRESETS_CENTS.map((p) => (
            <TouchButton
              key={p}
              variant="secondary"
              size="min"
              onClick={() => { setCents(p); setExplicitZero(false) }}
              className={cn(
                'tabular-nums',
                cents === p && !explicitZero &&
                  'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
              )}
            >
              {formatMoney(p)}
            </TouchButton>
          ))}
        </div>

        {error && (
          <div role="alert" className="border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/[0.06] px-4 py-3">
            <p className="text-[13px] text-[var(--color-bravo)]">{error}</p>
          </div>
        )}
      </div>

      {/* NUMPAD — single instance.
          Mobile/tablet portrait: row 2, between scroll and CTA, centered.
          Landscape (lg+): col 2, spans both rows, centered, with left divider. */}
      <div
        className={cn(
          'col-start-1 row-start-2 flex justify-center px-5 pb-3 sm:px-6 sm:pb-4',
          'lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:items-center lg:px-6 lg:py-6',
          'lg:border-l lg:border-[var(--color-leather-muted)]/40',
        )}
      >
        <Numpad onKey={onKey} allowDecimal={false} />
      </div>

      {/* CTA bar — pinned at bottom of its column.
          Mobile: row 3, full width above bottom-tab-nav.
          Landscape: row 2, col 1 (below scroll, beside numpad). */}
      <div
        className={cn(
          'col-start-1 row-start-3 border-t border-[var(--color-leather-muted)]/40',
          'bg-[var(--color-carbon)] px-5 py-3 sm:px-6 lg:row-start-2 lg:px-10 lg:py-4',
        )}
      >
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
