import { ShoppingCartIcon, DeleteIcon } from '@/shared/pos-ui/GoogleIcon.tsx'
import { cn } from '@/shared/lib/cn.ts'
import { formatMoney } from '@/shared/lib/money.ts'
import { TapButton, EmptyState } from '@/shared/pos-ui/index.ts'
import type { CartLine } from '../domain/checkout.types.ts'
import type { CustomerResult } from '../data/checkout.repository.ts'
import { CustomerLookup } from './CustomerLookup.tsx'

interface CartBarProps {
  lines: CartLine[]
  tipCents: number
  total: number
  lineCount: number
  onRemove: (lineId: string) => void
  onUpdateQty: (lineId: string, qty: number) => void
  onSetTip: (tipCents: number) => void
  onPay: () => void
  onHold?: () => void
  payDisabled?: boolean
  payDisabledReason?: string | null
  selectedCustomer: CustomerResult | null
  onSelectCustomer: (c: CustomerResult | null) => void
  searchCustomers: (q: string) => Promise<CustomerResult[]>
  onCreateCustomer: (name: string, email: string | null, phone: string | null) => Promise<CustomerResult | null>
  anonymousSelected: boolean
  onSelectAnonymous: () => void
}

const TIP_PRESETS = [0, 2000, 5000, 10000]

export function CartBar({
  lines,
  tipCents,
  total,
  lineCount,
  onRemove,
  onUpdateQty,
  onSetTip,
  onPay,
  onHold,
  payDisabled = false,
  payDisabledReason = null,
  selectedCustomer,
  onSelectCustomer,
  searchCustomers,
  onCreateCustomer,
  anonymousSelected,
  onSelectAnonymous,
}: CartBarProps) {

  if (lines.length === 0) {
    return (
      <div className="flex h-full flex-col gap-3">
        <div className="pt-2">
          <p className="mb-1.5 text-xs font-medium text-bb-muted">Cliente</p>
          <CustomerLookup
            selectedCustomer={selectedCustomer}
            onSelect={onSelectCustomer}
            searchFn={searchCustomers}
            onCreateCustomer={onCreateCustomer}
            anonymousSelected={anonymousSelected}
            onSelectAnonymous={onSelectAnonymous}
          />
        </div>
        <EmptyState
          icon={<ShoppingCartIcon className="h-8 w-8 text-bb-muted" />}
          message="Agrega servicios o productos"
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Customer */}
      <div className="pb-2">
        <p className="mb-1.5 text-xs font-medium text-bb-muted">Cliente</p>
        <CustomerLookup
          selectedCustomer={selectedCustomer}
          onSelect={onSelectCustomer}
          searchFn={searchCustomers}
          onCreateCustomer={onCreateCustomer}
          anonymousSelected={anonymousSelected}
          onSelectAnonymous={onSelectAnonymous}
        />
      </div>

      {/* Line items */}
      <div className="flex-1 space-y-2 overflow-y-auto px-1 py-2">
        {lines.map((line) => (
          <div
            key={line.id}
            className="flex items-center justify-between rounded-xl bg-bb-surface p-3"
          >
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold">{line.catalogItem.item.name}</p>
              <p className="text-xs text-bb-muted">{formatMoney(line.unitPriceCents)} c/u</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onUpdateQty(line.id, line.qty - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-bb-surface-2 text-sm font-bold active:scale-[0.93]"
              >
                −
              </button>
              <span className="w-6 text-center text-sm font-semibold tabular-nums">{line.qty}</span>
              <button
                type="button"
                onClick={() => onUpdateQty(line.id, line.qty + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-bb-surface-2 text-sm font-bold active:scale-[0.93]"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => onRemove(line.id)}
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-bb-danger hover:bg-bb-danger/10"
                aria-label="Eliminar"
              >
                <DeleteIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Tip presets */}
      <div className="border-t border-bb-border px-1 pt-3 pb-2">
        <p className="mb-2 text-xs font-medium text-bb-muted">Propina</p>
        <div className="flex gap-2">
          {TIP_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onSetTip(preset)}
              className={cn(
                'flex-1 rounded-xl py-2 text-xs font-semibold transition-colors',
                tipCents === preset
                  ? 'bg-bb-primary text-white'
                  : 'bg-bb-surface text-bb-muted hover:bg-bb-surface-2',
              )}
            >
              {preset === 0 ? 'Sin' : formatMoney(preset)}
            </button>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="border-t border-bb-border px-1 pt-3 pb-2 space-y-1">
        <div className="flex justify-between text-lg font-bold pt-1 border-t border-bb-border">
          <span>Total a cobrar</span>
          <span>{formatMoney(total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        {onHold && (
          <TapButton size="lg" variant="ghost" className="flex-1" onClick={onHold}>
            Guardar
          </TapButton>
        )}
        <TapButton size="lg" variant="primary" className="flex-1" onClick={onPay} disabled={payDisabled}>
          Cobrar {lineCount} · {formatMoney(total)}
        </TapButton>
      </div>
      {payDisabledReason && (
        <p className="pt-2 text-xs text-bb-danger">{payDisabledReason}</p>
      )}
    </div>
  )
}
