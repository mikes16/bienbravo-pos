# Catálogo por categorías reales en el POS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El checkout del POS muestra solo categorías reales del dueño (sin chip "Todo"), excluye items sin categoría, abre en la primera categoría, busca globalmente, y muestra un EmptyState accionable si no hay categorías.

**Architecture:** Cambios quirúrgicos en 4 archivos de `src/features/checkout/`: un helper puro nuevo en `lib/sort-catalog.ts` filtra los sin-categoría al cargar (`useCheckout`); `CatalogChips` pierde el chip "Todo"; `CheckoutPage` deriva la selección default (primera categoría) y renderiza EmptyState con cero categorías; `CatalogGrid` hace la búsqueda global.

**Tech Stack:** React 19 + TS 5 + Vitest 3 + Testing Library. Spec: `docs/superpowers/specs/2026-07-14-catalogo-categorias-pos-design.md`.

## Global Constraints

- Repo: `/Users/insightcollective/Documents/Code/BienBravo/bienbravo-pos`, branch `master`, commits directos (sin PRs), mensajes de commit en español con Conventional Commits.
- Copy visible al usuario SIEMPRE en español; operadores no técnicos → mensajes simples y accionables.
- NO tocar `src/core/graphql/generated/` ni `src/styles/design-tokens/`.
- NO cambiar `bienbravo-api` — cero cambios de API en este esfuerzo.
- Correr tests con `npx vitest run <ruta>`; suite completa con `npm test`.

---

### Task 1: Helper `onlyCategorized` + filtro al cargar catálogo

**Files:**
- Modify: `src/features/checkout/lib/sort-catalog.ts`
- Modify: `src/features/checkout/application/useCheckout.ts:176` (línea `setCatalogItems(...)`)
- Test: `src/features/checkout/lib/sort-catalog.test.ts`

**Interfaces:**
- Produces: `onlyCategorized<T extends { categoryId: string | null }>(items: T[]): T[]` — exportada de `sort-catalog.ts`; Tasks 2-3 asumen que `ck.catalogItems` ya viene sin items de `categoryId: null`.

- [ ] **Step 1: Write the failing test** — agregar al final de `src/features/checkout/lib/sort-catalog.test.ts`:

```ts
describe('onlyCategorized', () => {
  it('excluye items sin categoría (regla: sin categoría = fuera del POS)', () => {
    const items = [
      { name: 'Corte', sortOrder: 1, categoryId: 'c1' },
      { name: 'Huerfano', sortOrder: 2, categoryId: null },
      { name: 'Pomada', sortOrder: 3, categoryId: 'c2' },
    ]
    expect(onlyCategorized(items).map((i) => i.name)).toEqual(['Corte', 'Pomada'])
  })
})
```

