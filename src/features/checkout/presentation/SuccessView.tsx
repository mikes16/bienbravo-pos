import { SuccessIcon } from '@/shared/pos-ui/GoogleIcon.tsx'
import { cn } from '@/shared/lib/cn.ts'
import { formatMoney } from '@/shared/lib/money.ts'
import type { SaleResult } from '../domain/checkout.types.ts'

interface SuccessViewProps {
  sale: SaleResult
  onNewSale: () => void
  onGoHome: () => void
}

export function SuccessView({ sale, onNewSale, onGoHome }: SuccessViewProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-10">
      <SuccessIcon className="h-16 w-16 text-green-500" />
      <div className="text-center">
        <h2 className="font-bb-display text-2xl font-bold">¡Venta completada!</h2>
        <p className="mt-1 text-bb-muted">Total cobrado: {formatMoney(sale.totalCents)}</p>
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={onNewSale}
          className={cn(
            'rounded-2xl bg-bb-primary px-8 py-4 text-base font-bold text-white',
            'transition-transform active:scale-[0.97]',
          )}
        >
          Nueva Venta
        </button>
        <button
          type="button"
          onClick={onGoHome}
          className={cn(
            'rounded-2xl bg-bb-surface px-8 py-4 text-base font-semibold',
            'transition-transform active:scale-[0.97] hover:bg-bb-surface-2',
          )}
        >
          Inicio
        </button>
      </div>
    </div>
  )
}
