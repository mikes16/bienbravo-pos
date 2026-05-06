import { CatalogTile } from './CatalogTile'
import { CatalogListRow } from './CatalogListRow'

interface CatalogItem {
  id: string
  kind: 'service' | 'product' | 'combo'
  name: string
  priceCents: number
  stockQty?: number
  imageUrl?: string | null
  categoryId: string | null
}

interface CatalogGridProps {
  items: CatalogItem[]
  selectedCategoryId: string | null
  searchQuery: string
  onAdd: (item: CatalogItem) => void
}

export function CatalogGrid({ items, selectedCategoryId, searchQuery, onAdd }: CatalogGridProps) {
  const filtered = items.filter((i) => {
    if (selectedCategoryId && i.categoryId !== selectedCategoryId) return false
    if (searchQuery && !i.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  if (filtered.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-12 text-center">
        <p className="text-[14px] text-[var(--color-bone-muted)]">
          Sin resultados. Cambia de categoría o busca otro nombre.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto">
      {/* Mobile (< sm): list rows. Denser layout for phone-sized screens. */}
      <div className="flex flex-col border-t border-[var(--color-leather-muted)]/40 sm:hidden">
        {filtered.map((item) => (
          <CatalogListRow
            key={item.id}
            kind={item.kind}
            name={item.name}
            priceCents={item.priceCents}
            stockQty={item.stockQty}
            imageUrl={item.imageUrl}
            onAdd={() => onAdd(item)}
          />
        ))}
      </div>

      {/* Tablet (sm) 3 cols, desktop (lg) 4 cols. */}
      <div className="hidden grid-cols-3 items-start gap-3 p-5 sm:grid lg:grid-cols-4">
        {filtered.map((item) => (
          <CatalogTile
            key={item.id}
            kind={item.kind}
            name={item.name}
            priceCents={item.priceCents}
            stockQty={item.stockQty}
            imageUrl={item.imageUrl}
            onAdd={() => onAdd(item)}
          />
        ))}
      </div>
    </div>
  )
}
