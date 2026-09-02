# Permisos por tab del POS + tab "Ventas del día" — Design

**Fecha:** 2026-09-02
**Repos:** bienbravo-api (permisos + query), bienbravo-pos (gating de tabs + feature nueva), bienbravo-admin (labels/tipos de permisos).

## Pedido

1. Los tabs inferiores del POS (Reloj, Hoy, Mis ventas, Caja) se muestran **solo** si el operador tiene el permiso correspondiente. Sin permiso, el tab no existe para él.
2. Un tab nuevo, **Ventas del día**: lista de todas las ventas de la sucursal en el día, con reimpresión de ticket y un filtro por barbero que muestra los tickets donde ese barbero participó — incluso si el ticket tiene varios barberos.

## Principios

- **El API es la fuente de verdad.** La visibilidad de los 4 tabs existentes es una regla de UI (las operaciones detrás ya están gateadas por `pos.register.*`, `pos.sale.*`, etc.), pero la lectura de ventas ajenas es un dato sensible: la gatea el API con un permiso propio y scope de sucursal.
- **Un permiso por tab.** El admin ve 5 llaves nuevas bajo el grupo `pos`, claras y sin combinatoria.
- **Cero regresión al desplegar.** Los roles que hoy operan el POS reciben los permisos de tab por migración SQL; nadie pierde tabs al hacer deploy.

## Permisos nuevos (API `CANONICAL_PERMISSIONS`, seed, `docs/PERMISSIONS.md`)

| Llave | Qué habilita | Enforcement |
|---|---|---|
| `pos.tab.clock` | Ver tab **Reloj** | UI (POS) |
| `pos.tab.today` | Ver tab **Hoy** | UI (POS) |
| `pos.tab.my_sales` | Ver tab **Mis ventas** | UI (POS) |
| `pos.tab.register` | Ver tab **Caja** | UI (POS) |
| `pos.sales.day.read` | Ver tab **Ventas del día**: todas las ventas del día de la sucursal + reimprimir tickets | UI (POS) **y** API (`posDaySales`) |

Seed (roles de fábrica):
- `Gerencia Global`: todo (ya recibe `CANONICAL_PERMISSIONS`).
- `Barbero`, `Barbero POS`, `Solo POS`: + los 4 `pos.tab.*`.
- `Manager`, `Cajero POS`: + los 4 `pos.tab.*` + `pos.sales.day.read`.

Rollout a producción (el seed resetea permisos de roles, no se corre en prod): migración SQL `prisma/migrations/20260902120000_pos_tab_permissions/migration.sql` + script `scripts/apply-pos-tab-permissions-migration.ts` (mismo patrón que el de kiosk):
1. `INSERT INTO "Permission"` de las 5 llaves (`ON CONFLICT DO NOTHING`).
2. Otorga los 4 `pos.tab.*` a **todo rol que hoy tenga `pos.sale.create`** (= roles que operan el POS).
3. Otorga `pos.sales.day.read` a todo rol que tenga `reports.financial.view` **o** `pos.refund.request` (managers y cajeros).

## API — query `posDaySales`

```graphql
posDaySales(locationId: ID!, date: String!): [Sale!]!
```

- `requirePermission(viewer, 'pos.sales.day.read', locationId)` — incluye validación de scope de sucursal.
- `date` en `YYYY-MM-DD`; rango = día local en la tz de la sucursal (misma semántica que `sales`/`posRevenueSummary`, vía `getLocalDateRange`).
- `where`: tenant, `locationId`, `source: POS`, `status IN (PAID, VOID, REFUNDED)` (anuladas se listan para visibilidad, marcadas), `createdAt` en el rango. `orderBy createdAt desc`, `take 1000`.
- `include: { customer: { select: id, fullName }, payments: true }` — el tipo `Sale` expone `customer`/`payments` como campos planos sin `@ResolveField`, así que se cargan en la misma query. `items` y `couponApplications` ya salen por DataLoader (sin N+1).
- **Sin filtro por barbero en el server.** El POS carga el día completo una vez (decenas a pocos cientos de ventas por sucursal) y filtra en cliente; el chip cambia al instante y no hay un round-trip por barbero.
- Tests unit (`test/unit/modules/pos/day-sales.spec.ts`): Forbidden sin permiso; Forbidden fuera de scope; rechaza fecha inválida; arma el `where` correcto en la tz de la sucursal.

## POS

