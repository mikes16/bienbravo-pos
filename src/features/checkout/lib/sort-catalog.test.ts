import { describe, it, expect } from 'vitest'
import { sortCatalogItems } from './sort-catalog'

const cats = [
  { id: 'cat-cortes', sortOrder: 0 },
  { id: 'cat-prod', sortOrder: 1 },
]

describe('sortCatalogItems', () => {
  it('ordena por (orden de categoría, sortOrder, nombre)', () => {
    const items = [
      { name: 'Shampoo', sortOrder: 1, categoryId: 'cat-prod' },
      { name: 'Fade', sortOrder: 1, categoryId: 'cat-cortes' },
      { name: 'Corte', sortOrder: 0, categoryId: 'cat-cortes' },
      { name: 'Pomada', sortOrder: 0, categoryId: 'cat-prod' },
    ]
    expect(sortCatalogItems(items, cats).map((i) => i.name)).toEqual(['Corte', 'Fade', 'Pomada', 'Shampoo'])
  })

  it('los ítems sin categoría van al final (grupo Otros)', () => {
    const items = [
      { name: 'Sin cat', sortOrder: 0, categoryId: null },
      { name: 'Corte', sortOrder: 0, categoryId: 'cat-cortes' },
    ]
    expect(sortCatalogItems(items, cats).map((i) => i.name)).toEqual(['Corte', 'Sin cat'])
  })

  it('desempata por nombre cuando sortOrder empata', () => {
    const items = [
      { name: 'B', sortOrder: 0, categoryId: 'cat-cortes' },
      { name: 'A', sortOrder: 0, categoryId: 'cat-cortes' },
    ]
    expect(sortCatalogItems(items, cats).map((i) => i.name)).toEqual(['A', 'B'])
  })
})
