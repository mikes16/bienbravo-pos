import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'

interface CatalogTileProps {
  kind: 'service' | 'product' | 'combo'
  name: string
  priceCents: number
  stockQty?: number
  onAdd: () => void
}

const LOW_STOCK_THRESHOLD = 5

export function CatalogTile({ kind, name, priceCents, stockQty, onAdd }: CatalogTileProps) {
  const isOutOfStock = kind === 'product' && stockQty === 0
  const isLowStock = kind === 'product' && typeof stockQty === 'number' && stockQty > 0 && stockQty <= LOW_STOCK_THRESHOLD

  return (
    <button
      type="button"
      disabled={isOutOfStock}
      onClick={onAdd}
      className={cn(
        'flex flex-col items-start justify-between border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] p-3 text-left transition-colors',
        isOutOfStock
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:border-[var(--color-bravo)] hover:bg-[var(--color-cuero-viejo)]',
      )}
      style={{ aspectRatio: '1 / 1' }}
    >
      <div className="flex flex-col gap-1">
        {kind === 'combo' && (
          <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">COMBO</span>
        )}
        <span className="text-[14px] font-bold leading-tight text-[var(--color-bone)]">{name}</span>
      </div>
      <div className="flex w-full items-end justify-between">
        <span className="text-[18px] font-extrabold tabular-nums text-[var(--color-bone)]">
          {formatMoney(priceCents)}
        </span>
        {isLowStock && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--color-warning)]">
            {stockQty} left
          </span>
        )}
        {isOutOfStock && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--color-bravo)]">
            agotado
          </span>
        )}
      </div>
    </button>
  )
}
