export interface SortableItem {
  name: string
  sortOrder: number
  categoryId: string | null
}

// Orden del POS: primero por el orden de la categoría (las sin categoría al final,
// grupo "Otros"), luego por la posición del ítem dentro de su categoría, y
// finalmente alfabético como desempate estable.
export function sortCatalogItems<T extends SortableItem>(
  items: T[],
  categories: { id: string; sortOrder: number }[],
): T[] {
  const catOrder = new Map(categories.map((c) => [c.id, c.sortOrder]))
  const rank = (categoryId: string | null): number =>
    categoryId != null && catOrder.has(categoryId) ? catOrder.get(categoryId)! : Number.MAX_SAFE_INTEGER
  return items.slice().sort((a, b) => {
    const ca = rank(a.categoryId)
    const cb = rank(b.categoryId)
    if (ca !== cb) return ca - cb
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.name.localeCompare(b.name)
  })
}