### Gating de tabs (`src/core/permissions/posTabs.ts`)
Config pura y testeable:
```ts
POS_TABS = [
  { to: '/reloj',      label: 'Reloj',          permission: 'pos.tab.clock' },
  { to: '/hoy',        label: 'Hoy',            permission: 'pos.tab.today' },
  { to: '/mis-ventas', label: 'Mis ventas',     permission: 'pos.tab.my_sales' },
  { to: '/ventas-dia', label: 'Ventas del día', permission: 'pos.sales.day.read' },
  { to: '/caja',       label: 'Caja',           permission: 'pos.tab.register' },
]
visibleTabs(permissions) · firstAllowedRoute(permissions) · isRouteAllowed(path, permissions)
```
- `PosShell` construye `tabs` desde `viewer.permissions`. `BottomTabNav` deja de tener `grid-cols-4` fijo: columnas = número de tabs.
- **Guard de ruta:** si el path actual pertenece a un tab que el viewer no tiene → `Navigate` al primer tab permitido. Si no tiene **ningún** tab → vista "Sin módulos habilitados — pide al admin que revise tu rol" con el botón de bloquear del header. Defensa en profundidad: el API sigue siendo quien protege los datos.
- `LockPage` navega tras login a `firstAllowedRoute(viewer.permissions)` en vez de `/hoy` fijo.

### Feature `src/features/day-sales/` (arquitectura `data/domain/lib/presentation`)
- `data/day-sales.repository.ts`: `DaySalesRepository.getDaySales(locationId, date, { force })` → `DaySale[]`. Query `PosDaySales` con `graphql()` (codegen). Mapea: `tipCents` = suma de líneas `TIP` (se sacan de `items`, igual que `getSaleDetail`), `customerName`, `payments`, `barbers` = únicos de `items[].staffUser` (+ `staffUserId` de la venta si viene), `status`.
- Registrado en `core/repositories/registry.ts` (`daySales`) y en `test/mocks/repositories.ts`.
- `lib/day-sales.filters.ts` (puro, con tests): `barbersInSales(sales)` (chips: solo quienes participaron hoy, orden alfabético) y `filterByBarber(sales, barberId | null)` (una venta pasa si el barbero es vendedor **o** realizó cualquier línea).
- `presentation/DaySalesPage.tsx`:
  - Header "Ventas del día" + fecha local + resumen (nº de ventas PAID y total PAID; anuladas excluidas del total).
  - Chips: **Todos** + un chip por barbero. Estado del filtro en memoria (no persiste).
  - Lista cronológica descendente. Row: hora · cliente · conceptos · barberos · total · badge `ANULADA`/`REEMBOLSADA` cuando aplique. Tap → `DaySaleSheet`.
  - Carga: mount (cache-first) + refetch silencioso en `focus`/`visibilitychange` + subscription `saleEvent(slug)` (mismo patrón que Mi Día). Errores con banner, nunca "0 ventas" en silencio.
- `presentation/DaySaleSheet.tsx`: bottom sheet (misma animación que `SaleDetailSheet`) con `SaleTicketBody` + botón **Reimprimir ticket** (deshabilitado si la venta está anulada/reembolsada, con motivo). No refetch: usa la venta ya cargada.
- Reimpresión: `useReprintTicket()` monta `<PrintableTicket sale reprint />` para la venta elegida, llama `window.print()` en el siguiente frame y desmonta en `afterprint`. `PrintableTicket` gana la prop opcional `reprint` que imprime una línea `*** REIMPRESIÓN ***` (auditoría: un ticket reimpreso no debe pasar por original).
- Router: `/ventas-dia` (tab) → redirect `/day-sales` (canónico, lazy chunk), siguiendo la convención actual (`/mis-ventas` → `/my-day`). Prefetcher registrado en `routePrefetchers`.
- Ícono nuevo `ReceiptIcon` en `shared/pos-ui/icons` (misma familia visual game-icons, monocromo).

### Tests (Vitest)
- `posTabs.test.ts`: visibilidad, primer tab permitido, guard.
- `PosShell`: sin permiso no se renderiza el tab; sin ninguno, la vista "Sin módulos".
- `day-sales.filters.test.ts`: barbero secundario en venta multi-barbero pasa el filtro; barbero ajeno no.
- `DaySalesPage.test.tsx`: renderiza lista; chip filtra; anulada muestra badge; reimprimir invoca `window.print` y el ticket lleva marca de reimpresión.

## Admin
- `constants/permission-labels.ts`: labels en español de las 5 llaves.
- `types/viewer.ts`: extender la unión `PermissionKey`.
- El grupo `pos` ya es visible para roles POS (`isPosRelevant` acepta `pos.*`); no hay más cambios.

## Fuera de alcance
- Filtro por fecha (solo "hoy") y paginación: el volumen diario por sucursal no lo requiere.
- Anular/reembolsar desde este tab (ya existe en admin con su propio permiso).
- Envío de ticket por correo (sigue "Próximamente").
- Corregir que `sale(id)` no incluye `customer`/`payments` (gap preexistente de Mi Día; se anota, no se toca aquí).
