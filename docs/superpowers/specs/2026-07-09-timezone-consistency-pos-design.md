# Consistencia de timezones — SP3: POS (branch-tz de primera clase) — Diseño

Fecha: 2026-07-09 · Estado: aprobado por el usuario (parte de la decomposición del esfuerzo de tz)

## Contexto y objetivo

Auditoría cross-repo del esfuerzo de timezones (SP1 API ✅, SP2 Admin ✅). Este sub-proyecto es **SP3: POS** (`bienbravo-pos`, Vite 7 + React 19 + TS, arquitectura `app/core/features/shared`).

El POS está **más adelantado que el admin pero inconsistente consigo mismo**:

| Tipo de sitio | Estado actual | Problema |
|---|---|---|
| Formatters de display (8) | Hardcodean `timeZone: 'America/Monterrey'` (literal) | Correctos hoy, pero **no leen la tz real** de la sucursal |
| Formatters browser-local (clock 12h, BarberSelectorView, PinEntryView) | `d.getHours()` sin tz | Browser-local |
| Day-boundaries (HoyPage, CajaPage, useAgenda, MyDayPage, LockPage) | `new Date().setHours(0,0,0,0)` | **Browser-local** — "hoy" mal si el device está en otra tz |
| Gate de puntualidad (ClockPage:98, useClock:22) | `d.getHours()*60+d.getMinutes()` | **Browser-local** — tarde/temprano mal en otra tz |

Como los devices están físicamente en Saltillo (= `America/Monterrey`, UTC-6, sin DST), **no hay bug live** — es **consolidación correcta-por-construcción**, igual que SP2 fue consolidación de display y no un fix live.

**Modelo canónico (heredado de SP1/SP2):** la tz autoritativa es `Location.timezone` (campo real, editable; las 3 sucursales = `America/Monterrey`). El POS debe leer esa tz de su sucursal activa y pasarla a helpers explícitos.

**Decisión de la matemática de tz (aprobada):** **Intl puro, sin dependencias nuevas.** Helpers en `src/shared/lib/date.ts` usando solo `Intl.DateTimeFormat`, blindados con tests `vitest` (el POS sí tiene runner). Espeja el precedente del **cliente admin** (que usó Intl puro, no dayjs; dayjs+utc+timezone vive solo en el API). El POS a propósito no tiene lib de fechas y prioriza bundle/instant-load — se mantiene ese ethos.

## Alcance: dos repos, en secuencia

Por la regla de secuenciación del esfuerzo (cada sub-proyecto posterior hard-checa artefactos del anterior en `main`), el cambio de **API va primero y mergea a su `main`** antes de que el POS consuma el campo.

### A. API (aditivo, sin migración)

`Location.timezone` **ya existe** como columna y en el `Location` completo. Falta exponerlo en el tipo público que consume el POS:

- `bienbravo-api/src/modules/locations/types/pos-public-location.type.ts`: agregar `@Field() timezone!: string;`
- `bienbravo-api/src/modules/locations/locations.resolver.ts` (`posPublicLocations`): agregar `timezone: true` al `select`, y **bumpear el cache key** `posPublic.v2` → `posPublic.v3` (igual que ya se hizo al agregar `slug` — sin el bump, un proceso con cache caliente serviría rows sin `timezone`).
- Regenerar `schema.generated.graphql` (boot local / el mecanismo estándar del API).

Es aditivo puro (agrega un campo, no borra ni edita nada; no toca DB) → cumple la regla de seguridad de DB de prod.

### B. POS — Fundación

- Correr `npm run sync-schema` + `npm run codegen` (levanta el campo `timezone` nuevo desde el schema del API ya mergeado).
- `src/core/auth/auth.repository.ts` `LOCATIONS_QUERY` (`posPublicLocations`): agregar `timezone` a la selección.
- `src/core/auth/auth.types.ts` `PosLocation`: agregar `timezone: string`.
- El mapeo del repositorio que produce `PosLocation[]` desde el query: incluir `timezone`.
- `src/core/location/LocationProvider.tsx`: al resolver `name`/`slug` vía `auth.getLocations()`, resolver también `timezone`; guardar `locationTimezone` en estado; exponerlo en `LocationContextValue` con fallback `BRANCH_TZ_DEFAULT` cuando no está resuelto.
- `src/core/location/useLocation.ts`: el value ya se propaga por contexto; `locationTimezone: string` queda disponible vía `useLocation()`.
- **Nuevo `src/shared/lib/date.ts`** (Intl puro):
  - `export const BRANCH_TZ_DEFAULT = 'America/Monterrey'`
  - `formatTimeInTz(iso: string, tz: string, opts?: Intl.DateTimeFormatOptions): string`
  - `formatDateTimeInTz(iso: string, tz: string, opts?: Intl.DateTimeFormatOptions): string`
  - `minutesOfDayInTz(iso: string, tz: string): number` — minutos desde medianoche en la tz (vía `formatToParts`, hora `% 24`)
  - `dayOfWeekInTz(iso: string, tz: string): number` — día de semana 0–6 en la tz
  - `localDayInTz(instant: Date | number, tz: string): string` — `'YYYY-MM-DD'` del día local en la tz (`en-CA`)
  - `localDayRangeInTz(ymd: string, tz: string): { startUtc: Date; endUtc: Date }` — medianoche local y fin del día local como instantes UTC, **derivando el offset del tz por-instante** (DST-safe, no asume UTC-6)
  - Tests `vitest` (`src/shared/lib/date.test.ts`): fijar `localDayRangeInTz`/`minutesOfDayInTz`/`dayOfWeekInTz` con **`America/Cancun`** (UTC-5, sin DST) además de Monterrey, para **probar que no son accidentalmente browser-local** (el test corre en la tz del runner). Los formatters se verifican byte-identical contra la expresión original bajo `TZ=America/Monterrey`.

