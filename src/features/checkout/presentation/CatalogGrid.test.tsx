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

  // Overlay de precios (capa LIVE): la card muestra el precio resuelto para el
  // atendiendo, no el estático (congelado en el del viewer).
  it('overlay de precios: la card muestra el precio del atendiendo, no el estático', () => {
    render(
      <CatalogGrid
        items={ITEMS}
        selectedCategoryId="cat-1"
        searchQuery=""
        attendingBarberId="eli"
        overlayFresh
        priceOverlay={new Map([['s1', { priceCents: 35000, isExcluded: false }]])}
        onAdd={() => {}}
      />,
    )
    expect(screen.getAllByText('$350').length).toBeGreaterThan(0)
    // El estático ($280) ya no se muestra: la card corresponde al atendiendo.
    expect(screen.queryByText('$280')).not.toBeInTheDocument()
  })

  // El overlay fresco es más fresco que staffOverrides estático: oculta la card
  // aunque el estático no marque exclusión.
  it('overlay fresco con isExcluded oculta la card aunque el estático no la excluya', () => {
    render(
      <CatalogGrid
        items={ITEMS}
        selectedCategoryId="cat-1"
        searchQuery=""
        attendingBarberId="eli"
        attendingBarberName="Eli"
        overlayFresh
        priceOverlay={new Map([['s1', { priceCents: 0, isExcluded: true }]])}
        onAdd={() => {}}
      />,
    )
    // Corte (único servicio de cat-1) queda oculto por el overlay → invita a
    // cambiar de barbero, nunca muestra la card en $0.
    expect(screen.queryByText('Corte')).not.toBeInTheDocument()
    expect(screen.queryByText('$0')).not.toBeInTheDocument()
    expect(screen.getByText(/eli no ofrece servicios\. cambia de barbero\./i)).toBeInTheDocument()
  })

  // Overlay stale (overlayFresh=false): NO usamos su isExcluded (es del barbero
  // anterior). El filtro cae al estático, reactivo al atendiendo actual.
  it('overlay stale no aplica su isExcluded — el filtro usa el estático reactivo', () => {
    render(
      <CatalogGrid
        items={ITEMS}
        selectedCategoryId="cat-1"
        searchQuery=""
        attendingBarberId="eli"
        overlayFresh={false}
        priceOverlay={new Map([['s1', { priceCents: 0, isExcluded: true }]])}
        onAdd={() => {}}
      />,
    )
    // El estático de Corte no excluye a "eli" → la card sigue visible pese al
    // isExcluded stale. (El precio sí usa el overlay como previousData.)
    expect(screen.getAllByText('Corte').length).toBeGreaterThan(0)
  })

  // Anti-flash (previousData): mientras llega el overlay del nuevo atendiendo,
  // el precio se atenúa (aria-busy) en vez de mostrarse "como actual".
  it('pricesUpdating atenúa el precio de las cards (aria-busy)', () => {
    render(
      <CatalogGrid
        items={ITEMS}
        selectedCategoryId="cat-1"
        searchQuery=""
        priceOverlay={new Map([['s1', { priceCents: 35000, isExcluded: false }]])}
        pricesUpdating
        onAdd={() => {}}
      />,
    )
    const prices = screen.getAllByText('$350')
    expect(prices.length).toBeGreaterThan(0)
    for (const p of prices) expect(p).toHaveAttribute('aria-busy', 'true')
  })

  /* ── Combos: mismo overlay + exclusión que servicios ── */

  const COMBO = {
    id: 'c1', kind: 'combo' as const, name: 'Combo Corte+Barba',
    priceCents: 40000, imageUrl: null, categoryId: 'cat-1', excludedStaffIds: [] as string[],
  }

  it('overlay de combo: la card del combo muestra el precio del atendiendo, no el base', () => {
    render(
      <CatalogGrid
        items={[COMBO]}
        selectedCategoryId="cat-1"
        searchQuery=""
        attendingBarberId="eli"
        overlayFresh
        priceOverlay={new Map([['c1', { priceCents: 45000, isExcluded: false }]])}
        onAdd={() => {}}
      />,
    )
    // Overlay $450 gana; el base estático ($400) ya no se muestra.
    expect(screen.getAllByText('$450').length).toBeGreaterThan(0)
    expect(screen.queryByText('$400')).not.toBeInTheDocument()
  })

  it('overlay fresco con isExcluded oculta la card del combo (nunca $0)', () => {
    render(
      <CatalogGrid
        items={[COMBO]}
        selectedCategoryId="cat-1"
        searchQuery=""
        attendingBarberId="eli"
        attendingBarberName="Eli"
        overlayFresh
        priceOverlay={new Map([['c1', { priceCents: 0, isExcluded: true }]])}
        onAdd={() => {}}
      />,
    )
    expect(screen.queryByText('Combo Corte+Barba')).not.toBeInTheDocument()
    expect(screen.queryByText('$0')).not.toBeInTheDocument()
    expect(screen.getByText(/eli no ofrece servicios\. cambia de barbero\./i)).toBeInTheDocument()
  })

  it('combo excluido por staffOverrides estático se oculta; conserva productos', () => {
    const items = [
      { ...COMBO, excludedStaffIds: ['javi'] },
      { id: 'p1', kind: 'product' as const, name: 'Pomada', priceCents: 25000, imageUrl: null, categoryId: 'cat-1' },
    ]
    render(
      <CatalogGrid
        items={items}
        selectedCategoryId="cat-1"
        searchQuery=""
        attendingBarberId="javi"
        attendingBarberName="Javi Cruz"
        onAdd={() => {}}
      />,
    )
    expect(screen.queryByText('Combo Corte+Barba')).not.toBeInTheDocument()
    // Los productos nunca se excluyen.
    expect(screen.getAllByText('Pomada').length).toBeGreaterThan(0)
  })

  it('sin barbero atendiendo el combo con exclusiones sigue visible', () => {
    render(
      <CatalogGrid
        items={[{ ...COMBO, excludedStaffIds: ['javi'] }]}
        selectedCategoryId="cat-1"
        searchQuery=""
        attendingBarberId={null}
        onAdd={() => {}}
      />,
    )
    expect(screen.getAllByText('Combo Corte+Barba').length).toBeGreaterThan(0)
  })
})
