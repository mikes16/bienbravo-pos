# POS Polish + Performance Sweep — Design Spec

**Date:** 2026-05-04
**Sub-project:** sub-#6
**Status:** Approved for planning

---

## Goal

Single mega-sub-project that closes the gaps left after sub-#1–#5: route lazy loading + Apollo cache strategy revision (the "tarda en cargar" perception), foundation `<Skeleton>` primitive and consistent loading states across all pages, editorial v2 redesign of the 3 remaining v1 pages (WalkIns + Agenda + MyDay), deletion of v1 foundation primitives no longer used, polish pass on empty states + error UX + touch targets.

**Success criteria:**
- LCP improves measurably on cold load (target: <2.5s on iPad mid-tier)
- All pages have skeleton state matching their content shape
- Zero `bb-*` legacy tokens, zero `rounded-xl/2xl/3xl` in `src/`
- Zero v1 primitive imports (`PosCard`, `TapButton`, `SkeletonBlock`, `KanbanColumn`, `EmptyState`, `SectionHeader`, `StatusPill`)
- Touch targets minimum 40px across all interactive elements
- Bundle: main chunk under 200 kB gzipped (was 102 kB main but Apollo/router push total over budget)

## Out of scope

- Email receipts (`sendSaleReceipt` mutation) — sub-#4c
- Reporting per-barber on admin dashboards — sub-#4c
- Strict location-membership validation for per-line `staffUserId` — sub-#4c
- Bottom-tab redesign — already done
- Stripe Terminal integration — separate
- Offline mode — separate

---

## Architecture

### Five workstreams (parallelizable)

The sub-project bundles five related but disjoint workstreams. Most can execute in parallel via subagents because they touch different files.

#### Workstream 1 — Route lazy loading

`src/app/router.tsx` currently imports all 10 pages eagerly. Convert to React `lazy()` + per-route `<Suspense>` with a fallback skeleton that matches the route's content shape.

Result: main chunk drops from 397 kB → ~150 kB. Pages load on demand, with a brief skeleton during chunk fetch.