### C. POS — Consolidación (3 frentes; cada uno byte-identical hoy)

1. **Formatters → tz de sucursal.** Los 8 con literal hardcodeado (`ReceiptScreen.tsx:49`, `PrintableTicket.tsx:54`, `SaleDetailSheet.tsx:32`, `ClockPage.tsx:15`, `AgendaPage.tsx:19/28/38`, `CajaOpenView.tsx:18`) y los browser-local (`ClockPage` `formatTimeMx12`/`formatNowMx` vía `format12h(d.getHours(),…)`, `BarberSelectorView.tsx:45-46`, `PinEntryView.tsx:26-27`) pasan a leer `locationTimezone` de `useLocation()` y llamar a los helpers, **preservando las opciones exactas** (byte-identical hoy). Los formatters module-level que hoy son `const` con literal se convierten en funciones que reciben `tz` (o se llaman desde el componente con la tz), porque un `const` module-level no puede leer un hook. El estilo "1:36 PM" custom (sin puntos) de `format12h` se preserva; solo cambia de dónde salen las horas (de `d.getHours()` browser-local a `minutesOfDayInTz`).

2. **Day-boundaries → tz de sucursal.** `HoyPage.tsx:35-36,114`, `CajaPage.tsx:19-20`, `useAgenda.ts:8-10`, `MyDayPage.tsx:311-313`, `LockPage.tsx:149-150`: reemplazar `new Date().setHours(0,0,0,0)` / `setHours(23,59,59,999)` por `localDayRangeInTz(localDayInTz(new Date(), tz), tz)` → `{ startUtc, endUtc }`, con `tz` de `useLocation().locationTimezone`. Estas variables se mandan como instantes al API (no se cambia el contrato del API — el POS calcula el rango correcto en tz de sucursal client-side).

3. **Gate de puntualidad → tz de sucursal.** `ClockPage.tsx:98` (`nowMinutesFromMidnight`), `useClock.ts:22` (`minutesFromMidnight`) y `useClock.ts:16` (`todayDayOfWeek` = `new Date().getDay()`): computar minutos-desde-medianoche y día-de-semana en la tz de la sucursal (`minutesOfDayInTz`/`dayOfWeekInTz`), para que la comparación tarde/temprano vs inicio de turno sea correcta.

## Flujo de datos

`posPublicLocations` (con `timezone`) → `auth.getLocations()` → `LocationProvider` resuelve `locationTimezone` de la sucursal activa → `useLocation().locationTimezone` → componentes/hooks lo pasan a los helpers de `shared/lib/date.ts`. Los formatters renderizan en tz de sucursal; las day-boundaries calculan el día local correcto como instantes UTC para las query vars; el gate de puntualidad compara wall-clock en tz de sucursal. El instante viene del API como ISO UTC; la `timeZone` explícita hace el resto.

## Errores / bordes

- **`locationTimezone` sin resolver** (pre-resolución del `getLocations()`): fallback `BRANCH_TZ_DEFAULT` — mismo comportamiento visible que hoy.
- **Byte-identical hoy:** device en Monterrey → todos los displays y rangos idénticos a los actuales.
- **Sin asumir no-DST:** `localDayRangeInTz` deriva el offset por-instante, así que una sucursal futura en una tz con DST es correcta por construcción.
- **Cache key del API:** el bump `v2→v3` es obligatorio; sin él, un proceso con snapshot caliente serviría locations sin `timezone` y el POS caería al fallback silenciosamente.

## Verificación

- **API:** `nest build` + spec existente de locations; regenerar `schema.generated.graphql` y confirmar que aparece `timezone` en `PosPublicLocation`.
- **POS:** `npm run codegen` sin drift; `vitest` (helpers nuevos + suite existente en verde); `typecheck`; `build`.
- **Manual:** cambiar la tz de una location de prueba (p.ej. `America/Cancun`) y verificar que day-range ("hoy"), el gate de puntualidad y el formato de horas se corren, sin necesidad de que el operador esté en esa tz.

## Secuencia (para el plan)

1. **API:** `timezone` en `PosPublicLocation` type + `select` + bump cache key + regen schema. Merge a `main` del API.
2. **POS fundación:** `sync-schema`+`codegen`; `timezone` en `LOCATIONS_QUERY`/`PosLocation`/mapeo; `LocationProvider` expone `locationTimezone`; `shared/lib/date.ts` + tests vitest.
3. **POS formatters:** 8 literales + browser-local → helpers con `locationTimezone` (byte-identical).
4. **POS day-boundaries:** HoyPage/CajaPage/useAgenda/MyDayPage/LockPage → `localDayRangeInTz`.
5. **POS lateness gate:** ClockPage/useClock minutos + día-de-semana en tz de sucursal.

## Fuera de alcance (SP3)

- SP4 (Kiosk display TV + Web SSG hydration).
- A10 del punch-list (venta directa no refresca hasta borrar caché) — es issue de caché de Apollo, no de tz.
- Full per-record tz (cada instante en la tz de SU location) — irrelevante hoy (una sola tz activa por device); refinación futura documentada.
- Cambiar el contrato de las queries del API que consume el POS a fechas bare (se evaluó; se descartó para mantener SP3 self-contained en el repo POS y sin acoplar más resolvers del API).
