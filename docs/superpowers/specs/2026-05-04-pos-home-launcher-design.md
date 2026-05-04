# POS Home / Launcher — Design

**Date:** 2026-05-04
**Author:** Mike + Claude (brainstorm)
**Scope:** Sub-project #2 of the POS rework. Redesigns the Home page as a launcher: status board + feature picker, with a hero commission readout and conditional active-service awareness.
**Prerequisites:** Sub-#0 (Visual Language) and Sub-#1 (Lock screen + sesión) merged to `master`.

---

## Context

The current Home page works but is overscoped. It carries Performance KPIs and an Activity Table that semantically belong to Sub-#9 My Day, plus a heavy "ACCIÓN RÁPIDA / EN SERVICIO AHORA" CTA banner and 4 navigation tiles. Visually it's still v1 tokens (`bg-bb-surface`, `font-bb-display`, `rounded-2xl`).

This spec narrows the Home to a **launcher** per the Sub-#0 roadmap: status board + 6 feature tiles. Performance + activity move to Sub-#9 My Day when it ships. Commissions stay on Home as a hero — barbers want to see their earnings every time they look at the iPad.

Operators are non-tech users (per `feedback_pos_users` memory). Bias: simplicity, plain Spanish, predictable layouts, no hidden state, redundancy when it aids comprehension.

## Sub-project sequencing constraints

- **Sub-#3 Caja** has not shipped. The Caja status chip in StatusBoard reads the existing `RegisterSession` table; if no `OPEN` session exists for the location, chip reads "Caja sin abrir". The Caja tile navigates to `/caja` which renders a placeholder page until Sub-#3 lands.
- **Sub-#9 My Día** has not shipped. The Mi Día tile is present and tappable, navigates to `/my-day` placeholder.
- **No fakery.** Real data where it exists, honest "Próximamente" / "Sin abrir" / "—" elsewhere. Layout is stable from day 1.

## Visual language

Home consumes the foundation tokens defined in Sub-#0 (`--color-carbon`, `--color-bone`, `--color-leather-muted`, `--color-success`, `--font-pos-display`, `--pos-text-*`, `--pos-touch-*`, etc.). Sharp corners, leather rules, sentence-case copy. PosShell remains the global chrome.

## Layout (iPad landscape, 1180×820)

Top to bottom, with PosShell header always visible above:

1. **Greeting line** — `Hola, <Javi>.` sentence case, calmado. Identity reassurance after lock.
2. **CommissionHero** — big editorial numeral (`$345`) with caption `COMISIONES HOY · 8 servicios` small caps mono.
3. **StatusBoard** — three read-only chips: `Sucursal Norte` · `Caja abierta` · `Entrada 09:15`. `Caja` and `Entrada` chips use `--color-success` border + text when in success states. Chips are NOT tappable (mental model: estado, no atajo).
4. **ActiveServiceStrip** (conditional) — when the operator has a walk-in `ASSIGNED` or appointment `IN_SERVICE`, a strip appears with `EN SERVICIO · 12 MIN` lead, `Carlos Méndez · corte clásico` line, and a `Cobrar →` CTA right-aligned. Strip uses `--color-bravo` left rule and dim red background.
5. **Feature tile grid** — 3×2 grid:

```
Cobrar    | Walk-ins | Agenda
Caja      | Reloj    | Mi día
```

Each tile carries: icon (top-left), name (sentence case bold), subtitle (state info, muted small).

## Component spec

All tests under `*.test.tsx` next to component, vitest + RTL.

### `<StatusBoard>` (foundation, `src/shared/pos-ui/StatusBoard.tsx`)

```ts
interface StatusBoardProps {
  chips: { label: string; tone?: 'default' | 'success' }[]
  className?: string
}
```

Renders a flex row of chips. `default` tone: leather-muted border, bone-muted text. `success` tone: `--color-success` border + text. Chips are spans (not buttons). Sharp corners, mono small caps.

Reusable beyond Home (e.g., scheduling shifts overview, register status modal). Foundation primitive added to `@/shared/pos-ui`.

### `<FeatureTile>` (foundation, `src/shared/pos-ui/FeatureTile.tsx`)

```ts
interface FeatureTileProps {
  icon: PosIconComponent
  name: string                  // sentence case, e.g., "Cobrar"
  subtitle?: string             // state info, e.g., "2 esperando"
  badge?: number                // optional red badge for counts >0
  disabled?: boolean            // dims tile, blocks click
  onClick: () => void
  'aria-label'?: string
}
```

