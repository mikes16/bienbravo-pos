# POS Caja — Open / Close Design

**Date:** 2026-05-04
**Author:** Mike + Claude (brainstorm)
**Scope:** Sub-project #3 of the POS rework. Caja open/close + reconciliation. Replaces the v1 `RegisterPage` with editorial-language v2 components built on Sub-#0 foundation primitives. Hooks into Sub-#2 D Hoy view (the `Abrir caja` contextual CTA + the `Caja` bottom-tab).
**Prerequisites:** Sub-#0 (Visual Language), Sub-#1 (Lock screen + sesión), Sub-#2 (Home / Hoy) all merged to `master`.

---

## Context

The current Caja UI (`src/features/register/presentation/RegisterPage.tsx`, 414 LoC) has 4 views (list → open form → close form → summary) with v1 tokens (`bg-bb-surface`, `rounded-xl`) and simple numeric inputs for cash/card/transfer. It works but doesn't match the editorial language; the count step in particular is error-prone (one numeric input asks the operator to do mental arithmetic).

This spec replaces it with a queue-list-like experience for the Caja tab and a 3-step wizard for the close flow, using the foundation primitives that have been waiting for a consumer (`<WizardShell>`, `<StepBar>`, `<MoneyInput>`, `<MoneyDisplay>`, `<Numpad>`, `<SuccessSplash>` from Sub-#0; `<BottomTabNav>` from Sub-#2). One new foundation primitive, `<DenominationCounter>`, lands here too — it was previewed in the Sub-#0 vocabulary and gets concrete in this sub-project.

API surface is already in place. Sub-#3 is purely client-side: no schema changes, no new mutations.

## Privacy + role model (reaffirm from Sub-#2)

Caja is **communal**. Any barbero on the iPad can:
- Open caja (with fondo inicial)
- Close caja (count cash, confirm digital totals, submit reconciliation)
- See real-time totals (efectivo / tarjeta / Stripe expected)
- See the day's transactions list (for reconciliation)

What is **NOT** in POS Caja, and lives only in admin web:
- Per-employee commission breakdown (the "$X to Eli, $Y to Luis" view that the current Sucursal tab shows in v1)
- Multi-day historical aggregates
- Cross-location reports

There are no manager-only sections in POS. Same UI for everyone.

## Visual language

Consumes the Sub-#0 foundation tokens (`--color-carbon`, `--color-bone`, `--color-bravo`, `--color-success`, `--color-leather-muted`, `--color-cuero-viejo`, `--font-pos-display`, `--pos-text-*`, `--pos-touch-*`). Sharp corners, leather rules, sentence-case copy. Sub-#0 Game Icons are used for `<BottomTabNav>` (Strongbox icon for the Caja tab) — already wired in Sub-#2.

## Layout (iPad landscape primary)

The Caja experience spans 3 screens in a forward path: `Caja tab → Open flow → back to Caja tab` and `Caja tab → Close wizard → back to Hoy`. PosShell + bottom-tab nav remain visible across all of them. The Open and Close screens take over the `<Outlet />` slot but keep the bottom-tab visible for context.

### Caja tab (`/caja`) — main entry point

Two states based on `RegisterSession` for the location:

**CLOSED state** (no `OPEN` session for this location):

```
[BIENBRAVO · NORTE]                    [11:47 LUN 4 MAY] [EC]
─────────────────────────────────────────────────────────────
                              ⬛
                            CAJA
                          Sin abrir
                Para empezar a cobrar abre la caja
                con el fondo inicial. Lo hace cualquier
                       barbero del turno.

                       [ABRIR CAJA →]
─────────────────────────────────────────────────────────────
[Reloj] [Hoy] [Mis ventas] [Caja*]
```

Centered hero: ⬛ icon + `CAJA` eyebrow (mono small caps) + `Sin abrir` display title + helper text + bravo CTA "ABRIR CAJA →". No distractors. If multi-register configured (2+), a tiny selector appears between helper text and CTA — typical case is 1 register, so it auto-picks.

**OPEN state** (an `OPEN` session exists):

```
[BIENBRAVO · NORTE]                    [16:23 LUN 4 MAY] [EC]
─────────────────────────────────────────────────────────────
[● Caja abierta]              Desde 09:15 · fondo $500

[EFECTIVO ESPERADO]  [TARJETA]  [STRIPE]
[$1,840          ]  [$2,540 ]  [$1,260]
[10v · incl fondo]  [7 vtas ]  [4 vtas]

VENTAS DE HOY                            21 totales · $5,640
16:18  Carlos Méndez · Eli      EFECTIVO    $280
15:42  Pedro Soto · Luis        TARJETA     $430
15:10  Mostrador · Eli          EFECTIVO    $200
14:28  Diego Cruz · Aaron       STRIPE      $280
13:55  Roberto · Eli            EFECTIVO    $430
...
                       [CERRAR CAJA →]
─────────────────────────────────────────────────────────────
[Reloj] [Hoy] [Mis ventas] [Caja*]
```

Status banner (success-toned) with open time + fondo. 3 totals cards (efectivo accent bravo because it's the one needing physical count at close). Transactions ledger (full list, scrollable). Bottom CTA bravo "CERRAR CAJA →".

### Open flow (`/caja/abrir`)

Single screen, no steps. PosShell visible above; bottom-tab visible below.

```
[BIENBRAVO · NORTE]                    [09:13 LUN 4 MAY] [EC]
─────────────────────────────────────────────────────────────
← Cancelar

Abrir caja

¿Con cuánto efectivo abre el día? Es el fondo inicial — al
cerrar se descuenta para calcular las ventas reales.

  FONDO INICIAL
  $500_____

[$200] [$500*] [$1,000] [$2,000]

  [7] [8] [9]
  [4] [5] [6]
  [1] [2] [3]
  [0] [00] [⌫]

                  [ABRIR CAJA · $500 →]
─────────────────────────────────────────────────────────────
[Reloj] [Hoy] [Mis ventas] [Caja*]
```

`MoneyInput` foundation primitive (display + Numpad). Display is `<input inputMode="none">` so physical keyboard works on desktop while soft keyboard is suppressed on iPad. Quick presets ($200/$500/$1,000/$2,000) — the typical Norte fondo is $500 (1 tap). CTA includes the amount: `ABRIR CAJA · $500 →`. CTA disabled while amount is empty; permits $0 (rare valid case for "abrir sin fondo").

### Close wizard (`/caja/cerrar`)

3-step wizard via `<WizardShell>` + `<StepBar>`. Bottom bar of WizardShell shows current step meta + primary CTA (`SIGUIENTE` for steps 1-2, `CERRAR CAJA` for step 3).

#### Step 1 — Contar efectivo

```
[1] Contar efectivo  →  [2] Tarjeta · Stripe  →  [3] Cerrar
─────────────────────────────────────────────────────────────
Cuenta el efectivo en caja

Saca los billetes y cuenta cuántos hay de cada denominación.
El sistema suma automáticamente. Las monedas (menos de $20)
van en una sola línea.

┌─────────────────────────────────────────────────────────────┐
│ $500          [−] 2 [+]                  $1,000            │
│ $200          [−] 5 [+]                  $1,000            │
│ $100          [−] 3 [+]                  $300              │
│ $50           [−] 0 [+]                  $0                │
│ $20           [−] 25 [+]                 $500              │
│ MONEDAS       [$ 40        ]              $40              │
└─────────────────────────────────────────────────────────────┘

Total contado                                       $2,840
Esperado: $2,840
─────────────────────────────────────────────────────────────
PASO 1 DE 3 · $2,840 contados        [SIGUIENTE: TARJETA →]
```

6 rows total: 5 bill denominations ($500, $200, $100, $50, $20) using `<DenominationCounter>` (counter `−/+` widget), plus 1 lump-sum row "MONEDAS" using a coins input (everything below $20). Rows with `count > 0` get a sutil bravo bg tint to communicate "ya conté esta". Total contado prominently below; `Esperado: $X` shown small without revealing the diff (that's step 3's surprise).

Both `−/+` widgets and the coins input accept physical keyboard. Tab order goes through denominations top-to-bottom for keyboard-only users.

#### Step 2 — Tarjeta · Stripe

```
[1] Contar efectivo ✓  →  [2] Tarjeta · Stripe  →  [3] Cerrar
─────────────────────────────────────────────────────────────
Confirma los totales digitales

Tarjeta y Stripe los reconcilias contra el sistema externo.
Solo confirmar; ajustar si hubo un cobro fallido o reverso.

┌─────────────────────────────────────────────────────────────┐
│ TARJETA                                                     │
│ Esperado del sistema: $2,540 · 7 ventas                     │
│ [Sí, $2,540 ✓]            [Ajustar →]                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STRIPE                                                      │
│ Esperado del sistema: $1,260 · 4 ventas                     │
│ [Sí, $1,260 ✓]            [Ajustar →]                       │
└─────────────────────────────────────────────────────────────┘
─────────────────────────────────────────────────────────────
PASO 2 DE 3                          [REVISAR Y CERRAR →]
```

2 cards. Default state: both confirmed at expected values (the system has authoritative truth from Stripe webhooks; rare to need adjustment). Tapping "Ajustar" reveals an inline `MoneyInput` to override. The CTA is enabled once both cards are decided.

#### Step 3 — Revisar y cerrar

```
[1] Contar efectivo ✓  →  [2] Tarjeta · Stripe ✓  →  [3] Cerrar
─────────────────────────────────────────────────────────────
Revisa el resumen del cierre

┌─────────────────────────────────────────────────────────────┐
│              CONTADO     ESPERADO    DIFERENCIA             │
│  EFECTIVO    $2,840      $2,840      —                       │
│  TARJETA     $2,540      $2,540      —                       │
│  STRIPE      $1,260      $1,260      —                       │
│                                      ─────────────           │
│  TOTAL                               $0 exacto              │
└─────────────────────────────────────────────────────────────┘

[● Todo cuadra · listo para cerrar]
─────────────────────────────────────────────────────────────
PASO 3 DE 3                            [CERRAR CAJA ✓]
```

If diff != 0, the banner becomes amber (small diff ≤ $50) or bravo (large diff > $50). The amber/bravo cases require an inline checkbox confirmation before the CTA enables. The bravo case (large diff) additionally throws a modal confirmation: `"El faltante es grande ($X). ¿Confirmas el cierre?"` with `Cancelar` / `Confirmar` buttons.

After submit (mutation success) → `<SuccessSplash>` "Caja cerrada · resumen guardado" → auto-redirect to `/hoy` after 2s (or tap to dismiss earlier).

## Component spec

All tests under `*.test.tsx` next to source. Vitest + RTL.

### `<DenominationCounter>` (foundation, `src/shared/pos-ui/DenominationCounter.tsx`)

```ts
interface DenominationCounterProps {
  amountLabel: string          // '$500' or 'MONEDAS' (when used as lump sum row)
  amountSubtotal: number       // pesos (e.g., 1000 for $1,000)
  count?: number               // current count (omitted for lump-sum row)
  onCountChange?: (next: number) => void
  // For lump-sum (coins) row:
  isLumpSum?: boolean
  lumpSumCents?: number
  onLumpSumChange?: (cents: number) => void
  className?: string
}
```

Renders a row: amount label left, counter widget center (or coins input center if `isLumpSum`), subtotal right. Auto-calculated subtotal. Sutil bravo bg when count > 0. `−/+` buttons disabled at 0.

Foundation primitive — reusable for other counting UIs (e.g., inventory recount, future).

### `<CajaPage>` (`src/features/register/presentation/CajaPage.tsx`)

Orchestrator. Reads register state via `useRegister()` (existing hook). Decides which view to render:
- If no registers found → empty state error (rare; means location not configured)
- If a register has `openSession` → `<CajaOpenView>`
- Else → `<CajaClosedView>`

Refetches on `window.focus` (consistent with Sub-#2 D pattern).

### `<CajaClosedView>` (`src/features/register/presentation/CajaClosedView.tsx`)

```ts
interface CajaClosedViewProps {
  registers: Register[]        // active registers at this location
  onAbrir: (registerId: string) => void
}
```

Centered hero. If multiple registers, mini selector before CTA. CTA navigates to `/caja/abrir?reg=<id>`.

### `<CajaOpenView>` (`src/features/register/presentation/CajaOpenView.tsx`)

```ts
interface CajaOpenViewProps {
  session: RegisterSession
  todayTransactions: HomeSaleActivity[]   // shape from existing listSalesForKPI query
  onCerrar: () => void
}
```

Status banner + 3 totals cards + transactions ledger + CTA. The ledger uses the **existing `listSalesForKPI(locationId, date, source: POS)` GraphQL query** — same one the v1 HomePage used (now retired). Returns `{id, status, paymentStatus, totalCents, createdAt, appointmentId, walkInId, customer}`. The barbero column in the row is rendered from the per-sale staff-attribution that comes via the appointment/walkIn relation; no commission column.

### `<OpenCajaPage>` (`src/features/register/presentation/OpenCajaPage.tsx`)

Reads `?reg=<registerId>` from URL. Renders single-screen open form: header (cancelar) + title + helper + `<MoneyInput>` (display + Numpad) + presets + CTA. On submit, calls `register.openRegisterSession(registerId, openingCashCents)`. On success, navigates to `/caja`. On error (e.g., CONFLICT), shows inline error.

### `<CloseCajaWizard>` (`src/features/register/presentation/CloseCajaWizard.tsx`)

Wizard orchestrator using `<WizardShell>` + `<StepBar>`. Owns the wizard state (denominations counted, card/transfer confirmed, current step). Manages step progression and the final submit.

Steps live as `presentation/steps/*.tsx`:
- `CountCashStep.tsx` — denomination grid
- `ConfirmDigitalStep.tsx` — card + Stripe cards
- `ReviewCloseStep.tsx` — summary + diff + submit

### `deriveCajaViewModel` (pure, `src/features/register/presentation/deriveCajaViewModel.ts`)

Optional but useful for the totals card derivation in `<CajaOpenView>`:
- Input: `RegisterSession` + raw transactions
- Output: `{ expectedCash, expectedCard, expectedTransfer, salesCount, totalsCount, etc. }`
- Pure → easy to test without React

If the existing data already gives this shape clean, skip this — YAGNI.

## Data flow + lifecycle

### Read

- On mount of `<CajaPage>`: `register.getRegisters(locationId)` to determine state and load session if open
- On `window.focus`: refetch (totals may have changed if new sales settled)
- For the transactions ledger: existing `listSalesForKPI(locationId, date, source: POS)` query (the same one the v1 HomePage used — still in the schema, just no longer consumed by Sub-#2 D Hoy). Sub-#3 doesn't add new server endpoints.

### Write

- Open: `register.openRegisterSession(registerId, openingCashCents)`
- Close: `register.closeRegisterSession({ sessionId, countedCashCents, countedCardCents, countedTransferCents })`

Both already exist in `register.repository.ts`.

### Routing

| Route | Component | Navigation |
|---|---|---|
| `/caja` | `<CajaPage>` | bottom-tab Caja, post-open redirect, Hoy CTA when caja open |
| `/caja/abrir?reg=<id>` | `<OpenCajaPage>` | Hoy "Abrir caja" CTA, CajaClosedView CTA |
| `/caja/cerrar` | `<CloseCajaWizard>` | CajaOpenView "CERRAR CAJA" |
| `/register` | redirect → `/caja` | backward compat for any deep links |

Sub-#2 D's redirect `/caja → /register` is REVERSED here: `/register → /caja`.

### Post-action

- After open mutation success → navigate `/caja` (refresh to OpenView)
- After close mutation success → SuccessSplash 2s → navigate `/hoy`
- After cancel (open or close) → navigate `/caja`

## Edge cases

- **Diff = 0**: green banner "Todo cuadra · listo para cerrar". Submit directly.
- **Diff small** (`|diff| ≤ $50`): amber banner "Faltante de $X" with inline confirm checkbox. CTA enabled when checked.
- **Diff large** (`|diff| > $50`): bravo banner. Inline confirm checkbox + extra modal `"El faltante es grande ($X). ¿Confirmas el cierre?"` with Cancelar/Confirmar.
- **Network failure during close** mutation: error inline + retry button. Wizard state (denominations, confirmations) is preserved — the user does NOT have to recount.
- **Multi-register** (2+ active registers at the location): CajaClosedView shows a mini selector (radio list) above the CTA. For the typical 1-register case, the selector is suppressed and the single register is auto-picked. The OpenCajaPage receives the registerId via query param.
- **CONFLICT error from API** (another session already open in the same location): show error modal "Otra caja ya está abierta — ciérrala primero" with a "Ver" button that navigates to `/caja`. Should not happen in well-behaved single-iPad usage, but the API check exists.
- **Cancel mid-flow**: top-left cancelar button. Sin state submitted. Counted denominations are lost (no localStorage draft persist in v1; could add later if real-world feedback shows it's needed).
- **Wizard back navigation**: tap a previous step in StepBar → returns preserving state. Forward navigation only allows past current valid step.
- **Empty caja at close** (all denominations 0): permitted. Total contado $0. Diff = `−expectedCash`. Treated as a large negative diff — bravo banner + modal.
- **Permission scope**: the API requires `pos.register.open` and `pos.register.close` permissions. If the logged-in barbero lacks one, the mutation fails with PERMISSION error. UI: show error modal "No tienes permiso para esto. Pide a otro barbero." (rare; default barbero permissions include both).
- **Concurrent close attempt** (two iPads in the same sucursal somehow trying to close simultaneously): API serializes via session id; the second attempt gets "Session already closed" error. UI: show modal "Esta caja ya fue cerrada por otro barbero" + button "Ver resumen" that navigates back to `/caja`.

## Testing

| Layer | Tool | Critical cases |
|---|---|---|
| `<DenominationCounter>` | vitest + RTL | −/+ button click · count update via prop · subtotal calc · disabled at 0 · keyboard (focus + arrow keys) · hasCount visual · lump-sum mode |
| `deriveCajaViewModel` (if used) | vitest pure | OPEN session totals · CLOSED state · diff calc per channel |
| `<CajaClosedView>` | vitest + RTL | hero CTA fires · multi-register selector when registers.length > 1 · auto-pick when 1 |
| `<CajaOpenView>` | vitest + RTL | totals render correctly · transaction list renders · CERRAR navigates · banner shows open time + fondo |
| `<OpenCajaPage>` | vitest + RTL | numpad input · presets fill amount · CTA shows monto · submit calls openRegisterSession · success navigation · error inline rendering |
| `<CountCashStep>` | vitest + RTL | denomination interactions · total update · coins input · keyboard tab order |
| `<ConfirmDigitalStep>` | vitest + RTL | confirm path · adjust toggle · CTA enables when both decided |
| `<ReviewCloseStep>` | vitest + RTL | diff render · zero / small / large branches · checkbox gate · modal extra confirm |
| `<CloseCajaWizard>` | vitest + RTL + renderWithProviders | step progression · state preservation · success path · cancel mid-flow · back navigation |
| `<CajaPage>` | vitest + RTL + renderWithProviders | dispatches Closed or Open based on registers state · refetch on focus · empty state |

Total expected new tests: ~45-55. Existing tests stay green.

## Acceptance criteria

A barbero arriving first to the sucursal:
1. Taps the bottom-tab "Caja" → sees CLOSED hero
2. Taps "ABRIR CAJA →" → lands on `/caja/abrir`
3. Taps preset "$500" → sees `$500` in display
4. Taps "ABRIR CAJA · $500 →" → caja opens, lands on `/caja` with OPEN view
5. Or: taps Hoy bottom-tab → sees Hoy CTA "Abrir caja", which leads to the same flow

A barbero closing at end of shift:
1. Taps "CERRAR CAJA →" from CajaOpenView → wizard step 1
2. Counts denominations: 2×$500, 5×$200, 3×$100, 25×$20, $40 monedas → total $2,840
3. Taps SIGUIENTE → step 2
4. Confirms tarjeta $2,540 + Stripe $1,260 → SIGUIENTE
5. Step 3 review: all match → green banner → tap CERRAR CAJA
6. SuccessSplash → redirect to `/hoy`

A barbero closing with a $30 cash shortage:
1. Same wizard flow
2. Step 3 banner amber: "Faltante de $30 en efectivo"
3. Inline checkbox: "Sí, confirmo el cierre con esta diferencia"
4. CTA enables once checked → tap → close submits → SuccessSplash

A barbero with $200 missing:
1. Same as above but step 3 banner is bravo
2. Same inline checkbox
3. Tapping CTA opens modal: "El faltante es grande ($200). ¿Confirmas el cierre?"
4. Cancelar returns to step 3; Confirmar submits

## What gets retired (v1 RegisterPage)

- `src/features/register/presentation/RegisterPage.tsx` (414 LoC)
- The 4-view state machine (`list`, `open`, `close`, `summary`) is replaced by separate route-driven components
- The simple numeric `CounterInput` for cash/card/transfer is replaced by `<DenominationCounter>` for cash and confirm/adjust UI for card/transfer

What survives:
- `src/features/register/data/register.repository.ts` (mutations + queries already work)
- `src/features/register/domain/register.types.ts`
- `src/features/register/application/useRegister.ts` (light enhancement if needed for the new viewmodel)

## Out of scope (deferred)

- Persistent draft of close progress (if user backs out mid-wizard, state is lost) — future iteration if smoke testing reveals real friction
- Per-employee commission breakdown in POS — stays in admin web only
- Multi-day historical reporting — admin web
- Reopen flow (after a caja is closed for the day) — current behavior: closed = closed; next session is "abrir" again. No "reopen" affordance in v1
- Audit log viewer in POS — admin web has it
- Cash drawer hardware integration (auto-open the physical drawer on cobro) — Tier 2 feature
- Photo capture of fondo / counted cash — future iteration if regulatory needed

## Cross-repo

API surface is already in place. No new mutations or queries required. Sub-#3 is a pure POS-side change.

## Dependency on other sub-projects

- **Hoy CTA "Abrir caja"** (Sub-#2 D, already shipped): navigates to `/caja/abrir` — unchanged. The CTA appears whenever caja is closed.
- **Bottom-tab "Caja"** (Sub-#2 D): navigates to `/caja` — `<CajaPage>` becomes the new destination.
- **Sub-#2 redirect `/caja → /register`**: REVERSED in this sub-project. `/register → /caja` redirect added; old `/register` route alias kept for any deep links.

## Notes

- Per `feedback_pos_users` memory: bias to simplicity. The wizard structure and large CTA buttons embrace this. Counter `−/+` buttons match the operator's mental model better than freeform numeric input.
- Per `project_pos_split_attribution` memory: caja attribution to sales (which session a sale belongs to) is API-side and already correct via `registerSessionId` on each `Sale`. POS just needs the open session to exist before cobro starts.
- The `<DenominationCounter>` foundation primitive is the third sub-#0 vocabulary item to land (after `StatusBoard`, `FeatureTile`, `PlaceholderPage`, `BottomTabNav`). Sub-#0's vocabulary list is mostly populated by Sub-#3's end.
- The "running ledger" of today's transactions in `<CajaOpenView>` reuses `listSalesForKPI` GraphQL query (preserved on the API; was previously consumed by v1 HomePage). No API change for Sub-#3.
