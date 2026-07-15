# Precio de líneas con overrides — Implementation Plan (POS)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda línea de servicio del carrito lleva el precio resuelto por `pricingFor` (staff > sucursal > base): el prefill del walk-in y el add con barbero default dejan de usar precios sin overrides.

**Architecture:** Ampliar `resolveServicePriceForBarber` para aceptar `staffUserId: null`; el prefill resuelve por barbero asignado (o sucursal); el add genera `lineId` propio y encadena el `changeLineBarber` existente cuando hay barbero default.

**Tech Stack:** React 19 + TS 5 + Vitest. Spec: `docs/superpowers/specs/2026-07-15-precio-overrides-pos-design.md`.

## Global Constraints

- Repo: `/Users/insightcollective/Documents/Code/BienBravo/bienbravo-pos`, branch `master`, commits directos, mensajes en español.
- NO tocar `src/core/graphql/generated/` ni correr codegen (el query `PosResolveServicePrice` ya declara `$staffUserId: ID` nullable y usa `gql` runtime).
- NO hacer push (el director publica — orden de deploy: POS antes que API).
- Tests: `npx vitest run <ruta>`; suite completa `npm test` al final.

---

### Task 1: `resolveServicePriceForBarber` acepta null

**Files:**
- Modify: `src/features/checkout/data/checkout.repository.ts:493` (interface) y `:686` (impl)

**Interfaces:**
- Produces: `resolveServicePriceForBarber(serviceId: string, locationId: string, staffUserId: string | null): Promise<number>` — con `null` resuelve sucursal > base. Tasks 2-3 dependen de esta firma.

- [ ] **Step 1:** Cambiar en la interface (línea 493) y en la impl (línea 686) el tipo del tercer parámetro a `staffUserId: string | null`. El body no cambia (las variables ya pasan `staffUserId` directo y el query lo declara nullable).

- [ ] **Step 2:** `npx vitest run src/features/checkout` → PASS (sin cambios de comportamiento). Commit:

```bash
git add src/features/checkout/data/checkout.repository.ts
git commit -m "refactor(checkout): resolveServicePriceForBarber acepta staffUserId null (precio a nivel sucursal)"
```

---

### Task 2: Prefill del walk-in resuelve overrides

**Files:**
- Modify: `src/features/checkout/application/useCheckout.ts` (~líneas 227-241, bloque `w?.requestedServices`)
- Test: `src/features/checkout/presentation/CheckoutPage.test.tsx`

- [ ] **Step 1: Write the failing test.** En `CheckoutPage.test.tsx`, siguiendo el harness existente (`makeRepos()` + `renderWithProviders`), agregar:

```ts
it('prefill de walk-in usa precio resuelto con overrides, no el base', async () => {
  const repos = makeRepos()
  repos.checkout.getWalkIn = vi.fn().mockResolvedValue({
    id: 'w1',
    customer: { id: 'c1', fullName: 'Fabián' },
    assignedStaffUser: { id: 'b1' },
    requestedServices: [{ id: 'svc-corte', name: 'Corte', basePriceCents: 20000, categoryId: 'cat-cortes' }],
  })
  repos.checkout.resolveServicePriceForBarber = vi.fn().mockResolvedValue(35000)
  renderWithProviders(<CheckoutPage />, {
    initialRoute: '/checkout?completeWalkInId=w1',
    repos: { ...repos, auth: new TestAuthRepo() },
  })
  await screen.findByText('Fabián', {}, { timeout: 3000 })
  expect(repos.checkout.resolveServicePriceForBarber).toHaveBeenCalledWith('svc-corte', 'loc1', 'b1')
  expect(await screen.findByText('$350')).toBeInTheDocument()
  expect(screen.queryByText('$200')).not.toBeInTheDocument()
})
```

Ajustar el param de la URL (`completeWalkInId`) y el formato de dinero (`$350` vs `$350.00`) al que use el harness/`formatMoney` real — leer un test vecino primero. `'b1'` debe existir en los BARBERS del mock con `hasClockedIn: true` (ya es así).

- [ ] **Step 2:** `npx vitest run src/features/checkout/presentation/CheckoutPage.test.tsx` → el test nuevo FALLA (hoy la línea usa 20000).

- [ ] **Step 3: Implementation.** En `useCheckout.ts`, reemplazar el bloque del prefill de servicios:

```ts
if (w?.requestedServices && w.requestedServices.length > 0) {
  // El barbero asignado (si sigue disponible) define el precio de la línea:
  // staff > sucursal > base. Sin barbero: sucursal > base. Nunca base directo.
  const assignedId = w.assignedStaffUser?.id ?? null
  const priceStaffId =
    assignedId && barbers.some((b) => b.id === assignedId && b.hasClockedIn !== false)
      ? assignedId
      : null
  for (const svc of w.requestedServices) {
    let unitPriceCents = svc.basePriceCents ?? 0
    try {
      unitPriceCents = await checkout.resolveServicePriceForBarber(svc.id, locationId, priceStaffId)
    } catch (err) {
      console.error('[prefill] failed to resolve price', { serviceId: svc.id, priceStaffId, err })
    }
    dispatch({
      type: 'add',
      item: {
        kind: 'service',
        itemId: svc.id,
        name: svc.name,
        unitPriceCents,
        categoryId: svc.categoryId ?? null,
      },
    })
  }
}
```

