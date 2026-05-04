# POS Home / Hoy — Design

**Date:** 2026-05-04
**Author:** Mike + Claude (brainstorm)
**Scope:** Sub-project #2 of the POS rework. **Pivoted from grid-launcher to queue-list (Direction D)** after smoke testing the v1 felt cheap and didn't match how a barber actually works. This spec is the post-pivot canonical design.
**Prerequisites:** Sub-#0 (Visual Language) and Sub-#1 (Lock screen + sesión) merged to master. API PR #11 (`posCajaStatusHome`) merged to bienbravo-api main.

---

## Context — why the pivot

The first attempt at Sub-#2 was a 3×2 feature-tile grid (Cobrar / Walk-ins / Agenda / Caja / Reloj / Mi día). When we smoke-tested it, the user felt it looked "cheap and ugly" — the diagnosis:

1. **6 tiles equal-weight is wrong** — Cobrar/Walk-ins/Agenda are 95% of daily use; Caja/Reloj/Mi día are admin actions that happen 1-3 times per shift. Treating them all the same is the "Windows 8 Metro" pattern.
2. **No content soul** — all chrome (chips, labels, tile names) and zero real content (no customer photos, no service info, no queue). Premium barbería POS apps (Booksy, Squire, Treatwell) lead with the customer/queue, not a generic launcher.
3. **`$0` commission hero at start of day is depressing** and uninformative — better to fold into a smaller stat with positive framing.

The pivot: Hoy becomes a **queue-list view** showing the operator's day at a glance — citas + walk-ins ordered chronologically, with the active service highlighted and a contextual CTA to advance the day. Cobrar lives as a flow contextual to a specific row, not as a separate tab. Bottom-tab navigation is preserved (familiar to current barbero population) and tabs adapt to the new IA.

## Privacy + role model

