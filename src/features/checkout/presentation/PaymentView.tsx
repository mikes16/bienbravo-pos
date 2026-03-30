import { CashIcon, CardIcon, SwapIcon, type PosIconComponent } from '@/shared/pos-ui/GoogleIcon.tsx'
import { cn } from '@/shared/lib/cn.ts'
import { formatMoney } from '@/shared/lib/money.ts'
import type { PaymentMethod } from '../domain/checkout.types.ts'

interface PaymentViewProps {
  total: number
  submitting: boolean
  error: string | null
  onSelect: (method: PaymentMethod) => void
  onBack: () => void
}

const METHODS: { method: PaymentMethod; label: string; icon: PosIconComponent }[] = [
  { method: 'CASH', label: 'Efectivo', icon: CashIcon },
  { method: 'CARD', label: 'Tarjeta', icon: CardIcon },
  { method: 'TRANSFER', label: 'Transferencia', icon: SwapIcon },
]

export function PaymentView({ total, submitting, error, onSelect, onBack }: PaymentViewProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-8 px-6 py-10">
      <button
        type="button"
        onClick={onBack}
        className="self-start rounded-xl px-4 py-2 text-sm text-bb-muted hover:text-bb-text active:scale-[0.97]"
      >
        ← Regresar
      </button>

      <div className="text-center">
        <p className="text-bb-muted">Total a cobrar</p>
        <p className="font-bb-display text-4xl font-bold">{formatMoney(total)}</p>
      </div>

      {error && (
        <p className="rounded-xl bg-bb-danger/10 px-4 py-3 text-sm text-bb-danger">{error}</p>
      )}

      <div className="flex w-full max-w-md flex-col gap-4">
        {METHODS.map(({ method, label, icon: Icon }) => (
          <button
            key={method}
            type="button"
            disabled={submitting}
            onClick={() => onSelect(method)}
            className={cn(
              'flex items-center gap-4 rounded-2xl bg-bb-surface p-5',
              'transition-transform active:scale-[0.97] hover:bg-bb-surface-2',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            <Icon className="h-7 w-7 text-bb-primary" />
            <span className="text-lg font-semibold">{label}</span>
          </button>
        ))}
      </div>

      {submitting && (
        <p className="animate-pulse text-sm text-bb-muted">Procesando venta…</p>
      )}
    </div>
  )
}
