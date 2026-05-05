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
      className="flex h-full flex-col gap-4 px-6 py-5 outline-none"
    >
      <button
        type="button"
        onClick={() => navigate('/caja')}
        className="self-start cursor-pointer font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
      >
        ← Cancelar
      </button>

      <p className="font-[var(--font-pos-display)] text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--color-bone)]">
        Abrir caja
      </p>
      <p className="max-w-[480px] text-[13px] text-[var(--color-bone-muted)]">
        ¿Con cuánto efectivo abre el día? Al cerrar se descuenta para calcular las ventas reales.
      </p>

      <div className="flex flex-col gap-2 border-y border-[var(--color-leather-muted)]/40 py-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
          Fondo inicial
        </span>
        <MoneyDisplay cents={cents} size="L" />
      </div>

      <div className="flex gap-2">
        {/* $0 — sin fondo: explicit safety opt-out chip, visually distinct with dashed border */}
        <TouchButton
          variant="secondary"
          size="min"
          onClick={() => { setCents(0); setExplicitZero(true) }}
          className={cn(
            'flex-1 border-dashed tabular-nums',
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
              'flex-1 tabular-nums',
              cents === p && !explicitZero &&
                'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
            )}
          >
            {formatMoney(p)}
          </TouchButton>
        ))}
      </div>

      <div className="flex justify-center">
        <Numpad onKey={onKey} allowDecimal={false} />
      </div>

      {error && (
        <p role="alert" className="text-[12px] text-[var(--color-bravo)]">
          {error}
        </p>
      )}

      <TouchButton
        variant="primary"
        size="primary"
        disabled={!canOpen}
        onClick={handleSubmit}
        aria-label={ctaLabel}
        className="mt-auto rounded-none uppercase tracking-[0.06em]"
      >
        {ctaLabel}
      </TouchButton>
    </div>
  )
}
