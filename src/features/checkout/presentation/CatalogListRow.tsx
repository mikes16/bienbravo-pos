import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'

interface CatalogListRowProps {
  kind: 'service' | 'product' | 'combo'
  name: string
  priceCents: number
  stockQty?: number
  imageUrl?: string | null
  onAdd: () => void
}

const LOW_STOCK_THRESHOLD = 5

export function CatalogListRow({ kind, name, priceCents, stockQty, imageUrl, onAdd }: CatalogListRowProps) {
  const isOutOfStock = kind === 'product' && stockQty === 0
  const isLowStock = kind === 'product' && typeof stockQty === 'number' && stockQty > 0 && stockQty <= LOW_STOCK_THRESHOLD

  return (
    <button
      type="button"
      disabled={isOutOfStock}
      onClick={onAdd}
      className={cn(
        'flex w-full items-center gap-3 border-b border-[var(--color-leather-muted)]/40 px-4 py-3 text-left transition-colors last:border-b-0',
        isOutOfStock
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:bg-[var(--color-cuero-viejo)]',
      )}
    >
      <div
        className="relative h-20 w-20 shrink-0 overflow-hidden bg-[var(--color-carbon)]"
        style={
          imageUrl
            ? {
                backgroundImage: `url(${encodeURI(imageUrl)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {kind === 'combo' && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">
            COMBO
          </span>
        )}
        <span className="truncate text-[15px] font-bold text-[var(--color-bone)]">{name}</span>
        {isOutOfStock && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--color-bravo)]">
            agotado
          </span>
        )}
        {isLowStock && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--color-warning)]">
            {stockQty} left
          </span>
        )}
      </div>

      <span className="shrink-0 text-[18px] font-extrabold tabular-nums text-[var(--color-bone)]">
        {formatMoney(priceCents)}
      </span>
    </button>
  )
}