Renders a card-like button: icon container 24×24 leather-bordered top-left, `name` 16-18px bold sentence case below middle-vertical, optional `subtitle` 10-11px muted small caps, optional `badge` red `--color-bravo` chip top-right when `badge > 0`. Sharp corners, leather border, `--color-carbon-elevated` background. Active state darkens with `--color-cuero-viejo`.

Foundation primitive added to `@/shared/pos-ui`. Reusable beyond Home (e.g., feature pickers in admin shells).

### `<CommissionHero>` (`src/features/home/presentation/CommissionHero.tsx`)

```ts
interface CommissionHeroProps {
  amountCents: number
  serviceCount: number
  loading?: boolean
}
```

Renders:
- Big numeral in `--font-pos-display`, ~44px, font-weight 800, `letter-spacing: -0.03em`, formatted as `formatMoney(amountCents)` (e.g., `$345`).
- Caption stack to the right: `COMISIONES HOY` mono small caps top, `8 servicios` (pluralized: `1 servicio` / `N servicios`) below in body-sized text.
- Loading: skeleton block where the numeral goes, caption text shows "—".

Feature-specific (not foundation) — copy and structure are Home-specific.

### `<ActiveServiceStrip>` (`src/features/home/presentation/ActiveServiceStrip.tsx`)

```ts
interface ActiveServiceStripProps {
  customerName: string
  serviceLabel: string          // e.g., "corte clásico" — from appointment.items[0]?.label or walkIn service hint
  minutesElapsed: number
  onCobrar: () => void
}
```

Renders only when present (parent controls). Layout: left-side meta `EN SERVICIO · 12 MIN` + main label `Carlos Méndez · corte clásico`; right-side `<TouchButton variant="primary">Cobrar →</TouchButton>`. Uses `--color-bravo` for left rule and accent.

Feature-specific.

### `<HomePage>` (`src/features/home/presentation/HomePage.tsx`)

Orchestrator. Reads:

```ts
const { agenda, clock, walkins } = useRepositories()
const apollo = useApolloClient()
```

On mount and on `window.focus`:

```ts
Promise.all([
  agenda.getAppointments(todayRange, locationId),
  clock.getEvents(viewer.staff.id, locationId, today, today),
  walkins.getWalkIns(locationId),
  apollo.query<StaffCommissionTodayQueryResult>(STAFF_COMMISSION_TODAY, vars),
  apollo.query<PosCajaStatusHomeQueryResult>(POS_CAJA_STATUS_HOME, vars),
])
.then(([appts, events, wkins, commission, caja]) =>
  setViewModel(deriveHomeViewModel({ appts, events, wkins, commission, caja, staffId, staffName, locationName }))
)
.catch(() => setViewModel(deriveErrorViewModel(staffName)))
```

Window focus handler attaches in a `useEffect`, removed on unmount.

`POS_CAJA_STATUS_HOME` query (new, defined in `src/features/home/data/home.queries.ts`):

```graphql
query PosCajaStatusHome($locationId: ID!) {
  posCajaStatusHome(locationId: $locationId) {
    isOpen
    accumulatedCents      # null if closed
    openedAt              # null if closed
  }
}
```

The Sub-#2 API resolver is a thin read-only wrapper over the existing `RegisterSession` table — picks the most recent `OPEN` session for the location and returns `isOpen` + the running `accumulatedCents` (sum of completed sales linked to that session) + `openedAt`. Full open/close write-side mutations land in Sub-#3.

### `<HomeView>` (`src/features/home/presentation/HomeView.tsx`)

Pure presentational. Takes `HomeViewModel`, renders the layout. Zero data fetching.

```ts
interface HomeViewModel {
  staffName: string
  commission: { amountCents: number; serviceCount: number; loading: boolean }
  statusChips: { label: string; tone: 'default' | 'success' }[]
  activeService: {
    customerName: string
    serviceLabel: string
    minutesElapsed: number
    onCobrar: () => void
  } | null
  tiles: {
    cobrar: { subtitle: string }
    walkins: { subtitle: string; badge?: number }
    agenda: { subtitle: string; badge?: number }
    caja: { subtitle: string }
    reloj: { subtitle: string }
    midia: { subtitle: string }
  }
}
```

The viewmodel carries data only — no callbacks. `HomeView` resolves navigation itself via `useNavigate`, mapping each tile to its hardcoded route. `activeService.onCobrar` is also resolved inside `HomeView`. This keeps `deriveHomeViewModel` pure and trivially testable.

### `deriveHomeViewModel` (pure function, `src/features/home/presentation/deriveHomeViewModel.ts`)

Pure function. Input: raw repo + query results + staff/location identity. Output: `HomeViewModel`. Testable with vitest, no React, no navigate, no Apollo.

