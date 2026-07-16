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
  // Solo servicios: IDs de barberos que NO realizan este servicio. Si el
  // barbero atendiendo actual está en la lista, la card se OCULTA del grid (y
  // de los resultados de búsqueda). Vacío/undefined para productos y combos.
  excludedStaffIds?: string[]
}

interface CatalogGridProps {
  items: CatalogItem[]
  selectedCategoryId: string | null
  searchQuery: string
  onAdd: (item: CatalogItem) => void
  // Barbero atendiendo la venta (default barber). Cuando está presente, los
  // SERVICIOS que ese barbero no realiza (su id en excludedStaffIds) se ocultan
  // del grid — decisión del dueño: ocultar en todas partes, nunca mostrar $0.
  // Null = venta sin barbero atendiendo → no se oculta nada.
  attendingBarberId?: string | null
  // Nombre del barbero atendiendo, solo para el empty-state cuando TODO el grid
  // quedó oculto por exclusión.
  attendingBarberName?: string | null
}

export function CatalogGrid({
  items,
  selectedCategoryId,
  searchQuery,
  onAdd,
  attendingBarberId,
  attendingBarberName,
}: CatalogGridProps) {
  const q = searchQuery.trim().toLowerCase()
  // 1) Búsqueda global (reemplaza al viejo chip "Todo") o filtro por la
  //    categoría seleccionada.
  const matching = items.filter((i) => {
    if (q) return i.name.toLowerCase().includes(q)
    return !selectedCategoryId || i.categoryId === selectedCategoryId
  })
  // 2) Oculta los servicios que el barbero atendiendo no realiza. Solo aplica a
  //    servicios (productos/combos no tienen exclusión) y solo cuando hay
  //    barbero atendiendo. Esto apaga el bug de $0 de raíz: la card se resolvía
  //    para el atendiendo, así que un servicio excluido mostraba $0.
  const filtered = attendingBarberId
    ? matching.filter(
        (i) => !(i.kind === 'service' && i.excludedStaffIds?.includes(attendingBarberId)),
      )
    : matching

  if (filtered.length === 0) {
    // Si había items en esta categoría/búsqueda pero TODOS quedaron ocultos por
    // exclusión del atendiendo, dirige a cambiar de barbero (no a "sin
    // resultados", que sugiere cambiar de categoría o buscar otro nombre).
    const hiddenByExclusion = !!attendingBarberId && matching.length > 0
    return (
      <div className="flex h-full items-center justify-center px-6 py-12 text-center">
        <p className="text-[14px] text-[var(--color-bone-muted)]">
          {hiddenByExclusion && attendingBarberName
            ? `${attendingBarberName} no ofrece servicios. Cambia de barbero.`
            : 'Sin resultados. Cambia de categoría o busca otro nombre.'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
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
