# Perfil: react

## Comandos
install: npm ci
test: npm test -- <filtro>
build: npm run build
lint: npm run lint
typecheck: npm run typecheck

## Límites
files_max: 5
diff_max: 800
timeout_check: 120s
diff_excludes: package-lock.json, *.lock

## Convenciones
- Stack: React + Vite + Vitest + Testing Library sobre TypeScript; gestor de paquetes npm.
- El script `test` de package.json debe ser `vitest run` (una sola pasada); el filtro llega como `npm test -- <ruta-o-patrón>`.
- Componentes función en `src/components/<Nombre>/<Nombre>.tsx`; un componente exportado por archivo, PascalCase.
- Hooks propios en `src/hooks/use<Nombre>.ts`; todo hook empieza por `use` (lo exige eslint rules-of-hooks).
- Tests colocados junto al código como `<Nombre>.test.tsx`; Vitest los descubre por el sufijo `.test.`.
- Testing Library: consultar por rol o etiqueta accesible (`getByRole`, `getByLabelText`); prohibido consultar por clase CSS o por estructura del DOM.
- Interacciones con `userEvent.setup()` (no `fireEvent`); toda llamada de `userEvent` lleva `await`.
- Imports absolutos con alias `@/` (declarado en `vite.config.ts` y `tsconfig.json`); prohibido `../../../`.
- `useEffect` solo para sincronizar con sistemas externos; el estado derivado se calcula en render, nunca en un efecto.
- Variables de entorno del cliente vía `import.meta.env` y con prefijo `VITE_`; sin el prefijo no llegan al bundle.

## Trampas conocidas
- Si el script `test` es `vitest` a secas, con TTY entra en modo watch y el check no termina jamás; debe ser `vitest run`.
- `getBy*` lanza excepción si no encuentra; para asertar ausencia se usa `queryBy*`, que devuelve `null`.
- `vi.mock()` se iza al tope del archivo: toda variable usada dentro del factory debe crearse con `vi.hoisted()`.
- `userEvent` v14 es asíncrono: un `await` olvidado produce tests intermitentes (pasan aislados, fallan en la suite).
- jsdom no calcula layout: `getBoundingClientRect()` devuelve ceros; no asertar tamaños ni posiciones en píxeles.
- Los matchers `toBeInTheDocument`/`toHaveTextContent` requieren `@testing-library/jest-dom` cargado en `setupFiles` de `vitest.config.ts`; si falta, el error es el confuso "matcher is not a function".
- `npm run build` suele encadenar `tsc -b && vite build`: un error de tipos rompe el build aunque los tests pasen — correr typecheck antes de reportar DONE.

## Contexto BienBravo (anexado tras instalar)
- Este repo es uno de 4 independientes (api, admin, pos, web) dentro de la carpeta BienBravo; NO hay monorepo. Nunca importar ni referenciar rutas de otro subproyecto. El mapa global vive en `../CLAUDE.md` (fuera del repo); reglas de negocio en `../bienbravo-api/docs/BUSINESS_RULES.md` (solo lectura).
- Donde las convenciones genéricas de arriba contradigan la estructura existente, manda la existente: arquitectura `src/app` (shell, router) / `src/core` (graphql, repositorios, permisos, location) / `src/features/<feature>/{data,domain,application,presentation}` / `src/shared` (pos-ui, lib). Cada feature expone un `index.ts`.
- Datos: los componentes no llaman a Apollo directo; pasan por repositorios (`src/core/repositories`, `features/*/data/*.repository.ts`) inyectados vía `RepositoryProvider`, y los tests los mockean con `src/test/mocks/repositories.ts`.
- Contrato GraphQL: `src/core/graphql/generated/` viene de codegen sobre `schema.graphql` (copia del API). Si la tarea depende de un cambio de schema del API: `npm run sync-schema` y `npm run codegen`; sin el API actualizado la tarea está bloqueada.
- Sesión de staff por PIN con cookie `bb_session`; NUNCA `localStorage` para sesión. Stock, precios y permisos vienen del API; el POS solo pre-valida para UX.
- Design system: `design-system/` es un symlink a `../bienbravo-admin/design-system`. Nunca copiarlo ni escribir dentro desde este repo; los tokens se cambian en admin.
- Presupuesto de bundle vigilado con `npm run size` (size-limit); imports de librerías pesadas van lazy por ruta.
- Tabs y pantallas gateadas por permisos `pos.tab.*` (`src/core/permissions/posTabs.ts`). Textos de UI en español (es-MX).
