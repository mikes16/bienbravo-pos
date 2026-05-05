import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'

interface CatalogTileProps {
  kind: 'service' | 'product' | 'combo'
  name: string
  priceCents: number
  stockQty?: number
  imageUrl?: string | null
  onAdd: () => void
}

const LOW_STOCK_THRESHOLD = 5

export function CatalogTile({ kind, name, priceCents, stockQty, imageUrl, onAdd }: CatalogTileProps) {
  const isOutOfStock = kind === 'product' && stockQty === 0
  const isLowStock = kind === 'product' && typeof stockQty === 'number' && stockQty > 0 && stockQty <= LOW_STOCK_THRESHOLD

  return (
    <button
      type="button"
      disabled={isOutOfStock}
      onClick={onAdd}
      className={cn(
        'relative block aspect-square w-full overflow-hidden border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] text-left transition-colors',
        isOutOfStock
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:border-[var(--color-bravo)]',
      )}
    >
      {imageUrl && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/0"
          />
        </>
      )}
      <div className="absolute inset-0 flex flex-col items-start justify-between p-3">
        <div className="flex flex-col gap-1">
          {kind === 'combo' && (
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">COMBO</span>
          )}
          <span className="text-[14px] font-bold leading-tight text-[var(--color-bone)] [text-shadow:_0_1px_2px_rgba(0,0,0,0.7)]">{name}</span>
        </div>
        <div className="flex w-full items-end justify-between">
          <span className="text-[18px] font-extrabold tabular-nums text-[var(--color-bone)] [text-shadow:_0_1px_2px_rgba(0,0,0,0.7)]">
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
      </div>
    </button>
  )
}
