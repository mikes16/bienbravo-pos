# TZ SP3 (POS) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El POS formatea y computa todo instante en la tz real de la sucursal (`Location.timezone`), no en un literal hardcodeado ni en la tz del navegador.

**Architecture:** El API expone `timezone` en `PosPublicLocation` (aditivo). El `LocationProvider` del POS resuelve `locationTimezone` de la sucursal activa y lo expone vía `useLocation()`. Un módulo nuevo `src/shared/lib/date.ts` (Intl puro, con tests vitest) provee formateo, minutos-del-día, día-de-semana y rango-del-día-local — todo en una tz explícita. Los ~15 sitios tz-sensibles del POS (formatters, day-boundaries, gate de puntualidad) pasan a leer `locationTimezone` y llamar a esos helpers.

**Tech Stack:** Vite 7 + React 19 + TS + Apollo Client + graphql-codegen + vitest (POS); NestJS 10 + GraphQL code-first (API). Sin librería de fechas nueva — `Intl.DateTimeFormat` puro.

## Global Constraints

- **Cero dependencias de fecha nuevas.** Solo `Intl.DateTimeFormat`. (dayjs vive solo en el API; el cliente admin también usó Intl puro.)
- **Todos los helpers de tz viven en `src/shared/lib/date.ts`** con estas firmas exactas: `BRANCH_TZ_DEFAULT: string`; `formatTimeInTz(iso, tz, opts?)`; `formatDateTimeInTz(iso, tz, opts?)`; `minutesOfDayInTz(iso, tz)`; `dayOfWeekInTz(iso, tz)`; `localDayInTz(instant, tz)`; `localDayRangeInTz(ymd, tz)`.
- **Byte-identical hoy.** El device opera en `America/Monterrey` (== tz de sucursal), así que cada string y cada rango debe renderizar/computar idéntico a hoy. Preservar opciones exactas de cada formatter.
- **La tz siempre sale de `useLocation().locationTimezone`** (el POS opera una sola sucursal activa — todo es scoped). Fallback `BRANCH_TZ_DEFAULT` cuando no está resuelta.
- **API primero.** El cambio de API mergea a su `main` ANTES de que el POS corra `sync-schema`+`codegen`. Sin migración (la columna `Location.timezone` ya existe). Bump obligatorio del cache key `posPublic.v2` → `posPublic.v3`.
- **Verificación POS:** `npm test` (vitest run) + `npm run typecheck` + `npm run build` + `npm run codegen` sin drift. **Verificación API:** `npm run build` + regen de `schema.generated.graphql`.
- **Commits directos a `master`/`main` (sin PRs).** Trailer en cada commit:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- **Seguridad DB prod:** el cambio de API es aditivo (agrega un `@Field` + un `select`), no borra ni edita datos. No correr seeds.

---

## File Structure

**API (`bienbravo-api`):**
- `src/modules/locations/types/pos-public-location.type.ts` — agregar `@Field() timezone`.
- `src/modules/locations/locations.resolver.ts` — `select: { …, timezone: true }` + bump cache key.
- `schema.generated.graphql` — regenerado (aparece `timezone` en `PosPublicLocation`).

**POS (`bienbravo-pos`):**
- `src/shared/lib/date.ts` (crear) — helpers Intl puros. Única fuente de verdad de tz.
- `src/shared/lib/date.test.ts` (crear) — tests vitest.
- `src/core/auth/auth.repository.ts` — `LOCATIONS_QUERY` gana `timezone`.
- `src/core/auth/auth.types.ts` — `PosLocation` gana `timezone`.
- `src/core/location/LocationProvider.tsx` — resuelve y expone `locationTimezone`.
- `src/core/graphql/generated/*` — regenerado por codegen.
- **Formatters:** `src/features/checkout/presentation/ReceiptScreen.tsx`, `.../PrintableTicket.tsx`, `src/features/my-day/presentation/SaleDetailSheet.tsx`, `src/features/clock/presentation/ClockPage.tsx`, `src/features/agenda/presentation/AgendaPage.tsx`, `src/features/register/presentation/CajaOpenView.tsx`, `src/features/auth/presentation/BarberSelectorView.tsx`, `src/features/auth/presentation/PinEntryView.tsx`.
- **Day-boundaries:** `src/features/home/presentation/HoyPage.tsx`, `src/features/register/presentation/CajaPage.tsx`, `src/features/agenda/application/useAgenda.ts`, `src/features/my-day/presentation/MyDayPage.tsx`, `src/features/auth/presentation/LockPage.tsx`.
- **Lateness gate:** `src/features/clock/presentation/ClockPage.tsx`, `src/features/clock/application/useClock.ts`.

---

## Task 1: API — `timezone` en `PosPublicLocation` (aditivo)

**Files:**
- Modify: `bienbravo-api/src/modules/locations/types/pos-public-location.type.ts`
- Modify: `bienbravo-api/src/modules/locations/locations.resolver.ts:33-42` (método `posPublicLocations`)
- Regenerate/edit: `bienbravo-api/src/graphql/schema.generated.graphql` (bloque `type PosPublicLocation`, ~líneas 1274-1278)

