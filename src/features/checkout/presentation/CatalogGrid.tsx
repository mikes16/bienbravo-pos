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
  // Servicios y COMBOS: IDs de barberos que NO realizan/ofrecen este item. Si el
  // barbero atendiendo actual está en la lista, la card se OCULTA del grid (y
  // de los resultados de búsqueda). Vacío/undefined para productos.
  excludedStaffIds?: string[]
}

interface PriceOverlayEntry {
  priceCents: number
  isExcluded: boolean
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
  // Overlay de precios por barbero (capa LIVE). Map serviceId → precio/exclusión
  // resueltos para el atendiendo. Cuando existe, la card muestra `priceCents` del
  // overlay en vez del precio estático (congelado en el del viewer). Productos y
  // servicios sin entrada caen al precio estático.
  priceOverlay?: Map<string, PriceOverlayEntry> | null
  // ¿El overlay corresponde al atendiendo ACTUAL? Solo entonces usamos su
  // `isExcluded` para el filtro (es lo más fresco); si es stale, el filtro cae
  // al estático `excludedStaffIds`, que ya reacciona al atendiendo actual.
  overlayFresh?: boolean
  // Trayendo el overlay del nuevo atendiendo: atenuamos los precios para no
  // mostrar los del barbero anterior "como actuales" (patrón previousData).
  pricesUpdating?: boolean
}

export function CatalogGrid({
  items,
  selectedCategoryId,
  searchQuery,
  onAdd,
  attendingBarberId,
  attendingBarberName,
  priceOverlay,
  overlayFresh,
  pricesUpdating,
}: CatalogGridProps) {
  const q = searchQuery.trim().toLowerCase()
  // Precio de display: overlay del atendiendo si existe, si no el estático.
  const displayPrice = (item: CatalogItem): number =>
    priceOverlay?.get(item.id)?.priceCents ?? item.priceCents
  // ¿El servicio o combo queda excluido para el atendiendo? Preferimos el overlay
  // cuando es fresco (más actual que el staffOverrides estático); si no, caemos
  // al estático, que ya es reactivo al atendiendo. Productos nunca se excluyen.
  const isExcludedForAttending = (item: CatalogItem): boolean => {
    if ((item.kind !== 'service' && item.kind !== 'combo') || !attendingBarberId) return false
    const ov = overlayFresh ? priceOverlay?.get(item.id) : undefined
    if (ov) return ov.isExcluded
    return item.excludedStaffIds?.includes(attendingBarberId) ?? false
  }
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
  const filtered = matching.filter((i) => !isExcludedForAttending(i))

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
            priceCents={displayPrice(item)}
            updating={pricesUpdating}
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
            priceCents={displayPrice(item)}
            updating={pricesUpdating}
            stockQty={item.stockQty}
            imageUrl={item.imageUrl}
            onAdd={() => onAdd(item)}
          />
        ))}
      </div>
    </div>
  )
}