Pluralization helper: `pluralize(n, 'servicio', 'servicios')`.

### Tile subtitle copy

| Tile | Subtitle (data state) | Subtitle (empty / loading / error) |
|---|---|---|
| Cobrar | `Iniciar cobro` (always — no state-dependent copy) | same |
| Walk-ins | `2 esperando` (with badge `2` when count > 0) | `Sin walk-ins` / `—` on error |
| Agenda | `5 citas hoy` (with badge `5` when count > 0) | `Sin citas hoy` / `—` on error |
| Caja | `$2,840 acumulado` when open / `Sin abrir` when closed | `—` on error |
| Reloj | `Entrada 09:15` when clocked-in | `Sin entrada` when not / `—` on error |
| Mi día | `Próximamente` (always — Sub-#9 not built) | same |

### Routing

| Route | Behavior |
|---|---|
| `/checkout` | Existing — Cobrar tile → here |
| `/walkins` | Existing — Walk-ins tile → here |
| `/agenda` | Existing — Agenda tile → here |
| `/clock` | Existing — Reloj tile → here |
| `/caja` | NEW — placeholder page until Sub-#3. Renders editorial centered message: `CAJA · Disponible próximamente · Aquí abrirás y cerrarás caja con conteo de denominaciones.` |
| `/my-day` | NEW — placeholder page until Sub-#9. Renders editorial centered message: `MI DÍA · Disponible próximamente · Verás tus comisiones por día, historial y rendimiento.` |

Both placeholder pages use a small generic `<PlaceholderPage title subtitle />` component that lives in `src/shared/pos-ui/PlaceholderPage.tsx` (foundation, reused by future placeholders).

## Data flow + lifecycle

- **Mount**: HomePage fetches all 5 sources in parallel via `Promise.all`. Sets viewmodel with `commission.loading = true` and tile subtitles "Cargando…" until resolved.
- **On window.focus**: refetches in background. Existing values stay visible, replaced in-place when new data arrives. No skeleton flash.
- **On error**: per-source fallback. If `agenda` fetch fails, agenda tile shows `—` and `Sin citas` is suppressed. Other sources continue. No global error banner.
- **Cleanup**: focus listener removed on unmount.

No polling. iPad battery preservation. If real-world feedback shows staleness is a problem, a future iteration adds 60s polling — not in MVP.

## Edge cases

- **Caja sub-#3 not built**: query returns `isOpen: false, accumulatedCents: null`. UI shows "Caja sin abrir" chip and tile subtitle.
- **Multiple active services** (rare): operator has a walk-in `ASSIGNED` to them AND an appointment `IN_SERVICE` simultaneously. ActiveServiceStrip shows the most recently-created one (by `createdAt` / `startAt` desc). The other is implicit in its tile's subtitle. No multi-strip stack.
- **No active service**: `activeService === null`, ActiveServiceStrip is not mounted. Tile grid expands to fill the freed vertical space (flex layout).
- **Operator missing permissions** (e.g., agenda.read revoked): tile still renders with subtitle `—`. Tap navigates; destination page handles the deny.
- **Window resize**: design assumes iPad landscape (1180×820). Layout uses flex + grid; portrait isn't supported in QA but won't visually break.
- **Stale data after long idle**: focus re-fetch resolves it. No "actualizado hace X" timestamps in v1.
- **Pluralization**: `1 servicio` vs `N servicios`. `1 cita` vs `N citas`. `1 esperando` vs `N esperando`. Helper handles all.

## What gets retired from current Home

- `NavTile` (inline, 4 tiles) → replaced by foundation `<FeatureTile>` × 6.
- `PerfRow` (revenue + commission progress bars) → eliminated (progress bars are noise for non-tech).
- "Performance card" with revenue + commissions → split: commissions promoted to `<CommissionHero>`, revenue moved to Sub-#9 My Day.
- "Activity Table" (recent activity hoy) → moved to Sub-#9 My Day.
- "CTA banner" (`ACCIÓN RÁPIDA · CABALLERO MODERNO` / `EN SERVICIO AHORA`) → split: active service awareness becomes `<ActiveServiceStrip>` (more compact). The "quick walkin shortcut" copy is dropped (Walk-ins tile is enough).

## Out of scope (deferred)

- Performance card / revenue display → Sub-#9 My Día
- Activity table → Sub-#9 My Día
- Commission daily target / projection (`va para $X`) → Sub-#9 with historical data
- Real `/caja` page (open/close flow with denomination count) → Sub-#3
- Real `/my-day` page → Sub-#9
- Periodic polling for live updates (currently focus-based) → future iteration if needed
- Push notifications for new appointments / walk-ins → future
- Portrait layout — iPad landscape only

## Testing

| Layer | Tool | Critical cases |
|---|---|---|
| `deriveHomeViewModel` | vitest pure | sin walk-ins / sin citas / caja closed / sin entrada / active walk-in / active appointment / pluralization 1 vs N |
| `<StatusBoard>` | vitest + RTL | chips render, success tone applies, no chips renders empty container |
| `<FeatureTile>` | vitest + RTL | sentence case, badge appears when >0, disabled blocks onClick, sub-text wraps |
| `<CommissionHero>` | vitest + RTL | money formatting, pluralization, loading skeleton |
| `<ActiveServiceStrip>` | vitest + RTL | renders content, onCobrar fires |
| `<HomeView>` | vitest + RTL | takes viewmodel, navigates correctly, ActiveServiceStrip absent when null |
| `<HomePage>` | vitest + RTL + `renderWithProviders` | mount fetches; focus re-fetches; partial fail shows `—` for failing source only |
| `<PlaceholderPage>` | vitest + RTL | title + subtitle render |

Total expected new tests: ~25-30 across the suite. Existing 81 stay green.

## Acceptance criteria

A barber opens the iPad after PIN entry and lands on Home. Without scrolling, they can:

1. See their commissions for the day prominently (`$345`).
2. Confirm sucursal, caja status, clock-in status at a glance.
3. If they have a service in progress, see it surfaced with a one-tap path to charge.
4. Reach any of the 6 features (Cobrar, Walk-ins, Agenda, Caja, Reloj, Mi día) with one tap.
5. Trust that data is fresh (refreshed on focus).

A barber who returns to the iPad after 30 minutes away sees up-to-date numbers without lifting a finger (focus refetch).

A barber selecting a tile that depends on a future sub-project (Caja, Mi día) lands on a placeholder page that explains what's coming, not a 404 or a confusing empty state.

## File structure summary

**Created**:
- `src/shared/pos-ui/StatusBoard.tsx` + test (foundation)
- `src/shared/pos-ui/FeatureTile.tsx` + test (foundation)
- `src/shared/pos-ui/PlaceholderPage.tsx` + test (foundation)
- `src/features/home/presentation/CommissionHero.tsx` + test
- `src/features/home/presentation/ActiveServiceStrip.tsx` + test
- `src/features/home/presentation/HomeView.tsx` + test
- `src/features/home/presentation/deriveHomeViewModel.ts` + test
- `src/features/home/data/home.queries.ts` (new GraphQL docs)
- `src/app/CajaPlaceholderPage.tsx`
- `src/app/MyDayPlaceholderPage.tsx`

**Modified**:
- `src/features/home/presentation/HomePage.tsx` (rewrite as orchestrator)
- `src/app/AppRoutes.tsx` or similar — add `/caja` and `/my-day` routes
- `src/shared/pos-ui/index.ts` — export new foundation primitives
- `bienbravo-api/src/modules/register/register.resolver.ts` — add `posCajaStatusHome` query (or similar)
- `bienbravo-api/src/graphql/schema.generated.graphql` — regen
- `bienbravo-pos/schema.graphql` — sync from API after PR merges

**Deleted**:
- `src/features/home/presentation/HomeView.tsx` content (full rewrite — same path, completely different content)

## Cross-repo dependency

`posCajaStatusHome` query is new in `bienbravo-api`. The query is small (one resolver, ~20 LoC, reads existing `RegisterSession` table without touching write paths). Two viable sequencings:

1. **API-first**: API plan adds resolver + schema, ships and merges to `main`. POS plan Task 1 syncs schema + codegen, then proceeds. Same pattern as Sub-#1. Recommended for safety.
2. **Same-cycle**: API change is small enough that an API PR + POS PR can coordinate, with POS depending on a temporary local schema until API merges. More cognitive overhead but faster turnaround.

Plan author picks based on appetite. Default to API-first unless there's pressure to ship fast.

## Notes

- The hero commission readout assumes `staffCommissionToday` already returns cents. Confirmed in current `HomePage.tsx`. No API change for commissions.
- Pluralization is small but matters for non-tech UX ("1 servicios" reads wrong).
- Per `feedback_pos_users` memory: bias toward simplicity. If during implementation a feature feels over-engineered, simplify rather than expand.
- Foundation primitives (`StatusBoard`, `FeatureTile`, `PlaceholderPage`) become reusable across the rest of the rework. Their plan should land them with care, since they'll be consumed in Sub-#3 onward.
