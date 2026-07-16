import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CatalogGrid } from './CatalogGrid'

const ITEMS = [
  { id: 's1', kind: 'service' as const, name: 'Corte', priceCents: 28000, imageUrl: null, categoryId: 'cat-1' },
  { id: 'p1', kind: 'product' as const, name: 'Pomada', priceCents: 25000, imageUrl: null, categoryId: 'cat-2' },
]

// Catálogo con un servicio que el barbero "javi" NO realiza (excludedStaffIds).
// El excluido llega con priceCents=0 (así se ve en prod: el override del barbero
// resuelve $0), pero eso es irrelevante porque debe OCULTARSE, no mostrarse.
const ITEMS_EXCLUSION = [
  { id: 's1', kind: 'service' as const, name: 'Corte', priceCents: 35000, imageUrl: null, categoryId: 'cat-1', excludedStaffIds: [] },
  { id: 's2', kind: 'service' as const, name: 'Barba Express', priceCents: 0, imageUrl: null, categoryId: 'cat-1', excludedStaffIds: ['javi'] },
  { id: 'p1', kind: 'product' as const, name: 'Pomada', priceCents: 25000, imageUrl: null, categoryId: 'cat-1' },
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

  it('oculta los servicios que el barbero atendiendo no realiza; conserva productos y servicios ofrecidos', () => {
    render(
      <CatalogGrid
        items={ITEMS_EXCLUSION}
        selectedCategoryId="cat-1"
        searchQuery=""
        attendingBarberId="javi"
        attendingBarberName="Javi Cruz"
        onAdd={() => {}}
      />,
    )
    expect(screen.getAllByText('Corte').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pomada').length).toBeGreaterThan(0)
    // Barba Express (excluido de Javi) NO se renderiza — ni la card de $0.
    expect(screen.queryByText('Barba Express')).not.toBeInTheDocument()
  })

  it('sin barbero atendiendo no oculta ningún servicio', () => {
    render(
      <CatalogGrid
        items={ITEMS_EXCLUSION}
        selectedCategoryId="cat-1"
        searchQuery=""
        attendingBarberId={null}
        onAdd={() => {}}
      />,
    )
    expect(screen.getAllByText('Barba Express').length).toBeGreaterThan(0)
  })

  it('en búsqueda también oculta los servicios excluidos del atendiendo', () => {
    render(
      <CatalogGrid
        items={ITEMS_EXCLUSION}
        selectedCategoryId="cat-1"
        searchQuery="barba"
        attendingBarberId="javi"
        attendingBarberName="Javi Cruz"
        onAdd={() => {}}
      />,
    )
    expect(screen.queryByText('Barba Express')).not.toBeInTheDocument()
    // El único match quedó oculto → invita a cambiar de barbero.
    expect(screen.getByText(/javi cruz no ofrece servicios\. cambia de barbero\./i)).toBeInTheDocument()
  })

  it('si TODO el grid queda oculto por exclusión, invita a cambiar de barbero', () => {
    const onlyExcluded = [
      { id: 's2', kind: 'service' as const, name: 'Barba Express', priceCents: 0, imageUrl: null, categoryId: 'cat-1', excludedStaffIds: ['javi'] },
    ]
    render(
      <CatalogGrid
        items={onlyExcluded}
        selectedCategoryId="cat-1"
        searchQuery=""
        attendingBarberId="javi"
        attendingBarberName="Javi Cruz"
        onAdd={() => {}}
      />,
    )
    expect(screen.getByText(/javi cruz no ofrece servicios\. cambia de barbero\./i)).toBeInTheDocument()
  })

  it('empty state genérico cuando la categoría no tiene items (no por exclusión)', () => {
    render(
      <CatalogGrid
        items={[]}
        selectedCategoryId="cat-1"
        searchQuery=""
        attendingBarberId="javi"
        attendingBarberName="Javi Cruz"
        onAdd={() => {}}
      />,
    )
    expect(screen.getByText(/sin resultados/i)).toBeInTheDocument()
  })
})