**Interfaces:**
- Produces: el query GraphQL `posPublicLocations` ahora devuelve `timezone: String!` en cada `PosPublicLocation`. El POS (Task 2) lo consume.

- [ ] **Step 1: Agregar el campo al ObjectType**

En `pos-public-location.type.ts`, después del bloque de `slug`:

```ts
  @Field()
  slug!: string;

  // tz IANA de la sucursal (p.ej. 'America/Monterrey'). El POS la usa para
  // formatear y computar límites de día en la tz de la sucursal, no la del
  // navegador. Es el mismo valor que Location.timezone.
  @Field()
  timezone!: string;
```

- [ ] **Step 2: Seleccionar el campo + bump del cache key**

En `locations.resolver.ts`, método `posPublicLocations`, cambiar el key y el `select`:

```ts
    // Cache key bumped (`posPublic.v3`) al agregar `timezone` — sin esto, un
    // proceso con cache caliente serviría rows sin timezone y el POS caería
    // al fallback silenciosamente.
    const key = locationsPrefix(tenant.id) + 'posPublic.v3';
    return this.cache.getOrLoad(key, LOCATIONS_TTL_MS, () =>
      this.prisma.location.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true, timezone: true },
      }),
    );
```

- [ ] **Step 3: Regenerar el schema y confirmar el campo**

El API emite `src/graphql/schema.generated.graphql` en boot vía `autoSchemaFile` (orden de campos = orden de `@Field` en la clase). **No hay script standalone de emisión y el boot necesita DB** — para evitar atascarse booteando, el camino confiable es la **edición aditiva** del schema emitido (produce exactamente lo que emitiría el boot, ya que `timezone` se declaró después de `slug`):

En `src/graphql/schema.generated.graphql`, en el bloque `type PosPublicLocation` (~líneas 1274-1278), insertar `timezone: String!` después de `slug: String!`:
```graphql
type PosPublicLocation {
  id: ID!
  name: String!
  slug: String!
  timezone: String!
}
```
(Si hay DB local disponible, alternativamente bootear con `npm run start:dev` para que el schema se regenere solo y confirmar que el diff coincide con esta edición.) Luego:
```bash
cd bienbravo-api
grep -A6 "type PosPublicLocation" src/graphql/schema.generated.graphql
```
Expected: el bloque incluye `timezone: String!`.

- [ ] **Step 4: Build + spec de locations**

```bash
cd bienbravo-api
npm run build
npx jest test/unit/modules/locations --silent
```
Expected: build sin errores; si existe un spec de locations, pasa (el cambio es aditivo). Si no hay spec de locations, el build basta. (Nota: ~16 unit tests pre-existentes fallan por test-infra en la suite completa — NO correr la suite completa; limitar a `locations`.)

- [ ] **Step 5: Commit + push (API mergea primero)**