`<LockPage>` stays eager (it's the entry route, lazy-loading it means flash of loading state at boot).

`<HoyPage>` stays eager (it's the post-login landing route, hot path).

The other 8 pages lazy-load: `<CheckoutPage>`, `<CajaPage>`, `<OpenCajaPage>`, `<CloseCajaWizard>`, `<ClockPage>`, `<AgendaPage>`, `<WalkInsPage>`, `<MyDayPage>`.

#### Workstream 2 — Apollo cache strategy

Today: 14 of 16 queries use `fetchPolicy: 'network-only'`. Every navigation refetches catalog + state.

New strategy:

**Catalog** (services, products, combos, categories, barbers): `fetchPolicy: 'cache-first'`. Add `refetch on focus` for staleness recovery.

**Active state** (sales, register session, walk-ins, agenda for today, clock events for today): `fetchPolicy: 'cache-and-network'`. Cache-first paint + background refresh = instant UI feel.

**Mutations** (clockIn/Out, openSession, closeSession, createSale, etc.): unchanged (always hit network).

**Implementation**: replace `fetchPolicy: 'network-only'` with the strategic policy in each repository method. Affected files:
- `src/features/home/presentation/HoyPage.tsx`
- `src/features/walkins/data/walkins.repository.ts`
- `src/features/checkout/data/checkout.repository.ts`
- `src/features/register/data/register.repository.ts`
- `src/features/agenda/data/agenda.repository.ts`
- `src/features/clock/data/clock.repository.ts`

#### Workstream 3 — Foundation `<Skeleton>` primitive + apply across all pages

Build a new editorial-v2 skeleton primitive: sharp corners, `--color-cuero-viejo` bg, subtle pulse animation. Variants:
- `<SkeletonRow>` — single horizontal row (e.g., for list items)
- `<SkeletonCard>` — card-shaped block (for tile grids)
- `<SkeletonText>` — single text line
- `<SkeletonCircle>` — for avatars

Replace existing skeleton patterns:
- `<SkeletonBlock>` (legacy v1, rounded) → delete after migration
- Ad-hoc `animate-pulse bg-[var(--color-cuero-viejo)]` divs (ClockPage, OpenCajaPage) → use the primitive

Apply skeletons to v2 pages that lack them today:
- `<HoyPage>` — currently `return null` if no vm
- `<CajaPage>` — currently `return null` while loading
- `<CheckoutPage>` — has "Cargando catálogo…" text-only state
- `<ReceiptScreen>` — no skeleton (loaded after sale, instant data)

#### Workstream 4 — Editorial v2 redesigns (3 pages)

**`<WalkInsPage>`** (currently kanban with PendingCard / AssignedCard via `<PosCard>` + `<TapButton>` + `<StatusPill>` + `<KanbanColumn>`): redesign as editorial single-column queue with rows. Each row: customer name + wait time + barber assignment + actions ("Tomar" / "Asignar" / "Quitar"). Drop the kanban metaphor — a single linear queue with status pills (PENDING → ASSIGNED → IN-SERVICE → COMPLETED) is clearer for non-tech-savvy operators. Use existing `<TouchButton>` and editorial tokens.

**`<AgendaPage>`** (currently uses `<PosCard>` + `<SkeletonBlock>` for appointment list): redesign as time-grouped editorial list. Group by hour, each appointment as an editorial row (time + customer + service + barber + status). Status check-in / start / complete actions inline. No more cards — cleaner editorial rows with leather-rule dividers.

**`<MyDayPage>`** (currently uses `<PosCard>` + `<SkeletonBlock>`): redesign as editorial dashboard for the operator's personal day stats. Sections: Today's sales total, walk-ins served, appointments completed, current shift status. Mirror the language of CajaOpenView (status banner + KPI cards in editorial style).

For all 3: same patterns established in sub-#3/4b/5 — sharp corners, `--color-*` tokens, mono small-caps eyebrows, `--font-pos-display` for headlines, `<TouchButton>` for primary CTAs.

#### Workstream 5 — Cleanup + polish

- **Delete v1 primitives** (only used by the 3 legacy pages above): `PosCard.tsx`, `TapButton.tsx`, `SkeletonBlock.tsx`, `KanbanColumn.tsx`, `EmptyState.tsx`, `SectionHeader.tsx`, `StatusPill.tsx`. Verify no imports remain after Workstream 4.
- **Empty-state copy consistency**: each empty state's copy reviewed for tone (sentence case, no exclamation marks, no "¡Awesome!" energy). Voice: clear, direct, helpful. Examples: "Sin citas de hoy", "Aún no hay clientes esperando", "Cuando empieces a cobrar, aparecen aquí".
- **Error UX consolidation**: pick `role="alert"` editorial banner as the canonical pattern (already used in CajaOpenView, ReceiptScreen). Audit pages for ad-hoc inline error rendering and consolidate.
- **Touch target audit**: minimum 40px (`--pos-touch-min`). Run a sweep across all pages for buttons under that height.
- **Image optimization**: every `<img>` for barber/staff photos gets `loading="lazy"` + `decoding="async"`.

---

## Data flow

No data flow changes. Apollo cache policy revisions are config-only (no new mutations, no schema changes). Skeleton states are presentational. Editorial v2 redesigns reuse existing data layer (`useWalkIns`, `useAgenda`, etc.).

---

## Error handling

No new error paths. The error UX consolidation in Workstream 5 only changes presentation (consistent banner instead of ad-hoc inline), not error semantics.

---

## Testing strategy

### Unit tests for new primitives

`<Skeleton>` family (4 variants) gets one test file with ~6 cases covering each variant + visual class assertions.

### Tests for redesigned pages

Each redesigned page gets new test coverage matching the patterns from sub-#3/4b/5:
- `<WalkInsPage>` — ~6 tests (loading state, empty state, pending row render, action callbacks, drop confirm flow, status transitions)
- `<AgendaPage>` — ~5 tests (loading, empty, grouped-by-hour rendering, check-in callback, status pill colors)
- `<MyDayPage>` — ~4 tests (loading, KPI rendering, shift status, no-data state)

### Performance verification

- After lazy loading: `npm run build` reports each route chunk separately. Verify main chunk drops below 200 kB gzip.
- Manual smoke at iPad: cold-load `/checkout` should feel snappy (catalog from cache after first visit).

### Accessibility verification

After touch target sweep: `grep -rn "h-8\b\|h-7\b\|h-6\b" src/features/*/presentation/*.tsx` should return only icon containers (not buttons).

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Lazy loading breaks navigation if `<Suspense>` boundaries are wrong | Add a fallback skeleton at the route level; verify all 8 lazy routes render correctly via integration tests |
| `cache-and-network` causes flicker as background fetch updates UI | Apollo's default behavior is fine — the cache renders first, background fetch only updates if data differs. If flicker is real, switch specific queries to `cache-first` + `pollInterval` |
| Apollo cache stale after mutations | Mutations refetch related queries via `awaitRefetchQueries` or `update` callback. Walk through each mutation site to verify |
| Redesigning 3 pages in parallel via subagents conflicts | The 3 pages live in disjoint files (`src/features/walkins/`, `src/features/agenda/`, `src/features/my-day/`). Subagent dispatches won't collide. |
| Deleting v1 primitives breaks unrelated imports | Workstream 5 step 1 greps for remaining imports before deletion; if any non-legacy file still imports a primitive, refactor first |
| `<MyDayPage>` data layer is unclear | Inspect the existing data hook before redesigning — if data isn't fetched today, redesign focuses on the empty/scaffold state |

---

## Decisions log

- **Single sub-project not 4** — user prefers shipping the polish + perf wins together for clarity and a single PR review cycle.
- **Subagent parallelism** — workstreams 1, 2, 3, 4 (3 page redesigns), 5 are mostly disjoint; subagents will be dispatched in parallel where files don't overlap.
- **`cache-and-network` for active state** — best of both worlds: instant cache paint + background freshness. Apollo default for `useQuery` is `cache-first`; we explicitly switch to `cache-and-network` for staleness-sensitive views.
- **Skeleton primitive single foundation, multiple variants** — DRY but flexible. Replaces the existing scattered patterns.
- **Drop the kanban metaphor in Walk-Ins** — non-tech-savvy operators find a single ordered queue clearer than column-board status flow.

---

## Tech stack

Vite 7 + React 19 + TS 5 + Tailwind 4 + Apollo Client 4 + Vitest 3 + RTL. No new dependencies. Branch: `feat/pos-polish-perf-sweep`.