Nota: el callback del `.then(...)` del `getWalkIn` debe volverse `async` para poder `await` (o convertir la cadena a `async/await` completa — mantener el mismo manejo de errores existente).

- [ ] **Step 4:** `npx vitest run src/features/checkout/presentation/CheckoutPage.test.tsx` → PASS (nuevo y existentes).

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/application/useCheckout.ts src/features/checkout/presentation/CheckoutPage.test.tsx
git commit -m "fix(checkout): prefill de walk-in resuelve overrides de precio (staff > sucursal > base)"
```

---

### Task 3: Add con barbero default re-resuelve el precio

**Files:**
- Modify: `src/features/checkout/lib/cart.ts` (action `add` acepta `lineId` opcional)
- Modify: `src/features/checkout/application/useCheckout.ts` (nuevo `addCatalogItem`, exportado en el return)
- Modify: `src/features/checkout/presentation/CheckoutPage.tsx:381` (usar `addCatalogItem`)
- Test: `src/features/checkout/lib/cart.test.ts` y `src/features/checkout/presentation/CheckoutPage.test.tsx`

**Interfaces:**
- Consumes: `resolveServicePriceForBarber(…, string | null)` (Task 1); `changeLineBarber(lineId, staffUserId)` existente.
- Produces: action `{ type: 'add', item: {...}, lineId?: string }` (reducer usa `lineId ?? uid()`); `ck.addCatalogItem(item: { kind, id, name, priceCents, categoryId })`.

- [ ] **Step 1: Failing test del reducer.** En `cart.test.ts` agregar:

```ts
it('add respeta lineId explícito', () => {
  const s = cartReducer(initialCart, {
    type: 'add',
    lineId: 'line-x',
    item: { kind: 'service', itemId: 'svc1', name: 'Corte', unitPriceCents: 20000, categoryId: null },
  })
  expect(s.lines[0].id).toBe('line-x')
})
```

- [ ] **Step 2:** `npx vitest run src/features/checkout/lib/cart.test.ts` → FAIL (el action no acepta lineId).

- [ ] **Step 3:** En `cart.ts`: agregar `lineId?: string` al action type de `add` y en el reducer `id: action.lineId ?? uid()`.

- [ ] **Step 4:** `npx vitest run src/features/checkout/lib/cart.test.ts` → PASS.

- [ ] **Step 5: `addCatalogItem` en useCheckout** (cerca de `changeLineBarber`):

```ts
// Add optimista: la línea entra YA con el precio del catálogo (resuelto para
// el viewer) y, si hay barbero default, changeLineBarber la corrige al precio
// de ESE barbero (staff > sucursal > base). Cache-first: corrección típicamente
// sin parpadeo. El API valida y rechaza desajustes, así que esta corrección
// no es cosmética — sin ella la venta se bloquea.
const addCatalogItem = (item: { kind: 'service' | 'product' | 'combo'; id: string; name: string; priceCents: number; categoryId: string | null }) => {
  const lineId = crypto.randomUUID()
  dispatch({
    type: 'add',
    lineId,
    item: { kind: item.kind, itemId: item.id, name: item.name, unitPriceCents: item.priceCents, categoryId: item.categoryId },
  })
  if (item.kind === 'service' && cartState.defaultBarberId) {
    void changeLineBarber(lineId, cartState.defaultBarberId)
  }
}
```

Exportarlo en el `return` del hook. En `CheckoutPage.tsx` (línea ~381) reemplazar el dispatch inline de `onAdd` por `onAdd={(item) => ck.addCatalogItem(item)}`.

- [ ] **Step 6: Test de integración.** En `CheckoutPage.test.tsx`:

```ts
it('add manual con barbero default re-resuelve el precio para ese barbero', async () => {
  const user = userEvent.setup()
  const repos = makeRepos()
  repos.checkout.resolveServicePriceForBarber = vi.fn().mockResolvedValue(35000)
  repos.checkout.getWalkIn = vi.fn().mockResolvedValue({
    id: 'w1', customer: null, assignedStaffUser: { id: 'b1' }, requestedServices: [],
  })
  renderWithProviders(<CheckoutPage />, {
    initialRoute: '/checkout?completeWalkInId=w1',
    repos: { ...repos, auth: new TestAuthRepo() },
  })
  await screen.findAllByText('Corte', {}, { timeout: 3000 })
  await user.click(screen.getAllByText('Corte')[0])
  await waitFor(() => expect(screen.getByText('$350')).toBeInTheDocument())
  expect(repos.checkout.resolveServicePriceForBarber).toHaveBeenCalledWith('svc-corte', 'loc1', 'b1')
})
```

(El walk-in sin requestedServices setea solo el barbero default `b1`. Ajustar formato de dinero e ids al harness real.)

- [ ] **Step 7:** `npx vitest run src/features/checkout` → PASS todo el feature.

- [ ] **Step 8: Commit**

```bash
git add src/features/checkout/lib/cart.ts src/features/checkout/lib/cart.test.ts src/features/checkout/application/useCheckout.ts src/features/checkout/presentation/CheckoutPage.tsx src/features/checkout/presentation/CheckoutPage.test.tsx
git commit -m "fix(checkout): add con barbero default re-resuelve precio vía changeLineBarber"
```

---

## Verificación final
- [ ] `npm test` completo verde + `npm run build` limpio.
- [ ] NO push — el director revisa y publica (POS ANTES que API).