```bash
cd bienbravo-api
git add src/modules/locations/types/pos-public-location.type.ts src/modules/locations/locations.resolver.ts src/graphql/schema.generated.graphql
git commit -m "feat(locations): expone timezone en posPublicLocations (para tz del POS)

Aditivo — Location.timezone ya existe como columna. Bump del cache key
posPublic.v2 -> v3 para invalidar snapshots sin el campo.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

## Task 2: POS Fundación — `locationTimezone` + `shared/lib/date.ts`

**Files:**
- Modify: `bienbravo-pos/src/core/auth/auth.repository.ts:45-53` (`LOCATIONS_QUERY`)
- Modify: `bienbravo-pos/src/core/auth/auth.types.ts:35-39` (`PosLocation`)
- Modify: `bienbravo-pos/src/core/location/LocationProvider.tsx`
- Create: `bienbravo-pos/src/shared/lib/date.ts`
- Create: `bienbravo-pos/src/shared/lib/date.test.ts`
- Regenerate: `bienbravo-pos/src/core/graphql/generated/*`

**Interfaces:**
- Consumes: el campo `timezone` del query `posPublicLocations` (Task 1, ya en `main` del API).
- Produces:
  - `useLocation().locationTimezone: string` (fallback `BRANCH_TZ_DEFAULT`).
  - `src/shared/lib/date.ts` exporta: `BRANCH_TZ_DEFAULT: string`; `formatTimeInTz(iso: string, tz: string, opts?: Intl.DateTimeFormatOptions): string`; `formatDateTimeInTz(iso: string, tz: string, opts?: Intl.DateTimeFormatOptions): string`; `minutesOfDayInTz(iso: string, tz: string): number`; `dayOfWeekInTz(iso: string, tz: string): number`; `localDayInTz(instant: Date | number, tz: string): string`; `localDayRangeInTz(ymd: string, tz: string): { startUtc: Date; endUtc: Date }`.

- [ ] **Step 1: Traer `timezone` en el query + el type**

En `auth.repository.ts`, `LOCATIONS_QUERY`:

```ts
const LOCATIONS_QUERY = graphql(`
  query PosPublicLocations {
    posPublicLocations {
      id
      name
      slug
      timezone
    }
  }
`)
```

En `auth.types.ts`, `PosLocation`:

```ts
export interface PosLocation {
  id: string
  name: string
  slug: string
  timezone: string
}
```

(`getLocations()` en `auth.repository.ts:317` es pass-through: `return data!.posPublicLocations` tipado como `PosLocation[]` — no hay `.map()` que tocar; el campo fluye solo.)

- [ ] **Step 2: Regenerar codegen y confirmar sin drift**

```bash
cd bienbravo-pos
npm run sync-schema
npm run codegen
grep -n "timezone" src/core/graphql/generated/graphql.ts | grep -i "PosPublicLocation" -n || grep -n "PosPublicLocationsQuery" src/core/graphql/generated/graphql.ts
```
Expected: el tipo `PosPublicLocationsQuery` ahora incluye `timezone: string`.

- [ ] **Step 3: Escribir los tests de los helpers (fallan primero)**

Crear `src/shared/lib/date.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  BRANCH_TZ_DEFAULT,
  formatTimeInTz,
  formatDateTimeInTz,
  minutesOfDayInTz,
  dayOfWeekInTz,
  localDayInTz,
  localDayRangeInTz,
} from './date'

// 2026-07-06T16:30:00Z = lunes 10:30 en America/Monterrey (UTC-6) y 11:30 en America/Cancun (UTC-5)
const MON_1030_MTY = '2026-07-06T16:30:00.000Z'

describe('shared/lib/date (Intl puro, tz explícita)', () => {
  it('BRANCH_TZ_DEFAULT es America/Monterrey', () => {
    expect(BRANCH_TZ_DEFAULT).toBe('America/Monterrey')
  })

  it('formatTimeInTz por default es HH:mm 24h en la tz', () => {
    expect(formatTimeInTz(MON_1030_MTY, 'America/Monterrey')).toBe('10:30')
    expect(formatTimeInTz(MON_1030_MTY, 'America/Cancun')).toBe('11:30')
  })

  it('formatDateTimeInTz por default es DD/MM/YYYY, HH:mm 24h en la tz', () => {
    // es-MX intercala una coma entre fecha y hora
    expect(formatDateTimeInTz(MON_1030_MTY, 'America/Monterrey')).toBe('06/07/2026, 10:30')
  })

  it('minutesOfDayInTz da minutos-desde-medianoche en la tz (NO browser-local)', () => {
    expect(minutesOfDayInTz(MON_1030_MTY, 'America/Monterrey')).toBe(10 * 60 + 30)
    expect(minutesOfDayInTz(MON_1030_MTY, 'America/Cancun')).toBe(11 * 60 + 30)
  })

  it('dayOfWeekInTz da 0..6 estilo Date.getDay() en la tz', () => {
    expect(dayOfWeekInTz(MON_1030_MTY, 'America/Monterrey')).toBe(1) // lunes
  })

  it('localDayInTz da YYYY-MM-DD del día local en la tz', () => {
    // 2026-07-06T04:00:00Z = 22:00 del 05/07 en Monterrey, pero 23:00 del 05/07 en Cancun
    const lateNight = '2026-07-06T04:00:00.000Z'
    expect(localDayInTz(lateNight, 'America/Monterrey')).toBe('2026-07-05')
  })

  it('localDayRangeInTz da medianoche local y fin del día local como instantes UTC', () => {
    const mty = localDayRangeInTz('2026-07-06', 'America/Monterrey')
    expect(mty.startUtc.toISOString()).toBe('2026-07-06T06:00:00.000Z') // 00:00 MTY = 06:00Z
    expect(mty.endUtc.toISOString()).toBe('2026-07-07T05:59:59.999Z')

    // Cancun (UTC-5) prueba que NO es accidentalmente browser-local ni fijo UTC-6
    const cun = localDayRangeInTz('2026-07-06', 'America/Cancun')
    expect(cun.startUtc.toISOString()).toBe('2026-07-06T05:00:00.000Z') // 00:00 CUN = 05:00Z
    expect(cun.endUtc.toISOString()).toBe('2026-07-07T04:59:59.999Z')
  })
})
```

- [ ] **Step 4: Correr los tests y verlos fallar**

```bash
cd bienbravo-pos
npm test -- src/shared/lib/date.test.ts
```
Expected: FAIL — `Cannot find module './date'` / exports indefinidos.

- [ ] **Step 5: Implementar `src/shared/lib/date.ts`**

```ts
// Helpers de fecha/hora en una tz explícita, con Intl puro (sin dependencias).
// Única fuente de verdad de timezone en el POS: la tz siempre sale de
// useLocation().locationTimezone. El device opera en la tz de la sucursal, así
// que hoy esto es byte-identical a lo anterior; el objetivo es correctitud
// por-construcción para un device/manager en otra tz.

export const BRANCH_TZ_DEFAULT = 'America/Monterrey'

/** Hora en la tz. Default: HH:mm 24h (reproduce los formatters de hora del POS). */
export function formatTimeInTz(
  iso: string,
  tz: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...opts,
    timeZone: tz, // no override-able por opts: la tz es explícita
  }).format(new Date(iso))
}

/** Fecha+hora en la tz. Default: DD/MM/YYYY, HH:mm 24h (reproduce los tickets/sheets). */
export function formatDateTimeInTz(
  iso: string,
  tz: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...opts,
    timeZone: tz,
  }).format(new Date(iso))
}

