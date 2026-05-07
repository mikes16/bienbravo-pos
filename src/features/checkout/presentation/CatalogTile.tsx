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
    <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
      <button
        type="button"
        disabled={isOutOfStock}
        onClick={onAdd}
        className={cn(
          // Border is always 1px so the hover state can change colour
          // without shifting the content (box-sizing: border-box was
          // visibly compressing each tile by 1px on tap, leaving a thin
          // light line operators read as a "weird white margin"). Default
          // colour is transparent for image tiles (no visible chrome) and
          // leather-muted for empty / no-image tiles to keep the existing
          // visual. focus-visible only — touch / mouse taps don't show an
          // outline because the persistent ring on tablet looked like a
          // border bug.
          'absolute inset-0 flex flex-col items-start justify-between overflow-hidden border bg-[var(--color-carbon-elevated)] p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-bravo)]',
          imageUrl
            ? 'border-transparent'
            : 'border-[var(--color-leather-muted)]/40',
          isOutOfStock
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer hover:border-[var(--color-bravo)]',
        )}
        style={
          imageUrl
            ? {
                backgroundImage: `url(${encodeURI(imageUrl)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
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
      </button>
    </div>
  )
}
