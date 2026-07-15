import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CatalogGrid } from './CatalogGrid'

const ITEMS = [
  { id: 's1', kind: 'service' as const, name: 'Corte', priceCents: 28000, imageUrl: null, categoryId: 'cat-1' },
  { id: 'p1', kind: 'product' as const, name: 'Pomada', priceCents: 25000, imageUrl: null, categoryId: 'cat-2' },
]

describe('CatalogGrid', () => {
  it('sin búsqueda filtra por la categoría seleccionada', () => {
    render(<CatalogGrid items={ITEMS} selectedCategoryId="cat-1" searchQuery="" onAdd={() => {}} />)
    expect(screen.getAllByText('Corte').length).toBeGreaterThan(0)
    expect(screen.queryByText('Pomada')).not.toBeInTheDocument()
  })

  it('con búsqueda ignora el chip seleccionado (búsqueda global)', () => {
    render(<CatalogGrid items={ITEMS} selectedCategoryId="cat-1" searchQuery="poma" onAdd={() => {}} />)
    expect(screen.getAllByText('Pomada').length).toBeGreaterThan(0)
    expect(screen.queryByText('Corte')).not.toBeInTheDocument()
  })
})