Ajustar el import existente del archivo para incluirla: `import { sortCatalogItems, onlyCategorized } from './sort-catalog'` (usar el estilo de import que ya tenga el archivo).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/checkout/lib/sort-catalog.test.ts`
Expected: FAIL — `onlyCategorized` no está exportada.

- [ ] **Step 3: Write minimal implementation** — agregar al final de `src/features/checkout/lib/sort-catalog.ts`:

```ts
// Regla de catálogo: sin categoría = no existe en el POS (decisión del dueño;
// el admin detecta el caso accidente con su banner). Filtrar UNA vez al cargar.
export function onlyCategorized<T extends { categoryId: string | null }>(items: T[]): T[] {
  return items.filter((i) => i.categoryId != null)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/checkout/lib/sort-catalog.test.ts`
Expected: PASS (todos los tests del archivo).

- [ ] **Step 5: Wire en useCheckout** — en `src/features/checkout/application/useCheckout.ts`, línea ~176, cambiar:

```ts
setCatalogItems(sortCatalogItems(items, cats))
```

por:

```ts
setCatalogItems(sortCatalogItems(onlyCategorized(items), cats))
```

y en el import de la línea 8: `import { sortCatalogItems, onlyCategorized } from '../lib/sort-catalog'`.

- [ ] **Step 6: Run checkout tests**

Run: `npx vitest run src/features/checkout`
Expected: PASS. (Si algún test integraba items sin categoría al grid, ajustarlo dándole una categoría del mock — pero con los mocks actuales todos los items tienen categoría.)

- [ ] **Step 7: Commit**

```bash
git add src/features/checkout/lib/sort-catalog.ts src/features/checkout/lib/sort-catalog.test.ts src/features/checkout/application/useCheckout.ts
git commit -m "feat(checkout): excluir items sin categoría del catálogo del POS"
```

---

### Task 2: CatalogChips sin chip "Todo"

**Files:**
- Modify: `src/features/checkout/presentation/CatalogChips.tsx`
- Test: `src/features/checkout/presentation/CatalogChips.test.tsx`

**Interfaces:**
- Produces: `CatalogChipsProps.onSelect: (id: string) => void` (ya no acepta `null`); `selectedCategoryId: string | null` se conserva (null solo transitorio mientras carga). Task 3 pasa siempre una categoría real.

- [ ] **Step 1: Update the failing test** — en `CatalogChips.test.tsx`, reemplazar el test `renders "Todo" chip` completo por:

```ts
it('no renderiza chip "Todo" — solo categorías reales', () => {
  render(<CatalogChips categories={CATEGORIES} selectedCategoryId="cat-1" onSelect={() => {}} searchQuery="" onSearchChange={() => {}} />)
  expect(screen.queryByText('Todo')).not.toBeInTheDocument()
})
```

y en los demás tests del archivo cambiar `selectedCategoryId={null}` por `selectedCategoryId="cat-1"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/checkout/presentation/CatalogChips.test.tsx`
Expected: FAIL — el chip "Todo" sigue en el DOM.

- [ ] **Step 3: Implementation** — en `CatalogChips.tsx`:
  1. Borrar completo el bloque del chip "Todo" (el primer `<TouchButton>` con `onClick={() => onSelect(null)}` y label `Todo`, líneas ~44-54).
  2. Cambiar la firma en la interfaz: `onSelect: (id: string) => void`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/checkout/presentation/CatalogChips.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/presentation/CatalogChips.tsx src/features/checkout/presentation/CatalogChips.test.tsx
git commit -m "feat(checkout): quitar chip Todo — solo categorías reales del admin"
```

---

### Task 3: Default primera categoría + búsqueda global + EmptyState sin categorías

**Files:**
- Modify: `src/features/checkout/presentation/CheckoutPage.tsx:53,370-382`
- Modify: `src/features/checkout/presentation/CatalogGrid.tsx:21-26`
- Test: `src/features/checkout/presentation/CatalogGrid.test.tsx` (nuevo)
- Test: `src/features/checkout/presentation/CheckoutPage.test.tsx`

**Interfaces:**
- Consumes: `ck.catalogItems` ya filtrado (Task 1); `CatalogChips` sin "Todo" (Task 2); `ck.loaded: boolean` y `ck.categories` que ya expone `useCheckout`.

- [ ] **Step 1: Write failing tests para CatalogGrid** — crear `src/features/checkout/presentation/CatalogGrid.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run to verify the second test fails**

Run: `npx vitest run src/features/checkout/presentation/CatalogGrid.test.tsx`
Expected: FAIL en "búsqueda global" — hoy la búsqueda se limita a la categoría seleccionada.

- [ ] **Step 3: Implementation CatalogGrid** — reemplazar el filtro (líneas 22-26) por:

```ts
const q = searchQuery.trim().toLowerCase()
const filtered = items.filter((i) => {
  // Búsqueda global: reemplaza al viejo chip "Todo" como forma de ver/encontrar
  // cualquier item sin importar el chip seleccionado.
  if (q) return i.name.toLowerCase().includes(q)
  return !selectedCategoryId || i.categoryId === selectedCategoryId
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/checkout/presentation/CatalogGrid.test.tsx`
Expected: PASS.

- [ ] **Step 5: CheckoutPage — selección derivada + EmptyState.** En `CheckoutPage.tsx`:
  1. Debajo de la línea 53 (`const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)`), agregar:

```ts
// Sin chip "Todo": la selección efectiva siempre es una categoría real —
// la que tocó el operador o la primera del orden definido en el admin.
const effectiveCategoryId = selectedCategoryId ?? ck.categories[0]?.id ?? null
```

  2. En el JSX (líneas ~370-382) pasar `effectiveCategoryId` en lugar de `selectedCategoryId` a `CatalogChips` y `CatalogGrid`.
  3. Envolver `<CatalogChips …/>` + `<CatalogGrid …/>` con el caso cero-categorías: cuando `ck.loaded && ck.categories.length === 0`, renderizar en su lugar (dentro de la misma columna de catálogo):

```tsx
<div className="flex flex-1 items-center justify-center px-6 py-12 text-center">
  <div className="max-w-md">
    <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-bone-muted)]">
      Catálogo sin categorías
    </p>
    <p className="text-sm text-[var(--color-bone-muted)]">
      Crea categorías en el admin y asigna tus servicios y productos para armar el catálogo del POS.
    </p>
  </div>
</div>
```

(No hacer fallback de "mostrar todo": enmascararía la regla — ver spec.)

- [ ] **Step 6: Actualizar CheckoutPage.test.tsx.** El test de la línea ~217 (`Stock insuficiente: Shampoo`) hace click en 'Shampoo' que vive en la segunda categoría (`cat-prod`) — con el default a primera categoría ya no está visible. Después del `await screen.findAllByText(...)` inicial de ese test, agregar el click al chip de su categoría:

```ts
await user.click(screen.getByRole('button', { name: 'Productos' }))
```

y agregar al final del describe un test nuevo:

```ts
it('sin categorías muestra EmptyState accionable en lugar del grid', async () => {
  const repos = makeRepos()
  repos.checkout.getCategories = vi.fn().mockResolvedValue([])
  renderWithProviders(<CheckoutPage />, {
    initialRoute: '/checkout',
    repos: { ...repos, auth: new TestAuthRepo() },
  })
  await screen.findByText(/Catálogo sin categorías/i, {}, { timeout: 3000 })
  expect(screen.queryByText('Corte')).not.toBeInTheDocument()
})
```

Nota: los items del mock SÍ tienen categoría, pero al no existir categorías no hay chips; el grid no debe mostrarse. Si el texto exacto del chip 'Productos' colisiona con otro elemento, usar `within` sobre el contenedor de chips como hacen otros tests del archivo.

- [ ] **Step 7: Run full checkout suite**

Run: `npx vitest run src/features/checkout`
Expected: PASS (9 tests previos de CheckoutPage ajustados + nuevos).

- [ ] **Step 8: Full suite + build**

Run: `npm test && npm run build`
Expected: PASS / build sin errores TS.

- [ ] **Step 9: Commit**

```bash
git add src/features/checkout/presentation/CheckoutPage.tsx src/features/checkout/presentation/CheckoutPage.test.tsx src/features/checkout/presentation/CatalogGrid.tsx src/features/checkout/presentation/CatalogGrid.test.tsx
git commit -m "feat(checkout): default primera categoría, búsqueda global y EmptyState sin categorías"
```

---

## Verificación final del esfuerzo

- [ ] `npm test` completo en verde y `npm run build` limpio.
- [ ] NO hacer push todavía — el director revisa el diff de los 3 commits primero.