/** Minutos desde medianoche (0..1439) del instante, leídos en la tz. */
export function minutesOfDayInTz(iso: string, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return h * 60 + m
}

/** Día de semana 0..6 (0=domingo), estilo Date.getDay(), leído en la tz. */
export function dayOfWeekInTz(iso: string, tz: string): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(
    new Date(iso),
  )
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[wd] ?? new Date(iso).getDay()
}

/** 'YYYY-MM-DD' del día local en la tz para un instante dado. */
export function localDayInTz(instant: Date | number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant)) // en-CA => 'YYYY-MM-DD'
}

/**
 * Offset del tz (ms) para un instante UTC dado: cuánto hay que sumar al UTC
 * para obtener el wall-clock local. Derivado vía Intl (DST-safe).
 */
function tzOffsetMs(utcDate: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(utcDate)
  const map: Record<string, number> = {}
  for (const p of parts) if (p.type !== 'literal') map[p.type] = Number(p.value)
  const asUtcOfLocal = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour % 24,
    map.minute,
    map.second,
  )
  return asUtcOfLocal - utcDate.getTime()
}

/**
 * Medianoche local y fin del día local (23:59:59.999) de `ymd` en la tz, como
 * instantes UTC. DST-safe: deriva el offset del inicio de ESE día y del inicio
 * del día siguiente por separado.
 */
export function localDayRangeInTz(ymd: string, tz: string): { startUtc: Date; endUtc: Date } {
  const [y, m, d] = ymd.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
  const startUtc = new Date(guess - tzOffsetMs(new Date(guess), tz))
  const guessNext = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0)
  const startNext = new Date(guessNext - tzOffsetMs(new Date(guessNext), tz))
  const endUtc = new Date(startNext.getTime() - 1)
  return { startUtc, endUtc }
}
```

- [ ] **Step 6: Correr los tests y verlos pasar**

```bash
cd bienbravo-pos
npm test -- src/shared/lib/date.test.ts
```
Expected: PASS (todos los `it`).

- [ ] **Step 7: Exponer `locationTimezone` en `LocationProvider`**

En `src/core/location/LocationProvider.tsx`:

1. Agregar al interface:
```ts
export interface LocationContextValue {
  locationId: string | null
  locationName: string | null
  locationSlug: string | null
  locationTimezone: string
  setLocationId: (id: string | null) => void
}
```

2. Importar el default:
```ts
import { BRANCH_TZ_DEFAULT } from '@/shared/lib/date'
```

3. Agregar estado y resolverlo junto a name/slug:
```ts
  const [locationName, setLocationName] = useState<string | null>(null)
  const [locationSlug, setLocationSlug] = useState<string | null>(null)
  const [locationTimezone, setLocationTimezone] = useState<string>(BRANCH_TZ_DEFAULT)
```

4. En el `useEffect` que resuelve, incluir `timezone`:
```ts
    const resolvePromise = locationId
      ? auth.getLocations().then((locations) => {
          const match = locations.find((l) => l.id === locationId)
          return match ? { name: match.name, slug: match.slug, timezone: match.timezone } : null
        })
      : Promise.resolve(null)

    resolvePromise
      .then((data) => {
        if (cancelled) return
        setLocationName(data?.name ?? null)
        setLocationSlug(data?.slug ?? null)
        setLocationTimezone(data?.timezone ?? BRANCH_TZ_DEFAULT)
      })
      .catch(() => {
        if (cancelled) return
        setLocationName(null)
        setLocationSlug(null)
        setLocationTimezone(BRANCH_TZ_DEFAULT)
      })
```

5. Incluirlo en el value del provider:
```ts
    <LocationContext.Provider
      value={{ locationId, locationName, locationSlug, locationTimezone, setLocationId }}
    >
```

- [ ] **Step 8: Verificar (typecheck + build + suite completa)**

```bash
cd bienbravo-pos
npm run typecheck
npm test
npm run build
```
Expected: typecheck sin errores; vitest en verde (nuevos + existentes); build OK.

- [ ] **Step 9: Commit**

```bash
cd bienbravo-pos
git add src/shared/lib/date.ts src/shared/lib/date.test.ts src/core/auth/auth.repository.ts src/core/auth/auth.types.ts src/core/location/LocationProvider.tsx src/core/graphql/generated
git commit -m "feat(tz): fundación — locationTimezone en LocationProvider + helpers Intl en shared/lib/date

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: POS Formatters → tz de sucursal

**Files (todos *modify*):**
- `src/features/checkout/presentation/ReceiptScreen.tsx` (~44-51)
- `src/features/checkout/presentation/PrintableTicket.tsx` (~48-56)
- `src/features/my-day/presentation/SaleDetailSheet.tsx` (~26-34)
- `src/features/register/presentation/CajaOpenView.tsx` (~13-21)
- `src/features/agenda/presentation/AgendaPage.tsx` (~14-42: `formatTimeMx`, `hourKeyMx`, `hourLabelMx`)
- `src/features/clock/presentation/ClockPage.tsx` (~10-42: `formatTimeMx`, `formatTimeMx12`, `formatNowMx`)
- `src/features/auth/presentation/BarberSelectorView.tsx` (~44-47)
- `src/features/auth/presentation/PinEntryView.tsx` (~25-28)

