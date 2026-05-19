import { useState } from 'react'
import { formatMoney } from '@/shared/lib/money'
import type { AppliedCouponPreview } from '../data/checkout.repository'

interface CouponsBlockProps {
  appliedCoupons: AppliedCouponPreview[]
  couponError: string | null
  onApply: (code: string) => void | Promise<void>
  onRemove: (code: string) => void | Promise<void>
  /**
   * Cuando `false`, el bloque no se renderiza. Esto evita que cajeros sin
   * permiso `pos.discount.apply` vean siquiera el input — la UX es más
   * limpia que esconder/disable elementos individuales. La validación
   * real corre server-side (el API también valida el permiso).
   */
  canApply: boolean
}

// Etiquetas humanizadas para el scope del cupón. El API devuelve el enum
// crudo (`SERVICE`, `PRODUCT`, `ALL`, etc.) — el chip muestra texto en
// español. Si el scope llega como algo desconocido, lo mostramos tal cual.
const SCOPE_LABEL: Record<string, string> = {
  SERVICE: 'Servicios',
  PRODUCT: 'Productos',
  ALL: 'Todo',
  CATEGORY: 'Categoría',
  ITEM: 'Item específico',
}

function scopeLabel(scope: string): string {
  return SCOPE_LABEL[scope] ?? scope
}

export function CouponsBlock({
  appliedCoupons,
  couponError,
  onApply,
  onRemove,
  canApply,
}: CouponsBlockProps) {
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!canApply) return null

  const handleApply = async () => {
    if (!code.trim() || submitting) return
    setSubmitting(true)
    try {
      await onApply(code.trim())
      // Solo limpiamos el input si la promesa resolvió. Si hubo error de
      // validación, el código sigue visible para que el cajero edite/reintente.
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--color-leather-muted)]/40 px-4 py-3">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
        Cupones
      </div>

      {appliedCoupons.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {appliedCoupons.map((c) => (
            <li
              key={c.code}
              className="flex items-center justify-between border border-[var(--color-success)]/40 bg-[var(--color-success)]/[0.08] px-3 py-2"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-success)]">
                  {c.code}
                </span>
                <span className="truncate text-[12px] text-[var(--color-bone)]">
                  {c.name} · {scopeLabel(c.scope)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3 pl-2">
                <span className="font-mono text-[13px] font-bold tabular-nums text-[var(--color-success)]">
                  −{formatMoney(c.discountAmountCents)}
                </span>
                <button
                  type="button"
                  onClick={() => void onRemove(c.code)}
                  aria-label={`Quitar cupón ${c.code}`}
                  className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] hover:text-[var(--color-bravo)]"
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleApply()
            }
          }}
          placeholder="Código de cupón"
          aria-label="Código de cupón"
          disabled={submitting}
          className="min-w-0 flex-1 border border-[var(--color-leather-muted)]/60 bg-[var(--color-carbon)] px-3 py-2 font-mono text-[13px] uppercase tracking-[0.12em] text-[var(--color-bone)] placeholder:text-[var(--color-bone-muted)]/50 focus:border-[var(--color-bravo)] focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void handleApply()}
          disabled={!code.trim() || submitting}
          className="cursor-pointer bg-[var(--color-bravo)] px-4 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone)] hover:bg-[var(--color-bravo-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? '…' : 'Aplicar'}
        </button>
      </div>

      {couponError && (
        <p
          role="alert"
          className="text-[12px] leading-snug text-[var(--color-bravo)]"
        >
          {couponError}
        </p>
      )}
    </div>
  )
}
