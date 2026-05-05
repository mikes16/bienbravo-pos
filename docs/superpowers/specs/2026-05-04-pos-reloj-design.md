# POS Reloj — Design Spec

**Date:** 2026-05-04
**Sub-project:** sub-#5 (cross-repo: small API permission fix + POS frontend redesign)
**Status:** Approved for planning

---

## Goal

Fix a permission bug that prevents barberos from clocking in/out (API requires `timeclock.manage` which they don't have), and refactor `<ClockPage>` from v1 SaaS visual language to editorial v2 (single contextual CTA, sharp corners, editorial tokens). Aligns Reloj with Caja and Hoy in look and feel.

**Bug repro (reported by user):** Tap "CLOCK IN" → nothing happens. Apollo throws (forbidden), `useClock` catches and sets `error`, error renders with legacy `bb-danger` tokens that are invisible after the editorial v2 token sweep.

**Acceptance scenario:** Antonio (Barbero role) opens Reloj, taps "Entrar →", sees the timestamp event appear in today's history + status flips to "Activo". Later taps "Salir →", same flow in reverse. Shift status shows scheduled vs arrival vs retardo when applicable. No permission errors.

## Out of scope

- **Manager clocks-in someone else** — current resolver always uses `viewer.staff.id`; cross-staff clock-in needs a different mutation + UI
- **Penalties / payroll computation visible to barberos** — that lives in admin web (memory: no per-employee commission breakdown in POS)
- **Editing past clock events** — admin-only feature, separate UI
- **Clock-in from offline mode** — out of scope; relies on online API

---

## Architecture

### Two repos, atomic changes

1. **API (`bienbravo-api`, branch `feat/timeclock-self-permission`):**
   - Remove `requirePermission(viewer, 'timeclock.manage')` from `clockIn` + `clockOut` resolvers
   - Keep `if (!viewer.staff) throw new Error('Staff required')` — that's the real gate (the PIN session establishes who is logging in)
   - Add e2e test verifying a non-manager staff user can clockIn/clockOut
   - The current resolver always uses `viewer.staff.id` from the auth context — there's no way to clock in someone else, so removing the gate doesn't introduce an exploit

2. **POS (`bienbravo-pos`, branch `feat/pos-reloj`):**
   - Replace v1 `ClockPage.tsx` with editorial v2 redesign
   - Single contextual CTA: "Entrar →" when clocked out, "Salir →" when clocked in
   - Editorial tokens throughout (no `bb-*` legacy)
   - Single-column layout (no left/right split — better for iPad portrait + simpler for non-tech-savvy users)
   - Status hero (avatar + name + status pill)
   - Compact shift status row (programado · llegada · estado)
   - Today's events list below the action area
   - `useClock` hook stays as-is (no logic changes — same data, same handlers)

### Permission model after fix

Before:
```
clockIn: requires timeclock.manage AND viewer.staff
```

After:
```
clockIn: requires viewer.staff (any staff member can clock themselves)
```

`timeclock.manage` permission is still defined in the canonical list and used by future "manager clocks someone else" features. Today its only callers are `clockIn`/`clockOut`, which we're removing.

`timeclock.read` permission stays as the gate for reading other people's events (in admin/manager UIs).

---

## Components

### POS visual structure (single column, top to bottom)

```
┌──────────────────────────────────────────┐
│ Reloj                                    │ ← editorial display title
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ AVATAR · Antonio Pérez   [ACTIVO]   │ │ ← staff hero with status pill
│ │ Barbero                              │ │
│ └─────────────────────────────────────┘ │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │     SALIR →                          │ │ ← single contextual CTA
│ │     (Entrar → if clocked out)        │ │   TouchButton primary primary
│ └─────────────────────────────────────┘ │
│                                          │
│ TURNO HOY                                │ ← mono eyebrow
│ Programado    Llegada    Estado          │
│ 10:00 AM      10:08 AM   A tiempo        │ ← compact 3-col grid
│                                          │
│ HISTORIAL DE HOY                         │
│ • 10:08 — Entrada                        │
│ • 14:30 — Salida (almuerzo)              │
│ • 15:00 — Entrada                        │
│                                          │
└──────────────────────────────────────────┘
```

### File structure

**Modify (POS):**
- `src/features/clock/presentation/ClockPage.tsx` — full rewrite to editorial v2

**Create (POS):**
- `src/features/clock/presentation/ClockPage.test.tsx` — new tests (the v1 had none)

**Modify (API):**
- `src/modules/payroll/timeclock.resolver.ts` — remove `requirePermission` calls

**Create (API):**
- `test/e2e/timeclock-self.e2e-spec.ts` — verifies barbero (non-manager) can clockIn

`useClock` hook stays as-is (no changes). `clock.repository.ts` stays as-is.

---

## Data flow

```
[user taps "Entrar →"]
        │
        ▼
   ClockPage onClick
        │
        ▼
   useClock.doClockIn()
        │
        ▼
   clock.clockIn(locationId)  → API mutation
        │
        ▼
   API: getViewerFromContext (PIN session resolves to staff)
        │
        ▼
   API: if (!viewer.staff) throw  ← only gate now
        │
        ▼
   API: prisma.timeClockEvent.create({ staffUserId: viewer.staff.id, ... })
        │
        ▼
   API returns { clockIn: true }
        │
        ▼
   useClock: refresh() → re-fetch events
        │
        ▼
   isClockedIn = true → CTA flips to "Salir →"
   StatusPill flips to "Activo"
   New event appears in today's list
```

---

## Error handling

| Scenario | UX |
|---|---|
| API network failure | Error banner with editorial `--color-bravo` tokens (no longer `bb-danger`); says "Sin conexión, intenta de nuevo"; CTA stays enabled for retry |
| `viewer.staff` is null (corrupt session) | API throws "Staff required" → error banner shows; user re-authenticates via PIN |
| Already clocked in but tap "Entrar" anyway (race) | Backend creates a duplicate IN event; client refreshes and shows it; minor edge case worth flagging in a follow-up but not blocking |
| Loading state | Skeleton placeholder for hero + CTA + events list (3 distinct skeletons) |

---

## Testing strategy

### POS unit tests (new — v1 had none)

`ClockPage.test.tsx` (~6-8 tests):
1. Renders staff hero with name + initials when no photo
2. Renders "Inactivo" status pill when not clocked in
3. Renders "Activo" status pill when clocked in
4. CTA shows "Entrar" when not clocked in
5. CTA shows "Salir" when clocked in
6. CTA tap calls `doClockIn`/`doClockOut`
7. Empty events list shows "Sin registros hoy"
8. Events list renders entry/salida labels with timestamps

### API e2e test

`timeclock-self.e2e-spec.ts`:
- Login as barbero (Barbero role, no `timeclock.manage`)
- Mutation `clockIn(locationId)` → expect success (200, `data.clockIn === true`)
- Mutation `clockOut(locationId)` → expect success
- Verify TimeClockEvent rows created with `staffUserId === barbero.id`

### Manual smoke

iPad landscape:
1. Login as Antonio Pérez (Barbero role)
2. Navigate to Reloj tab
3. Tap "Entrar →" → status flips to "Activo", history shows entry
4. Tap "Salir →" → status flips to "Inactivo", history shows salida
5. No console errors
6. Visual: editorial v2 (sharp corners, --color tokens, no `bb-*` rendering issues)

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Removing the permission allows malicious self-clock-in | The PIN session is the gate — only the actual staff member can be `viewer.staff`. No exploit. |
| Breaks existing managers/admins | Managers had the permission AND `viewer.staff`. After fix, they still pass the `viewer.staff` gate. No regression. |
| `timeclock.manage` permission becomes orphaned | Documented as "reserved for future cross-staff clock features"; not removed from canonical list |
| ClockPage rewrite breaks the existing tab flow | Bottom-tab navigation routes `/clock` — no router change. `useClock` hook unchanged — no data layer change. Only the JSX renders differently. |

---

## Decisions log

- **Single contextual CTA** (vs always-show 2 buttons) — clearer for non-tech-savvy users; matches Caja's "Abrir/Cerrar" pattern
- **Single-column layout** (vs v1's left/right split) — simpler hierarchy, better for iPad portrait, less scrolling on landscape
- **Permission gate is `viewer.staff`** (vs `timeclock.manage`) — the real semantic: "only authenticated staff can self-clock"; manage permission stays for hypothetical future cross-staff feature
- **Keep `useClock` hook unchanged** — only presentation rewrites; logic + data layer stay identical
- **Editorial display font** for "RELOJ" title and large numbers in event timestamps; mono small-caps eyebrows for section labels

---

## Tech stack

API: NestJS 10 + Prisma 5. POS: Vite 7 + React 19 + TS 5 + Tailwind 4 + Vitest 3 + RTL. No new dependencies.