**Interfaces:**
- Consumes: `formatTimeInTz`/`formatDateTimeInTz`/`minutesOfDayInTz` (Task 2) + `useLocation().locationTimezone` (Task 2).

**Recipe:** Cada formatter module-level `const`/función que hoy usa `timeZone: 'America/Monterrey'` (literal) o `d.getHours()` (browser-local) pasa a recibir `tz` como parámetro y llamar al helper; el componente lo invoca con `const { locationTimezone } = useLocation()`. Preservar opciones exactas → byte-identical hoy.

- [ ] **Step 1: ReceiptScreen / PrintableTicket / SaleDetailSheet (datetime tickets)**

Los tres tienen un `formatDateTimeMx(iso)` con `{ day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'America/Monterrey' }`. Reemplazar cada uno por una función que toma tz y usa el default de `formatDateTimeInTz` (que es exactamente esas opciones):

Ejemplo (ReceiptScreen.tsx):
```ts
import { formatDateTimeInTz } from '@/shared/lib/date'
import { useLocation } from '@/core/location/useLocation'
// borrar la función module-level formatDateTimeMx

// dentro del componente:
const { locationTimezone } = useLocation()
// en el JSX, donde estaba formatDateTimeMx(sale.createdAt):
formatDateTimeInTz(sale.createdAt, locationTimezone)
```
Repetir el mismo patrón en `PrintableTicket.tsx` y `SaleDetailSheet.tsx`. Si el componente es una función pura sin acceso a hooks (p.ej. `PrintableTicket` se renderiza para imprimir), pasar `tz` como prop desde el padre que sí tiene `useLocation()`; en ese caso agregar `timezone: string` a sus props y `formatDateTimeInTz(iso, props.timezone)`.

- [ ] **Step 2: CajaOpenView / AgendaPage / ClockPage (time formatters)**

`CajaOpenView.formatTimeMx` y `ClockPage.formatTimeMx` y `AgendaPage.formatTimeMx` usan `{ hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'America/Monterrey' }` → default de `formatTimeInTz`. Reemplazar por `formatTimeInTz(iso, locationTimezone)` leyendo `const { locationTimezone } = useLocation()` en el componente.

Para `AgendaPage.hourKeyMx` / `hourLabelMx` (derivan la hora): usar `minutesOfDayInTz`:
```ts
import { formatTimeInTz, minutesOfDayInTz } from '@/shared/lib/date'

function hourKeyInTz(iso: string, tz: string): string {
  return String(Math.floor(minutesOfDayInTz(iso, tz) / 60)).padStart(2, '0') // "10"
}
function hourLabelInTz(iso: string, tz: string): string {
  return `${hourKeyInTz(iso, tz)}:00` // "10:00"
}
```
Pasar `locationTimezone` a cada call site dentro de `AgendaPage`.

Para `ClockPage.formatTimeMx12` / `formatNowMx` (usan `format12h(d.getHours(), d.getMinutes())`, browser-local): derivar hora/minuto en tz. Preservar el helper `format12h` (estilo "1:36 PM" sin puntos):
```ts
function formatTimeInTz12(iso: string, tz: string): string {
  const min = minutesOfDayInTz(iso, tz)
  return format12h(Math.floor(min / 60), min % 60)
}
function formatNowInTz12(nowMs: number, tz: string): string {
  return formatTimeInTz12(new Date(nowMs).toISOString(), tz)
}
```
Actualizar los call sites en `ClockPage` para pasar `locationTimezone`.

- [ ] **Step 3: BarberSelectorView / PinEntryView (last-seen stamps)**

Ambos hacen `const hh = String(d.getHours()).padStart(2,'0'); const mm = String(d.getMinutes()).padStart(2,'0')` (browser-local) para una hora "HH:mm". Reemplazar por `formatTimeInTz(iso, tz)` (default HH:mm 24h) con `tz` de `useLocation()`:
```ts
import { formatTimeInTz } from '@/shared/lib/date'
import { useLocation } from '@/core/location/useLocation'
// en el componente:
const { locationTimezone } = useLocation()
// donde se armaba `${hh}:${mm}`:
formatTimeInTz(iso, locationTimezone)
```
(Si el helper de formato es una función pura fuera del componente, moverla adentro o pasarle `tz`.) Verificar que la fuente sea un ISO string; si es un `Date`, usar `.toISOString()`.

- [ ] **Step 4: Verificación byte-identical + typecheck + build**

Verificar en Node que un par de sitios producen el mismo string que la expresión original (device en Monterrey):
```bash
cd bienbravo-pos
TZ=America/Monterrey node -e "
const iso='2026-07-06T16:30:00Z';
const old=new Date(iso).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Monterrey'});
const neu=new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Monterrey'}).format(new Date(iso));
console.log('time', old, neu, old===neu);
const oldD=new Date(iso).toLocaleString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Monterrey'});
const neuD=new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'America/Monterrey'}).format(new Date(iso));
console.log('datetime', oldD, neuD, oldD===neuD);
"
npm run typecheck
npm test
npm run build
```
Expected: ambas comparaciones `true`; typecheck/vitest/build en verde.