Current system shows everyone everything (Pedidos lists everyone's transactions; Sucursal aggregates by employee). User directive: each barbero should focus on what's theirs. But some operations are inherently communal (the iPad is one shared device per sucursal).

| Tab/View | Communal or Personal | Rationale |
|---|---|---|
| **Reloj** | Communal | iPad is shared; whoever opens it can clock anyone in/out (current pattern, low friction) |
| **Hoy** | Personal | The logged-in barbero sees only their citas + walk-ins assigned to them, plus the shared queue of unassigned walk-ins |
| **Mis ventas** | Personal | Filtered to the logged-in barbero's transactions today (fixes the "todos ven Pedidos de todos" problem) |
| **Caja** | Communal | Anyone opens/closes; everyone sees state. **No per-employee commission breakdown in POS** — that lives in admin web app for managers |

There are NO manager-only sections in POS. Managers go to admin web app for analytics, reports, multi-location overview. POS = floor-operations tool only. Same UI for everyone.

## Visual language

Consumes Sub-#0 foundation tokens (`--color-carbon`, `--color-bone`, `--color-leather-muted`, `--color-bravo`, `--color-success`, `--font-pos-display`, `--pos-text-*`, `--pos-touch-*`). Sharp corners, leather rules, sentence-case copy. Adds **Game Icons** (CC BY 3.0, Lorc + Delapouite) for the bottom-tab + future inline icons:

- Reloj → `lorc/stopwatch`
- Hoy → `delapouite/calendar`
- Mis ventas → `delapouite/two-coins`
- Caja → `delapouite/strongbox`

Icons are SVGs with `fill="currentColor"`, downloaded into `src/shared/pos-ui/icons/` and exported as React components. License attribution lives in `src/shared/pos-ui/icons/LICENSE_GAME_ICONS.md`.

## Layout (iPad landscape primary, mobile responsive)

The PosShell wraps everything; this spec defines the Hoy view that fills the shell's `<Outlet />`. Bottom-tab navigation is a NEW addition to PosShell (replaces / complements the existing top bar).

### Top — Identity strip (PosShell upgrade)

```
[BIENBRAVO]  [SUCURSAL NORTE]                    [● ONLINE]  [11:47 / LUN 4 MAY]  [EC avatar]  [⌬ lock]
```

- Brand wordmark (uppercase, tracking 0.08em, weight 800)
- Sucursal name in mono small caps
- Right side: `ONLINE` pill (success tone), live clock + date, viewer avatar (photo or initials), lock button
- Height ~56-64px on tablet, ~48px on mobile

This replaces the current PosShell top strip ("Sucursal activa" placeholder text). Sucursal name now real (read from `useLocation()` or context that fetches the location detail).

### Body — Hoy view

1. **Greeting line** (`Hola, Eli.` sentence case, small)
2. **Commission row** — single horizontal line: `$845` big numeral + caption stack `COMISIONES HOY · 5 servicios · va para ~$1,400 al cierre`. Border-bottom leather. When `amountCents === 0` and `serviceCount === 0`, copy reads `0 servicios · empezamos el día` (positive framing, never depressing).
3. **Hoy list** (vertical, scrollable) — chronological order:
   - Active service (highlighted with bravo left rule + bg)
   - Next assigned (cuero left rule, lighter)
   - Walk-ins PENDING from the shared queue (dashed avatar border + cuero bg, visually distinct as "shared/unassigned")
   - Future appointments (plain rows)
4. **Contextual CTA bar** (full-width, bravo, fixed above bottom-tab) — copy adapts:
   - If `caja.isOpen === false` → `Abrir caja` (highest priority)
   - Else if active service exists → `Cobrar a <name>` with `EN SERVICIO · <X> MIN` meta
   - Else if next assigned exists → `Atender a <name>` with `<time> · <service>` meta
   - Else if shared walk-in queue has someone → `Atender al siguiente: <name>`
   - Else → `Nueva venta` (manual cobro/walk-in entry)

### Bottom — Tab navigation (NEW, replaces nothing — added)

```
[stopwatch] Reloj   [calendar] Hoy*   [two-coins] Mis ventas   [strongbox] Caja $2,840
```

Tabs:
- 4 tabs equal grid, full-width
- Tab height: `h-20` tablet (80px), `h-16` mobile (64px)
- Icon: 26-28px, `currentColor`, color shifts based on active state
- Label: mono small caps, tracking 0.2em, weight 700
- Active state: top border 2px bravo + bg `bravo/4` + label color `bone`
- Inactive: label color `bone-muted`, hover deepens
- Caja tab uniquely shows a meta line under the label: `$2,840` (acumulado actual). Mi ventas tab CAN show similar meta but starts blank.

Active tab is determined by route (`/hoy`, `/reloj`, `/mis-ventas`, `/caja`).

## Component spec

### Foundation primitives reused (already shipped on branch)

- `<StatusBoard>` — built but not used in Hoy. Available for future sub-projects (#3 Caja status header, #6 Walk-ins).
- `<FeatureTile>` — built but not used in Hoy. Available for future sub-projects.
- `<PlaceholderPage>` — used for `/caja` and `/my-day` interim screens until those sub-projects ship.

These three are NOT thrown away. They live in `@/shared/pos-ui` as foundation. Sub-#2 just doesn't consume them.

### New foundation primitive

#### `<BottomTabNav>` (`src/shared/pos-ui/BottomTabNav.tsx`)

```ts
interface BottomTabNavTab {
  to: string                    // route, e.g., '/hoy'
  icon: PosIconComponent
  label: string                 // 'Reloj', 'Hoy', etc.
  meta?: string                 // optional second line, e.g., '$2,840' for Caja
  badge?: number                // optional bravo numeric badge
}

interface BottomTabNavProps {
  tabs: BottomTabNavTab[]
  activeTo: string              // matches one of the tabs' `to`
}
```

Renders fixed-bottom tab bar. Tabs use NavLink-style active matching from React Router. Each tab is a `<button>` with `cursor-pointer`. Top border bravo on active. Hover state on inactive.

Foundation level so PosShell can consume it.

### New game-icon React components (`src/shared/pos-ui/icons/`)

- `StopwatchIcon`, `CalendarIcon` (re-named/renamed from existing GoogleIcon if conflict — see migration), `TwoCoinsIcon`, `StrongboxIcon` — wrappers around inline SVG with `fill="currentColor"`.
- Naming: drop the `GameIcons` prefix; just `StopwatchIcon` etc. exported from `@/shared/pos-ui/icons`. If the existing `GoogleIcon.tsx` already exports a `CalendarIcon` (it does), we differentiate by prefixing the Game version: `GameCalendarIcon`. **Decision**: prefer `GameCalendarIcon` to avoid shadowing existing Material icons used elsewhere.
- Add `LICENSE_GAME_ICONS.md` with attribution.

For Sub-#2 we only need 4 icons (Reloj/Hoy/Mis ventas/Caja tabs). More can be added on demand.

### Home-specific components

#### `<IdentityStrip>` (`src/app/IdentityStripV2.tsx`)

PosShell upgrade. Renders the new top strip. Replaces the existing `<header>` block in `PosShell.tsx`.

```ts
interface IdentityStripProps {
  brand?: string                // 'BIENBRAVO'
  sucursalName: string
  isOnline: boolean
  now: Date
  staffName: string
  staffPhotoUrl?: string | null
  onLock: () => void
}
```

Renders:
- Left: brand + sucursal mono small caps
- Right: ONLINE pill + clock block (time tabular-nums + date mono caps) + avatar + lock button

This becomes the PosShell's persistent top region across all routes.

#### `<HoyView>` (`src/features/home/presentation/HoyView.tsx`)

Replaces `<HomeView>`. Pure presentational. Takes a `HoyViewModel`.

```ts
interface HoyViewModel {
  staffName: string
  commission: { amountCents: number; serviceCount: number; loading: boolean; projectedCents?: number | null }
  rows: HoyRowData[]
  cta: ContextualCTAData | null   // null when no actionable context (rare; usually shows "Nueva venta")
  cajaIsOpen: boolean
}

interface HoyRowData {
  id: string
  kind: 'active' | 'next' | 'queue' | 'pending'
  timeLabel: string             // '12:30' or 'EN SERVICIO · 12 MIN' or 'EN COLA'
  customerName: string
  customerPhotoUrl: string | null
  customerInitials: string
  serviceLabel: string          // 'Corte clásico'
  meta: string | null           // 'siguiente' | 'esperando 8 min · sin asignar' | 'cita 11:30 · check-in 11:32' | null
  pillLabel: string             // 'Servicio' | 'Cita' | 'Walk-in'
  pillTone: 'serving' | 'appt' | 'walkin'
  onClick: () => void           // tap to override "next" / open detail
}

interface ContextualCTAData {
  metaLabel: string             // 'EN SERVICIO · 12 MIN' or 'CITA 12:30' or null
  actionLabel: string           // 'Cobrar a Carlos Méndez' or 'Abrir caja'
  variant: 'cobrar' | 'atender' | 'abrir-caja' | 'nueva-venta'
  onClick: () => void
}
```

Renders greeting + commission row + scrollable list + CTA bar. No data fetching.

#### `<HoyRow>` (`src/features/home/presentation/HoyRow.tsx`)

Single row in the Hoy list. Renders avatar/photo + time + name/service + status pill. Apply visual treatment per `kind`:
- `active` — bravo left rule 3px, bg `bravo/6`, time block reads "EN SERVICIO · X MIN" in mono, pill `Servicio` bravo
- `next` — cuero left rule 2px, bg cuero/4, time block normal, pill `Cita` muted
- `queue` — dashed avatar border, bg cuero/2, time block "EN COLA" in mono cuero, pill `Walk-in` cuero — visually distinct as "shared/unassigned"
- `pending` — plain row, normal time, pill `Cita` or `Walk-in` muted

Avatar logic: if `customerPhotoUrl` present, render `<img>` filling the circle (object-cover). Else render the initials block.

#### `<ContextualCTABar>` (`src/features/home/presentation/ContextualCTABar.tsx`)

Full-width bravo bar at the bottom of Hoy (above bottom-tab nav). Renders meta + action + arrow icon. Tap fires `onClick`. Hover deepens the bravo background.

```ts
interface ContextualCTABarProps {
  metaLabel?: string
  actionLabel: string
  variant: 'cobrar' | 'atender' | 'abrir-caja' | 'nueva-venta'
  onClick: () => void
}
```

The `variant` is mostly for instrumentation/testing — visual is the same.

#### `<HoyPage>` (`src/features/home/presentation/HoyPage.tsx`)

Orchestrator. Renamed from `<HomePage>`. Reads the same data sources (agenda, clock, walkins, commission, caja status), plus filters per logged-in staff. Adds derivation of `rows` (mixed timeline) and `cta` (contextual logic).

```ts
const { agenda, clock, walkins } = useRepositories()
// + apollo queries for commission + caja status (already shipped)

useEffect onMount + on focus:
  Promise.allSettled([
    agenda.getAppointments(today, locationId),       // filtered to assigned to current staff
    clock.getEvents(staffId, locationId, today),
    walkins.getWalkIns(locationId),                  // includes PENDING (shared) + ASSIGNED to current staff
    apollo.query(POS_HOME_COMMISSION),
    apollo.query(POS_HOME_CAJA_STATUS),
  ])
  → derive HoyViewModel via deriveHoyViewModel(...)
```

#### `deriveHoyViewModel` (`src/features/home/presentation/deriveHoyViewModel.ts`)

Pure function. Replaces `deriveHomeViewModel`. Differs significantly:
- No `statusChips` (StatusBoard not used)
- No `tiles` (FeatureTile not used)
- New `rows[]` and `cta` derivation
- Privacy filter applied: only include appointments/walk-ins where `staffUser.id === staffId` OR walk-ins with `status === 'PENDING'` (queue) AND `assignedStaffUser === null`

Derivation:
1. Build candidates list:
   - Appointments assigned to me (any status)
   - Walk-ins assigned to me OR PENDING (queue, unassigned)
2. Sort chronologically by start time (appointments use `startAt`, walk-ins use `createdAt`)
3. Mark active (IN_SERVICE / ASSIGNED to me) vs next vs pending vs queue
4. Compute `cta` based on caja state + active service + next + queue:
   - Caja closed → `abrir-caja`
   - Active service exists → `cobrar` for that customer
   - Next assigned exists → `atender` for that customer
   - Queue has someone → `atender al siguiente` (queue head)
   - Fallback → `nueva-venta`

### Updated `<PosShell>`

PosShell rewrites:
- New `<IdentityStripV2>` at top
- `<Outlet />` in middle
- New `<BottomTabNav>` at bottom with 4 tabs

The current `<Navigate to="/" replace />` redirect logic on `!viewer || isLocked` is preserved.

### Routing changes

| Route | Before | After |
|---|---|---|
| `/` | `LockPage` | `LockPage` (unchanged) |
| `/home` | `HomePage` (grid) | (deprecated — redirect to `/hoy` for old links) |
| `/hoy` | doesn't exist | `HoyPage` (new) |
| `/checkout` | `CheckoutPage` | (unchanged for now; sub-#4/5 redesigns) |
| `/walkins` | `WalkInsPage` | (unchanged for now; sub-#6 redesigns) |
| `/agenda` | `AgendaPage` | (unchanged for now; sub-#7 redesigns) |
| `/clock` | `ClockPage` | `/reloj` redirects here for tab consistency |
| `/register` | `RegisterPage` | `/caja` redirects here for tab consistency |
| `/my-day` | `MyDayPage` | `/mis-ventas` (new path); old `/my-day` redirects |

Bottom-tab `to` paths use the human Spanish: `/reloj`, `/hoy`, `/mis-ventas`, `/caja`. Underlying components stay at original paths for now; routing aliases handle the renames. Sub-#9 redesigns Mis ventas content; Sub-#3 redesigns Caja content.

After login, the post-PIN redirect goes to `/hoy` (was `/home`).

## Data flow + lifecycle

### Hoy data

```
HoyPage onMount + on window.focus:
  [appointments(today, location, filter staffId=me),
   clockEvents(staffId, location, today),
   walkIns(location, mine + PENDING),
   commission(staffId, location, today),
   posCajaStatusHome(location)]
→ deriveHoyViewModel
```

Filters applied **client-side** for sub-#2 (the API repos return all data; we filter to current staff). Sub-#3+ may push privacy filtering server-side if performance demands it; for the small data sizes here (5-15 items per staff per day), client filter is fine.

`window.focus` re-fetch preserves staleness behavior. No polling.

### Caja status & contextual CTA

`posCajaStatusHome` returns `{ isOpen, accumulatedCents, openedAt }`. The CTA derivation uses `isOpen` to short-circuit: if false → `abrir-caja` regardless of other context. Tapping `Abrir caja` navigates to `/caja` (sub-#3 placeholder until that ships; for now, it shows the existing v1 RegisterPage which already has open/close flow).

The Caja tab in bottom-tab nav shows `accumulatedCents` formatted as a tiny meta line under "Caja". Updates on every Hoy refresh.

### Tab badges (deferred)

For walk-ins queue size or pending appointments, badges on tabs would be nice — defer to a future iteration. Sub-#2 ships without badges.

## Edge cases

- **Empty day** (no appts + no walk-ins for me + no shared queue): list shows a single editorial empty row "Hoy todavía no tienes movimiento". CTA falls back to `Nueva venta`.
- **Caja closed** + active service exists: this should never happen in practice (couldn't have started service without caja open). If it does (sync issue), CTA prioritizes `abrir-caja`.
- **Logged-in barbero with no appointments but walk-ins waiting**: queue rows show, CTA prompts `Atender al siguiente: <name>`.
- **Customer photo missing**: render initials with cuero bg.
- **Walk-in with no customer name** (anonymous): row shows "Walk-in" as name, queue position as meta.
- **Multiple active services for me** (rare bug case): shouldn't happen given sub-#1 lock, but if both an appointment IN_SERVICE and a walk-in ASSIGNED exist, prefer the appointment (more committed). Show one row as active; the other gets `next`.
- **Stale data after 30+ min idle**: `window.focus` re-fetch covers it.
- **Mobile viewport (<768px)**: bottom-tab gets `h-16`, list rows compact (avatar 40px), CTA stays full-width. Identity strip stacks brand below sucursal if needed.

## What gets retired from the v1 attempt (PR #10)

The current PR #10 has these components/files that become obsolete with the pivot. They WILL be deleted or rewritten:

- `src/features/home/presentation/HomeView.tsx` (grid layout) → replaced by `HoyView.tsx`
- `src/features/home/presentation/HomePage.tsx` → renamed/rewritten as `HoyPage.tsx`
- `src/features/home/presentation/CommissionHero.tsx` → DELETED (commission now inline in HoyView, no separate component)
- `src/features/home/presentation/ActiveServiceStrip.tsx` → DELETED (replaced by `ContextualCTABar`)
- `src/features/home/presentation/deriveHomeViewModel.ts` + tests → replaced by `deriveHoyViewModel.ts`

What survives from PR #10 work:
- `<StatusBoard>` foundation primitive (unused in Sub-#2, kept for future)
- `<FeatureTile>` foundation primitive (unused in Sub-#2, kept for future)
- `<PlaceholderPage>` foundation primitive (used for /caja /my-day interim)
- `src/features/home/data/home.queries.ts` (POS_HOME_COMMISSION + POS_HOME_CAJA_STATUS, both still used)
- Schema sync (Task 1)
- API PR #11 (already merged to main, completely unaffected)

## Out of scope (deferred)

- Performance card / revenue display → Sub-#9 (admin web app, mostly)
- Activity table → admin web app
- Commission daily target / projection logic ("va para ~$1,400") — for sub-#2, hardcode / simple linear extrapolation
- Real `/caja` v2 redesign → Sub-#3
- Real `/mis-ventas` v2 redesign → Sub-#9
- Periodic polling for live updates → future iteration
- Push notifications → future
- Tab badges (walk-in queue count, pending appts count) → future iteration
- Photo upload UI for customers → future iteration (we use whatever's already in the customer table; Sub-#5 may add photo capture during cobro)
- Portrait iPad layout — landscape only

## Testing

| Layer | Tool | Critical cases |
|---|---|---|
| `deriveHoyViewModel` | vitest pure | empty day · only my appts · only walk-ins · mixed · active service · next · queue · privacy filter (other barbero's appt excluded) · CTA derivation matrix (caja closed → abrir-caja, active → cobrar, next → atender, queue → atender siguiente, fallback → nueva venta) |
| `<HoyRow>` | vitest + RTL | all 4 kinds render correctly · photo vs initials · pill tones · onClick fires |
| `<ContextualCTABar>` | vitest + RTL | renders meta + action · onClick fires · variant prop affects nothing visually but is exposed for tests |
| `<BottomTabNav>` | vitest + RTL | all 4 tabs render with icons · active tab gets bravo top border · meta line on Caja shows · onClick navigates |
| `<IdentityStripV2>` | vitest + RTL | brand + sucursal + clock + avatar + lock all render · onLock fires |
| `<HoyView>` | vitest + RTL | renders viewmodel correctly · empty state · all row kinds · CTA visible |
| `<HoyPage>` | vitest + RTL + `renderWithProviders` | mount fetches · focus re-fetches · partial fail soft-degrades (other tiles still render) · privacy filter applied (no other-barbero appts in result) |

Total expected new tests: ~30-40. Foundation primitive tests from PR #10 (StatusBoard, FeatureTile, PlaceholderPage) stay green. Existing ~80 tests stay green.

## Acceptance criteria

A barbero unlocks the iPad with their PIN. They see Hoy:

1. Their commission so far today is the most prominent number after the brand
2. Their list of citas + walk-ins (theirs + the shared queue) is visible chronologically
3. The customer currently in service is highlighted with bravo
4. A single contextual CTA at the bottom tells them what to do next ("Cobrar a X", "Atender a Y", "Abrir caja", or "Nueva venta")
5. They can tap any row in the list to override the suggested "next" and start with that customer instead
6. Bottom-tab navigation lets them reach Reloj / Mis ventas / Caja in one tap
7. They DO NOT see other barberos' appointments or commissions
8. The Caja tab shows the running total ($X acumulado) so they can glance at shop revenue without leaving Hoy

A barbero with no appointments and no walk-ins assigned still sees the shared queue. If the queue has a walk-in, the CTA reads "Atender al siguiente: <name>" — they can pick it up by tapping the CTA, which assigns the walk-in to them and starts the cobro flow.

A barbero arriving first thing in the morning with caja closed sees the CTA reading "Abrir caja". Tapping navigates to the caja open flow (existing RegisterPage for now; Sub-#3 redesigns).

## File structure summary

**Created**:
- `src/shared/pos-ui/BottomTabNav.tsx` + test
- `src/shared/pos-ui/icons/StopwatchIcon.tsx`
- `src/shared/pos-ui/icons/GameCalendarIcon.tsx`
- `src/shared/pos-ui/icons/TwoCoinsIcon.tsx`
- `src/shared/pos-ui/icons/StrongboxIcon.tsx`
- `src/shared/pos-ui/icons/index.ts`
- `src/shared/pos-ui/icons/LICENSE_GAME_ICONS.md`
- `src/app/IdentityStripV2.tsx` + test
- `src/features/home/presentation/HoyView.tsx` + test
- `src/features/home/presentation/HoyRow.tsx` + test
- `src/features/home/presentation/ContextualCTABar.tsx` + test
- `src/features/home/presentation/HoyPage.tsx` + test
- `src/features/home/presentation/deriveHoyViewModel.ts` + test

**Modified**:
- `src/app/PosShell.tsx` — full rewrite to host `IdentityStripV2` + `BottomTabNav`
- `src/app/router.tsx` — add `/hoy`, `/reloj`, `/mis-ventas` routes; redirect `/home` → `/hoy`; redirect `/clock` ↔ `/reloj`, `/register` ↔ `/caja`, `/my-day` ↔ `/mis-ventas`
- `src/shared/pos-ui/index.ts` — export `BottomTabNav` and the 4 icons

**Deleted**:
- `src/features/home/presentation/HomeView.tsx`
- `src/features/home/presentation/HomeView.test.tsx`
- `src/features/home/presentation/HomePage.tsx`
- `src/features/home/presentation/HomePage.test.tsx`
- `src/features/home/presentation/CommissionHero.tsx` + test
- `src/features/home/presentation/ActiveServiceStrip.tsx` + test
- `src/features/home/presentation/deriveHomeViewModel.ts` + test

**Untouched** (foundation kept for future):
- `src/shared/pos-ui/StatusBoard.tsx` + test
- `src/shared/pos-ui/FeatureTile.tsx` + test
- `src/shared/pos-ui/PlaceholderPage.tsx` + test

## Cross-repo dependency

API PR #11 (`posCajaStatusHome`) is already merged to bienbravo-api `main` (commit `75d3df5`). Sub-#2 D consumes it (no new API work needed for this pivot).

## Notes

- Per `feedback_pos_users` memory: bias to simplicity for non-tech users. The pivot embraces this — single primary action (CTA), single primary view (queue list), familiar bottom-tab nav.
- Per `project_pos_split_attribution` memory: multi-recipient sale (papá + 2 hijos = 3 barberos) is a Sub-#5 acceptance test. Sub-#2 D doesn't touch the cobro flow itself — it just provides the entry point (tap row OR tap CTA). The flow stays current behavior until Sub-#5 redesigns it.
- "Va para ~$1,400 al cierre" (commission projection) is a nice-to-have. For Sub-#2 ship it as a simple linear extrapolation: `(commission_so_far / hours_worked_so_far) × hours_remaining_in_shift`. If the shift hasn't been opened (clock-in unknown) or the formula gives nonsense, hide the projection.
- The icons set (StopwatchIcon, GameCalendarIcon, TwoCoinsIcon, StrongboxIcon) is the seed of a longer-term Game Icons set in `@/shared/pos-ui/icons/`. Sub-#3+ may add more (BarberChairIcon, ScrollIcon, SunriseIcon, etc.) following the same pattern.
