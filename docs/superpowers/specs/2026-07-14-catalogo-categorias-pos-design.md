# Catálogo por categorías reales en el POS — Design

**Fecha:** 2026-07-14
**Repos del esfuerzo:** bienbravo-pos (esta spec) + bienbravo-admin ([spec hermana](../../../../bienbravo-admin/docs/superpowers/specs/2026-07-14-catalogo-orden-categorias-admin-design.md)). El API **no cambia**.

## Modelo (compartido con admin)

Regla única para todas las superficies (POS, admin, web futura):

> **Solo las categorías reales creadas por el dueño aparecen como tabs/filtros. Nada autogenerado.** Ni "Todo"/"Todos", ni "Otros".

- La categoría es **opcional** en servicios/productos/combos — sin validaciones nuevas. No tener categoría es una forma legítima de dejar un item fuera del POS.
- **Una categoría por item.** Multi-categoría (un item en N categorías, con orden propio por categoría) queda como **Fase 2** explícitamente fuera de alcance: requiere relación N:M, migrar `sortOrder` del item a la tabla puente, selector múltiple en admin y ajustes en POS/web.
- Sin categoría ⇒ **invisible en el POS** (grid Y búsqueda). Decisión del dueño: "en el POS no quiero que salgan si no tienen una categoría".
- El caso accidente (item con sucursal asignada pero sin categoría) lo detecta el **admin** con un banner + asignación rápida — ver spec hermana.
- Web (futuro, fuera de alcance): la tienda tendrá "Todos los productos" (los clientes lo esperan) donde también aparecen los sin categoría, pero los filtros serán solo categorías reales. Las categorías ya traen `slug`, imagen y `sortOrder` — listas para eso.

## Cambios en el POS

### 1. CatalogChips (`src/features/checkout/presentation/CatalogChips.tsx`)
- Eliminar el chip **"Todo"** y su estado `selectedCategoryId === null` como "ver todo".
- Chips = categorías reales en el orden que llega del API (`sortOrder` asc, ya viene ordenado).
- Selección default: **la primera categoría** del arreglo. Nunca hay estado "sin selección" mientras existan categorías.

### 2. Catálogo (`src/features/checkout/application/useCheckout.ts`)
- Excluir items con `categoryId: null` **una sola vez al cargar** (al armar `catalogItems`), no en cada render. Con eso quedan fuera del grid y de la búsqueda a la vez.
- `sortCatalogItems` ya no necesita el rank `MAX_SAFE_INTEGER` para sin-categoría (no llegan), pero se conserva como defensa — no romper su contrato.

### 3. Casos borde
- **Cero categorías en el tenant:** el checkout muestra `EmptyState` con mensaje accionable ("Crea categorías en el admin para armar el catálogo del POS") en lugar del grid. NO hacer fallback de "mostrar todo": enmascararía la regla y el dueño no sabría por qué el POS se ve distinto.
- **Categoría seleccionada sin items en la sucursal:** comportamiento existente (grid vacío) se conserva.
- **Propagación:** `catalogVersion` del API ya hashea `categoryId` y `sortOrder` de items y categorías — las tablets refetchean solas al reordenar o recategorizar. Cero trabajo aquí.

### 4. Tests (Vitest)
- CatalogChips: no renderiza "Todo"; la primera categoría queda seleccionada por default.
- useCheckout/CheckoutPage: items sin categoría no aparecen en grid ni en resultados de búsqueda.
- Cero categorías → EmptyState con el mensaje accionable.
- Actualizar los tests existentes que asuman el chip "Todo" (`CatalogChips.test.tsx`, `CheckoutPage.test.tsx`).

## Fuera de alcance
- Multi-categoría (Fase 2, ver arriba).
- Filtros por categoría en la web (`bienbravo-web`) — el modelo ya queda compatible.
- Cualquier cambio en `bienbravo-api`.
