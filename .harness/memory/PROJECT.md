# PROJECT — brief del proyecto

## Qué es
Punto de venta táctil de BienBravo (barbería, Saltillo, 3 sucursales) que corre en la tablet de cada sucursal:
lock screen por PIN, Hoy (cola de walk-ins + citas + CTA de atender/cobrar), checkout con ticket térmico, Caja
(apertura/cierre con conteo), Reloj checador, Mis ventas (comisiones del barbero) y Ventas del día (todas las
ventas de la sucursal, filtro por barbero, reimpresión). Consume el API GraphQL de `../bienbravo-api`; nunca
reimplementa precios, stock ni permisos.

## Stack
- Vite 7 + React 19 + TypeScript 5 + Tailwind 4 (tokens vendorizados en `src/styles/design-tokens/`).
- Apollo Client 4 con cookie `bb_session` (PIN login), subscriptions graphql-ws (`saleEvent`, walk-ins, citas).
- Tipos GraphQL por codegen (client-preset) en `src/core/graphql/generated/` desde `schema.graphql`
  (`npm run sync-schema` copia el schema del API; `npm run codegen` regenera; CI falla por drift).
- Vitest 3 + Testing Library + jsdom (`vitest.config.ts`, `src/test/setup.ts`). size-limit (`npm run size`). npm.

## Estructura
- `src/app/` — `router.tsx` (rutas lazy + `routePrefetchers`), `PosShell.tsx` (header + `BottomTabNav` gateado
  por permisos), `IdentityStripV2.tsx`, `useIdleRoutePrefetch.ts`, `Providers.tsx`.
- `src/core/` — `auth/` (viewer, PIN, lock), `permissions/` (`posTabs.ts`: tabs ↔ permisos `pos.tab.*` /
  `pos.sales.day.read`; `usePermission`), `location/`, `repositories/` (`registry.ts` + `RepositoryProvider`),
  `apollo/client.ts` (typePolicies), `graphql/generated/`, `toast/`, `telemetry/`.
- `src/features/<feature>/{data,domain,lib,application,presentation}/` + `index.ts`: `auth`, `home` (Hoy),
  `checkout`, `register` (Caja), `clock`, `agenda`, `walkins`, `my-day` (Mis ventas), `day-sales` (Ventas del día).
- `src/shared/pos-ui/` (TouchButton, BottomTabNav, sheets, iconos game-icons), `src/shared/lib/` (money, date
  con tz de sucursal, cn), `src/shared/cash/`.
- `src/test/mocks/repositories.ts` (repos in-memory + `MOCK_VIEWER`), `src/test/helpers/renderWithProviders.tsx`.
- `docs/SALES_RULES.md`, `docs/superpowers/specs/` (diseños por feature).

## Convenciones fijas
- Los componentes no llaman a Apollo directo: pasan por repositorios inyectados; los tests los mockean.
- Toda pantalla nueva es un tab o vive bajo uno: se registra en `POS_TABS` con su permiso; el API gatea el dato.
- Fechas/horas siempre en la tz de la sucursal (`localDayInTz`, `formatTimeInTz`); nunca la tz del device.
- Sheets con animación enter/exit (`pos-sheet-up/down`) y Escape-to-close; textos en es-MX.
- Errores de carga se muestran (banner), nunca "0 ventas" en silencio; refetch en focus/visibilitychange + subscription.
- Rutas nuevas van lazy (chunk propio) y en `routePrefetchers`; el bundle inicial se vigila con `npm run size`.
