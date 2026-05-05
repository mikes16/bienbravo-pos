# POS Money UX Consistency — Design Spec

**Date:** 2026-05-04
**Sub-project:** sub-#7
**Status:** Approved for planning

---

## Goal

Make the operator's experience for manipulating cash uniform across the POS. The denomination-counter pattern from `<CajaCloseWizard>`'s `<CountCashStep>` becomes the single way to input cash anywhere — opening the caja with a fondo, receiving payment in checkout, or confirming a count at close.

**Operator's mental model**: "I see the bills in front of me. I count them. The system adds them up." This holds whether the operator is starting the day, taking a payment, or closing the caja.

**Acceptance scenario:** Antonio opens the caja with $1,200 in cash (1× $500 + 2× $200 + 3× $100 + $0 in coins). He taps the row for $500, sees the count go up by one. Same for $200 and $100. The total at the bottom reads "$1,200" and the CTA enables. Later in the day, papá pays cash for three cuts ($840 total) with two $500 bills. Antonio taps the $500 row twice on the cash-received counter, sees "Recibido $1,000 · Cambio $160", confirms.

## Out of scope

- Email receipts (`sendSaleReceipt` mutation) — sub-#4c
- Reporting per-barber on admin dashboards — sub-#4c
- Refund / void flow UI — separate sub-project
- Reprint past receipts — separate sub-project
- Walk-in CREATE form — separate sub-project
- Stripe Terminal integration — separate sub-project
- Tip cash registration (cash tip goes directly to barbero, not recorded — confirmed in sub-#3 memory)
- Number-input "Otro" amount on TipInput (card/transfer tip) — that input is digital, not cash; out of scope

---

## Architecture

### One pattern, three contexts

The pattern is the existing `<DenominationCounter>` from sub-#3, lightly extended. Three pages consume it:

1. **`<CountCashStep>`** (existing — Caja close, step 1): denomination rows with counts. Already uses the primitive. Gets the new color stripe automatically.

2. **`<OpenCajaPage>`** (rewrite — Caja open): replace `<Numpad>` + 5 chip presets + dual physical-keyboard input. New layout: same 5 denomination rows + `MONEDAS` lump-sum row. Total = sum, displayed prominently. CTA stays "Abrir caja · {total} →".

3. **`<CashChangeHelper>`** (rewrite — Checkout cash): replace single `<MoneyInput>` for "Recibido" with the 5 denomination rows + `MONEDAS` lump-sum row. "Cambio" derives from `totalReceived - totalDue`.

### Primitive enhancement

`<DenominationCounter>` (currently in `src/shared/pos-ui/DenominationCounter.tsx`) gets two changes:

**1. Bill-color stripe (4px vertical bar on left edge)** — visual association with the real Mexican peso bill color. Tokens added to `src/index.css`:
- `--color-bill-500: #2563eb` (Frida & Diego — blue)
- `--color-bill-200: #15803d` (Allende — green)
- `--color-bill-100: #dc2626` (Nezahualcóyotl — red)
- `--color-bill-50: #a855f7` (Juárez — purple)
- `--color-bill-20: #2dd4bf` (Madero historical — teal)

The lump-sum row (MONEDAS) gets no stripe — it's not a bill.

**2. Tap-to-edit count for power users** — the count number in counter mode is rendered inside a tappable area. Tap it: the number cell becomes a small inline input. Type any integer, blur or Enter commits. Users still see +/- for normal use; the tap-to-edit handles "I have 23× $100 bills" without 23 button presses.

The primitive's existing API stays compatible: `count` + `onCountChange` for counter mode, `lumpSumCents` + `onLumpSumChange` for lump-sum mode. Internal: a small `useState` toggles "editing" mode within the row.

### Shared cash-counts model

The existing `CashCounts` interface in `src/features/register/lib/cashCounts.ts` (currently scoped to `<CountCashStep>`) is **promoted to a shared cash-input contract**. New location: `src/shared/cash/cashCounts.ts` (or similar shared lib), with helpers:

```ts
interface CashCounts {
  d500: number; d200: number; d100: number; d50: number; d20: number; coinsCents: number;
}
function totalCountedCents(c: CashCounts): number { /* existing */ }
function emptyCashCounts(): CashCounts { return { d500: 0, d200: 0, d100: 0, d50: 0, d20: 0, coinsCents: 0 } }
```

Pages share this shape. `<CountCashStep>`, `<OpenCajaPage>`, `<CashChangeHelper>` all hold a `CashCounts` state and render the same 6 rows.

### `<CashCounter>` composite component (new)

To avoid duplicating the 6-row layout in three places, extract a composite:

```tsx
<CashCounter
  counts={cashCounts}
  onChange={setCashCounts}
  showTotal={true}        // optional total display below rows
  totalLabelOverride?     // e.g., "Recibido" for CashChangeHelper
/>
```

The composite renders the 6 `<DenominationCounter>` rows + optional total row. Used by all three contexts.

### "Sin fondo" toggle on OpenCajaPage

The current `<OpenCajaPage>` has an explicit "$0 sin fondo" preset chip (per sub-#3 design — protects against accidental open). When we drop the chip presets, we keep the same intent via a checkbox below the cash counter:

```
[ ] Abrir sin fondo (caja vacía)
```

When checked: `explicitZero=true`, CTA enables even if total is 0. When unchecked: CTA disabled if total is 0. Preserves the same safety net.

---

## Components

### Modify

- **`src/shared/pos-ui/DenominationCounter.tsx`** — add `denomination` prop (number, used to look up the bill-color stripe), add tap-to-edit count input
- **`src/shared/pos-ui/DenominationCounter.test.tsx`** — extend tests for stripe rendering + tap-to-edit
- **`src/index.css`** — add 5 `--color-bill-*` tokens
- **`src/features/register/presentation/OpenCajaPage.tsx`** — replace Numpad + presets with `<CashCounter>` + "Sin fondo" toggle
- **`src/features/register/presentation/OpenCajaPage.test.tsx`** — update tests for new interaction model
- **`src/features/checkout/presentation/CashChangeHelper.tsx`** — replace single input with `<CashCounter>` (showTotal=true, label="Recibido")
- **`src/features/checkout/presentation/CashChangeHelper.test.tsx`** — update tests
- **`src/features/register/lib/cashCounts.ts`** — promote to shared (move to `src/shared/cash/cashCounts.ts`), add `emptyCashCounts()` helper, update imports
- **`src/features/register/presentation/steps/CountCashStep.tsx`** — switch to `<CashCounter>` composite (now shared) — minor refactor

### Create

- **`src/shared/cash/CashCounter.tsx`** — composite (6 rows + optional total)
- **`src/shared/cash/CashCounter.test.tsx`**

---

## Data flow

### OpenCajaPage submit

```
User clicks +/- on $500 row → setCashCounts({ ...prev, d500: prev.d500 + 1 })
                            ↓
                   totalCountedCents(counts) === 50000 → CTA enabled
                            ↓
        User taps "Abrir caja · $500 →" → register.openSession(registerId, totalCents)
```

`<OpenCajaPage>` no longer has `cents` state — it has `counts` + `explicitZero`. The submit derives the cents at click time.

### CashChangeHelper submit

`<CashChangeHelper>` is a controlled component used inside `<PaymentSheet>`. Today it exposes `receivedPesos: number`. New API:

```tsx
<CashChangeHelper
  totalCents={totalCents}
  counts={cashCounts}
  onCountsChange={setCashCounts}
/>
```

`receivedCents = totalCountedCents(counts)`, `changeCents = max(0, receivedCents - totalCents)`. The parent (`<PaymentSheet>`) holds the `cashCounts` state and passes it down.

### Persistence

No API changes. `openRegisterSession(registerId, openingCashCents)` and `createPOSSale({...paymentMethod: 'CASH', tipCents})` already accept totals as cents. The frontend just changes how it derives those cents.

---

## Error handling

Same as before. Cash counter validates client-side (no negative counts, lump-sum >= 0). API rejection (e.g., session already open) flows through existing error banners.

The "Sin fondo" toggle is the explicit-zero gate: if total is 0 and `explicitZero` is false, CTA stays disabled with a soft hint ("Cuenta el fondo o marca «sin fondo» abajo").

---

## Testing strategy

### `<DenominationCounter>` (extend existing tests)

- Existing 8 tests carry over.
- Add: renders bill-color stripe when `denomination` prop is set ($500/$200/$100/$50/$20).
- Add: lump-sum mode (MONEDAS) does NOT render a stripe.
- Add: tap on count number opens inline input; type "23" + blur fires `onCountChange(23)`.

### `<CashCounter>` (new, ~6 tests)

- Renders all 6 rows.
- Total at bottom matches `totalCountedCents(counts)`.
- Tap +/- on a row fires `onChange` with updated counts.
- MONEDAS lump-sum input fires `onChange` with `coinsCents` set.
- `totalLabelOverride` swaps the total label.
- Empty counts → total reads "$0".

### `<OpenCajaPage>` (rewrite tests)

- Renders denomination rows + "Sin fondo" toggle (NOT Numpad).
- Tap +/- on $500 row → CTA shows "Abrir caja · $500".
- "Sin fondo" toggle enabled with empty counts → CTA enabled, label "Abrir sin fondo →".
- CTA disabled when counts empty AND "Sin fondo" off.
- Submit calls `register.openSession(registerId, totalCents)`.

### `<CashChangeHelper>` (rewrite tests)

- Renders counter rows + "Recibido" total + "Cambio" derived.
- Counts updating fires `onCountsChange`.
- Cambio = max(0, recibido - totalCents).

### `<PaymentSheet>` (light integration update)

- Test "selecting CASH shows CashCounter" replaces "selecting CASH shows CashChangeHelper input".
- Confirmar with cash counts produces correct `tipCents=0` (cash always zero tip per memory).

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Operator finds 6-row counter slower than typing for large fondos | Tap-to-edit count input handles this; type "1500" in $1 lump-sum field if needed (MONEDAS lump-sum accepts any peso amount) |
| Bill colors clash with editorial dark palette | 4px stripe is subtle; tokens are saturated bill colors but only on the stripe, not on the row bg or text |
| `<CashChangeHelper>` API change breaks `<PaymentSheet>` | Update `<PaymentSheet>` to hold `cashCounts` state and pass down; update PaymentSheet tests accordingly |
| `<OpenCajaPage>` losing dual-keyboard input is a regression for desktop power users | Power users were never the target — non-tech-savvy operator is. Tap-to-edit count input still allows direct number entry on focus |
| Shared `cashCounts.ts` move breaks existing imports in `<CountCashStep>` | Move atomically with the shared lib's first commit; update imports in same commit |

---

## Decisions log

- **Replace, not toggle** — one consistent UX everywhere; no operator decision-making about input mode.
- **5 bill denominations + MONEDAS lump-sum** — same set as existing `<CountCashStep>`. No `$1000` row (rare); operators can use $500 row + count for that.
- **4px color stripe** — subtle, asociativo, doesn't break editorial.
- **Tap-to-edit count** — escape hatch for large counts without abandoning the +/- model.
- **Drop $200/$500/$1000/$2000 chip presets** — billete row clicks ARE the presets now.
- **"Sin fondo" toggle replaces "$0 sin fondo" chip** — same explicit-zero safety, less visual clutter.
- **Drop dual-physical-keyboard input on OpenCajaPage** — operator's not at a desk; iPad-first.
- **MONEDAS row identical across contexts** — operator never counts individual coins; always lump-sum peso total.
- **`<CashCounter>` composite** — DRY (Don't Repeat Yourself) across 3 contexts.

---

## Tech stack

Vite 7 + React 19 + TS 5 + Tailwind 4 + Vitest 3 + RTL. No new dependencies. Branch: `feat/pos-money-ux-consistency`.