- [ ] **Step 5: Commit**

```bash
cd bienbravo-pos
git add src/features/checkout/presentation/ReceiptScreen.tsx src/features/checkout/presentation/PrintableTicket.tsx src/features/my-day/presentation/SaleDetailSheet.tsx src/features/register/presentation/CajaOpenView.tsx src/features/agenda/presentation/AgendaPage.tsx src/features/clock/presentation/ClockPage.tsx src/features/auth/presentation/BarberSelectorView.tsx src/features/auth/presentation/PinEntryView.tsx
git commit -m "fix(tz): formatters del POS leen la tz de la sucursal (no literal ni browser-local)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: POS Day-boundaries → tz de sucursal

**Files (todos *modify*):**
- `src/features/home/presentation/HoyPage.tsx:35-36, 114`
- `src/features/register/presentation/CajaPage.tsx:19-20`
- `src/features/agenda/application/useAgenda.ts:8-10`
- `src/features/my-day/presentation/MyDayPage.tsx:311-313`
- `src/features/auth/presentation/LockPage.tsx:149-150`

**Interfaces:**
- Consumes: `localDayInTz`/`localDayRangeInTz` (Task 2) + `useLocation().locationTimezone`.

**Recipe:** reemplazar `new Date(); setHours(0,0,0,0)` / `setHours(23,59,59,999)` por el rango del día local en la tz de la sucursal.

- [ ] **Step 1: HoyPage / CajaPage (patrón `from`/`to` de hoy)**

`HoyPage.tsx:35-36` y `CajaPage.tsx:19-20` tienen:
```ts
const from = new Date(now); from.setHours(0, 0, 0, 0)
const to = new Date(now); to.setHours(23, 59, 59, 999)
```
Reemplazar por (con `const { locationTimezone } = useLocation()` en el componente):
```ts
import { localDayInTz, localDayRangeInTz } from '@/shared/lib/date'
// ...
const { startUtc: from, endUtc: to } = localDayRangeInTz(localDayInTz(now, locationTimezone), locationTimezone)
```
(`now` es el `new Date()` que ya existe en esos archivos.) Igual para `HoyPage.tsx:114` (`const todayStart = new Date(); todayStart.setHours(0,0,0,0)`) → `const todayStart = localDayRangeInTz(localDayInTz(new Date(), locationTimezone), locationTimezone).startUtc`.

- [ ] **Step 2: MyDayPage (todayStart/todayEnd)**

`MyDayPage.tsx:311-313`:
```ts
todayStart.setHours(0, 0, 0, 0)
// ...
todayEnd.setHours(23, 59, 59, 999)
```
Reemplazar el bloque por:
```ts
const { startUtc: todayStart, endUtc: todayEnd } = localDayRangeInTz(
  localDayInTz(new Date(), locationTimezone),
  locationTimezone,
)
```
con `const { locationTimezone } = useLocation()` en el componente. Ajustar los usos posteriores de `todayStart`/`todayEnd` (ya son `Date`).

- [ ] **Step 3: LockPage (todayStart/todayEnd)**

`LockPage.tsx:149-150`:
```ts
const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
```
→
```ts
const { startUtc: todayStart, endUtc: todayEnd } = localDayRangeInTz(
  localDayInTz(new Date(), locationTimezone),
  locationTimezone,
)
```
`LockPage` ya usa `useLocation()` (línea 28: `const { setLocationId, locationName } = useLocation()`) — agregar `locationTimezone` a ese destructuring.

- [ ] **Step 4: useAgenda (application hook)**

`useAgenda.ts:8-10` construye `from`/`to` con `setHours`. Este es un hook de aplicación — obtener la tz vía `useLocation()` dentro del hook:
```ts
import { useLocation } from '@/core/location/useLocation'
import { localDayInTz, localDayRangeInTz } from '@/shared/lib/date'
// dentro de useAgenda():
const { locationTimezone } = useLocation()
const { startUtc: from, endUtc: to } = localDayRangeInTz(
  localDayInTz(new Date(), locationTimezone),
  locationTimezone,
)
```
Si `from`/`to` se calculan fuera del cuerpo del hook (module-level o en un `useMemo`), moverlos dentro del hook / agregar `locationTimezone` a las deps del `useMemo`.

- [ ] **Step 5: Verificación byte-identical + typecheck + build**

```bash
cd bienbravo-pos
TZ=America/Monterrey node -e "
const now=new Date('2026-07-06T18:00:00Z');
const from=new Date(now); from.setHours(0,0,0,0);
const to=new Date(now); to.setHours(23,59,59,999);
// helper equivalente:
function localDayInTz(inst,tz){return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(inst))}
function off(u,tz){const p=new Intl.DateTimeFormat('en-US',{timeZone:tz,hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(u);const m={};for(const x of p)if(x.type!=='literal')m[x.type]=Number(x.value);return Date.UTC(m.year,m.month-1,m.day,m.hour%24,m.minute,m.second)-u.getTime()}
const ymd=localDayInTz(now,'America/Monterrey');const g=Date.UTC(...ymd.split('-').map((v,i)=>i===1?Number(v)-1:Number(v)));
const startUtc=new Date(g-off(new Date(g),'America/Monterrey'));
console.log('start', from.toISOString(), startUtc.toISOString(), from.getTime()===startUtc.getTime());
"
npm run typecheck
npm test
npm run build
```
Expected: `start ... true` (device en Monterrey → el rango en tz de sucursal coincide con el browser-local); typecheck/vitest/build en verde.

- [ ] **Step 6: Commit**

```bash
cd bienbravo-pos
git add src/features/home/presentation/HoyPage.tsx src/features/register/presentation/CajaPage.tsx src/features/agenda/application/useAgenda.ts src/features/my-day/presentation/MyDayPage.tsx src/features/auth/presentation/LockPage.tsx
git commit -m "fix(tz): límites de día del POS se resuelven en la tz de la sucursal

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: POS Lateness gate → tz de sucursal

**Files (todos *modify*):**
- `src/features/clock/presentation/ClockPage.tsx:96-99` (`nowMinutesFromMidnight`)
- `src/features/clock/application/useClock.ts:15-23` (`todayDayOfWeek`, `minutesFromMidnight`)

**Interfaces:**
- Consumes: `minutesOfDayInTz`/`dayOfWeekInTz` (Task 2) + `useLocation().locationTimezone`.

**Recipe:** los cómputos de minutos-desde-medianoche y día-de-semana que hoy usan `d.getHours()*60+d.getMinutes()` / `new Date().getDay()` (browser-local) pasan a la tz de la sucursal, para que la comparación tarde/temprano vs inicio de turno sea correcta.

- [ ] **Step 1: useClock — día de semana y minutos en tz**

`useClock.ts`:
```ts
function todayDayOfWeek(): number {
  return new Date().getDay()
}
function minutesFromMidnight(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}
```
Reemplazar por versiones con tz (obtener `const { locationTimezone } = useLocation()` dentro del hook `useClock`, e invocar pasándole la tz):
```ts
import { minutesOfDayInTz, dayOfWeekInTz } from '@/shared/lib/date'
import { useLocation } from '@/core/location/useLocation'
// dentro de useClock():
const { locationTimezone } = useLocation()
// donde se llamaba todayDayOfWeek():
dayOfWeekInTz(new Date().toISOString(), locationTimezone)
// donde se llamaba minutesFromMidnight(iso):
minutesOfDayInTz(iso, locationTimezone)
```
Borrar las dos funciones module-level `todayDayOfWeek`/`minutesFromMidnight` una vez migrados sus call sites. (Si algún call site está fuera del cuerpo del hook, moverlo adentro o pasarle `locationTimezone`.)

- [ ] **Step 2: ClockPage — minutos "ahora" en tz**

`ClockPage.tsx:96-99`:
```ts
function nowMinutesFromMidnight(nowMs: number): number {
  const d = new Date(nowMs)
  return d.getHours() * 60 + d.getMinutes()
}
```
Reemplazar los call sites por `minutesOfDayInTz(new Date(nowMs).toISOString(), locationTimezone)` (con `const { locationTimezone } = useLocation()` ya presente en `ClockPage` — línea ~99 tiene `const { locationId } = useLocation()`; agregar `locationTimezone` a ese destructuring). Borrar `nowMinutesFromMidnight`.

- [ ] **Step 3: Verificación + typecheck + build**

```bash
cd bienbravo-pos
npm run typecheck
npm test
npm run build
```
Expected: typecheck sin errores; vitest en verde; build OK. (Byte-identical hoy: device en Monterrey → `minutesOfDayInTz(...,'America/Monterrey')` == `d.getHours()*60+d.getMinutes()`.)

- [ ] **Step 4: Commit + push**

```bash
cd bienbravo-pos
git add src/features/clock/presentation/ClockPage.tsx src/features/clock/application/useClock.ts
git commit -m "fix(tz): gate de puntualidad del POS compara wall-clock en la tz de la sucursal

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

## Task 6: POS `todayISO()` → día local en tz de sucursal

(Agregada tras el review de Task 4: `todayISO()` arma un `YYYY-MM-DD` **device-local** — `getFullYear/getMonth/getDate`, no `toISOString` así que no es bug live — que alimenta variables `date` de queries. Mismo bug family que Task 4; quedó fuera de la lista original de sitios.)

**Files (todos *modify*):**
- `src/features/home/presentation/HoyPage.tsx` (`todayISO` def ~26-32, uso ~61)
- `src/features/my-day/presentation/MyDayPage.tsx` (`todayISO` def ~26-34, uso ~310)
- `src/features/auth/presentation/LockPage.tsx` (`todayISO` def ~18-24, uso ~149)
- `src/features/clock/application/useClock.ts` (`todayISO` def ~5, uso ~82)

**Interfaces:**
- Consumes: `localDayInTz(instant: Date | number, tz): string` (Task 2) + `useLocation().locationTimezone`.

**Recipe:** borrar cada `todayISO()` module-level y reemplazar su uso por `localDayInTz(new Date(), locationTimezone)`, con `const { locationTimezone } = useLocation()` en el componente/hook (agregarlo al destructuring existente donde ya se usa `useLocation()`). Byte-identical hoy (device en Monterrey → `localDayInTz(...,'America/Monterrey')` == el `YYYY-MM-DD` local que arma `todayISO`).

- [ ] **Step 1: HoyPage**

`HoyPage` ya usa `useLocation()` (Task 4 agregó `locationTimezone`). Borrar la función `todayISO` (líneas ~26-32) y en el uso (~61) cambiar `const date = todayISO()` por:
```ts
const date = localDayInTz(new Date(), locationTimezone)
```
Asegurar el import: `import { localDayInTz, localDayRangeInTz } from '@/shared/lib/date'` (localDayRangeInTz ya se importó en Task 4). Si el `date` se consume en un `useMemo`/`useCallback`, agregar `locationTimezone` a sus deps.

- [ ] **Step 2: MyDayPage**

Borrar la función `todayISO` (líneas ~26-34, incluido el comentario de UTC) y en el uso (~310) cambiar `const d = todayISO()` por:
```ts
const d = localDayInTz(new Date(), locationTimezone)
```
`MyDayPage` ya destructura `locationTimezone` de `useLocation()` (Task 4). Actualizar deps del callback/effect que consume `d` si aplica.

- [ ] **Step 3: LockPage**

Borrar la función `todayISO` (líneas ~18-24) y en el uso (~149) cambiar `const date = todayISO()` por:
```ts
const date = localDayInTz(new Date(), locationTimezone)
```
`LockPage` ya destructura `locationTimezone` (Task 4). Actualizar deps si aplica.

- [ ] **Step 4: useClock**

Borrar la función `todayISO` (línea ~5) y en el uso (~82) cambiar `const d = todayISO()` por:
```ts
const d = localDayInTz(new Date(), locationTimezone)
```
`useClock` obtiene `locationTimezone` de `useLocation()` (Task 5 ya lo agregó al hook; si Task 5 aún no lo agregó por orden de ejecución, agregarlo aquí: `const { locationTimezone } = useLocation()`). Import: `import { minutesOfDayInTz, dayOfWeekInTz, localDayInTz } from '@/shared/lib/date'`. Actualizar deps del `useMemo`/`useCallback` que consume `d`.

- [ ] **Step 5: Verificación byte-identical + tsc + test + build**

```bash
cd bienbravo-pos
TZ=America/Monterrey node -e "
function localDayInTz(inst,tz){return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(inst))}
const now=new Date('2026-07-06T18:00:00Z');
const y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,'0'),d=String(now.getDate()).padStart(2,'0');
const old=\`\${y}-\${m}-\${d}\`;
const neu=localDayInTz(now,'America/Monterrey');
console.log('todayISO', old, neu, old===neu);
"
npx tsc -b && npm test && npm run build
```
Expected: `todayISO ... true`; tsc/vitest/build en verde. Confirmar `grep -rn "todayISO" src/ --include='*.ts' --include='*.tsx'` sin definiciones ni usos restantes (solo, si acaso, en tests).

