import { CatalogTile } from './CatalogTile'

interface CatalogItem {
  id: string
  kind: 'service' | 'product' | 'combo'
  name: string
  priceCents: number
  stockQty?: number
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
    <div className="grid grid-cols-3 gap-3 overflow-y-auto p-5">
      {filtered.map((item) => (
        <CatalogTile
          key={item.id}
          kind={item.kind}
          name={item.name}
          priceCents={item.priceCents}
          stockQty={item.stockQty}
          onAdd={() => onAdd(item)}
        />
      ))}
    </div>
  )
}