- [ ] **Step 6: Commit**

```bash
cd bienbravo-pos
git add src/features/home/presentation/HoyPage.tsx src/features/my-day/presentation/MyDayPage.tsx src/features/auth/presentation/LockPage.tsx src/features/clock/application/useClock.ts
git commit -m "fix(tz): todayISO del POS usa el día local de la sucursal (no device-local)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (contra el spec)

**1. Cobertura del spec:**
- A (API: timezone en PosPublicLocation + select + cache key bump + regen) → Task 1. ✓
- B (POS fundación: query+PosLocation+LocationProvider.locationTimezone + shared/lib/date.ts + tests vitest con Cancun) → Task 2. ✓
- C1 (formatters: 8 literales + browser-local → helpers) → Task 3. ✓
- C2 (day-boundaries: HoyPage/CajaPage/useAgenda/MyDayPage/LockPage) → Task 4. ✓
- C3 (lateness gate: ClockPage/useClock minutos + día-de-semana) → Task 5. ✓
- Fallback BRANCH_TZ_DEFAULT → Task 2 (LocationProvider) + default de firma. ✓
- Byte-identical + verificación (vitest/typecheck/build/codegen) → cada task. ✓
- Secuencia API-first → Task 1 pushea antes que Task 2 corra codegen. ✓

**2. Placeholders:** cada step tiene código concreto y comandos con expected. Sin TBD/TODO. Las líneas exactas se listan; el implementer confirma el número exacto al abrir el archivo (los rangos son guías, no adivinanzas — vienen de grep real).

**3. Consistencia de tipos:** las 7 firmas de `shared/lib/date.ts` (Task 2 Produces) se consumen idénticas en Tasks 3-5: `formatTimeInTz(iso,tz,opts?)`, `formatDateTimeInTz(iso,tz,opts?)`, `minutesOfDayInTz(iso,tz)`, `dayOfWeekInTz(iso,tz)`, `localDayInTz(instant,tz)`, `localDayRangeInTz(ymd,tz)→{startUtc,endUtc}`, `BRANCH_TZ_DEFAULT`. `useLocation().locationTimezone: string` (Task 2) se consume igual en Tasks 3-5.
