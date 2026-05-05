# POS Checkout — Design Spec

**Date:** 2026-05-04
**Sub-project:** sub-#4b (POS frontend)
**Status:** Approved for planning
**Depends on:** sub-#4a (API per-line barber attribution) — must be merged on `bienbravo-api/main` before implementation begins

---

## Goal

Replace the v1 POS checkout flow (CatalogView + CartBar + CheckoutPage + CustomerLookup + PaymentView + SuccessView, ~1300 LoC, full SaaS visual language) with a single-screen catalog+cart in editorial v2 language. Adds per-line barber attribution (consuming sub-#4a), customer-optional flow via "Mostrador" fallback, and a printable/emailable receipt screen.

**Acceptance scenario:** Papá walks into the salon (no prior appointment), gets cuts for himself and his two sons by Antonio, Beto, and Carlos, and buys one shampoo at the counter. Operator opens `/checkout`, sets default barbero "Antonio", taps three "Corte" tiles, taps each cart line to swap to Beto and Carlos for two of them, taps "Shampoo" tile, taps "+ Cliente" → searches "Papá", selects, taps "COBRAR · $1,090", picks CASH, types received $1,200, sees "Cambio: $110", confirms. Success splash → receipt screen → operator taps Imprimir or Listo. Sale persists with 4 items, three of them with distinct `staffUserId`, one with null (cashier fallback). Payroll attributes commission correctly per barbero.

## Out of scope

- **Appointment completion** (`?completeAppointmentId=X`) — appointments are pre-paid (memoria de proyecto); deferred to a follow-up if/when "pay-at-end-of-service" model emerges
- **Split payments** (multiple methods on one sale) — single payment method per sale; deferred to a future enhancement
- **Thermal printer integration** — `window.print()` with a styled view is enough for v1 (AirPrint covers iPad-connected printers out of the box); deferred to a follow-up if needed
- **Twilio SMS receipts** — only email is supported in v1
- **Per-line tip distribution** — tip remains sale-level (matches API current shape)
- **Reporting / dashboards** for the new sale shape — admin web continues working with existing queries

---

## Architecture

### Single-page orchestrator at `/checkout`

A single React route renders two side-by-side panels in iPad landscape (1180×820): catalog (~60% width) on the left, cart (~40% width sticky) on the right. Mobile portrait (375×812) collapses the cart into a bottom-sheet drawer with a sticky pill (deferred polish — initial implementation is iPad-only).

### Entry contexts via query params

```ts
type CheckoutContext =
  | { kind: 'free' }
  | { kind: 'preselected-customer'; customerId: string }
  | { kind: 'walk-in'; walkInId: string }
```

Resolution at mount:

| URL pattern | Context | Pre-fill behavior |
|---|---|---|
| `/checkout` | `free` | customer = null (Mostrador on submit), barber = viewer.staff or first barber of location |
| `/checkout?customerId=X` | `preselected-customer` | customer = Customer(X), barber = same default as free |
| `/checkout?completeWalkInId=X` | `walk-in` | customer = WalkIn.customer, barber = WalkIn.assignedStaffUser, mutation will pass `completeWalkInId` so API marks WalkIn as COMPLETED |

`?completeAppointmentId=X` is **out of scope** for sub-#4b.

### Cart state — local React useReducer

```ts
type CartLineKind = 'service' | 'product' | 'combo'

type CartLine = {
  id: string                  // local-only client id
  kind: CartLineKind
  itemId: string              // serviceId | productId | catalogComboId
  name: string                // copy from catalog
  qty: number
  unitPriceCents: number
  staffUserId: string | null  // null = falls back to sale-level on submit
}

type CartState = {
  customer: Customer | null   // null = Mostrador on submit
  defaultBarberId: string     // from "Atendiendo:" header
  lines: CartLine[]
}

type CartAction =
  | { type: 'add'; item: CatalogItem }
  | { type: 'incQty'; lineId: string }
  | { type: 'decQty'; lineId: string }
  | { type: 'removeLine'; lineId: string }
  | { type: 'setLineBarber'; lineId: string; staffUserId: string }
  | { type: 'setDefaultBarber'; staffUserId: string }
  | { type: 'setCustomer'; customer: Customer | null }
  | { type: 'clear' }
```

State is volatile: clears on successful sale or on navigate-away from `/checkout`. No localStorage persistence — accidental return to `/checkout` shows empty cart (intended; matches v1 behavior).

### Customer "Mostrador" fallback

Project rule (memory): sales close without a registered customer for privacy reasons. The API requires `customerId`, so a tenant-level generic Customer record named "Mostrador" acts as the bucket for anonymous sales.

- POS UI shows `+ Cliente (opcional)` chip in the cart panel. Operator can search-and-select a real customer or skip.
- On submit, if `customer === null`, client calls `findOrCreateMostradorCustomer` (NEW API mutation, no args, see "API additions" below) and uses the returned ID as `customerId`.
- "Mostrador" is created idempotently — find by `(tenantId, fullName: 'Mostrador')`, create if not present.

### API additions (small)

Sub-#4b requires two minor API additions:

1. **`findOrCreateMostradorCustomer: Customer!`** mutation — idempotent, no args. Returns the tenant's "Mostrador" Customer, creating it on first call. Tenant resolved from viewer auth context. (~30 LoC in API.)
2. **`sendSaleReceipt(saleId: ID!, email: String!): Boolean`** mutation — sends a styled email with sale receipt. Uses existing email infrastructure if any, or adds a stub that integrates with Twilio SendGrid / Resend / similar. If the API doesn't have email infra, this gets stubbed with `MESSAGING_DRY_RUN`-style logging in dev and is wired to a real provider in a separate task. (~50-100 LoC in API depending on provider integration.)

These additions live in **sub-#4b's branch**, not sub-#4a's. They are small enough that bundling them with the POS frontend changes is appropriate; they are POS-specific and don't justify their own sub-project.

If `sendSaleReceipt` proves more involved than expected (e.g., need to add an email provider client, set up templates, etc.), it gets deferred to sub-#4c and the receipt screen's "Enviar por correo" button stays grayed out with a tooltip "próximamente". Decision deferred to plan time.

---

## Components

### Top-level

- `<CheckoutPage>` — orchestrator. Reads query params, mounts `useCheckout` hook, dispatches to the catalog+cart split or the receipt screen post-success. ~120 LoC.

### Catalog (left panel, ~60%)

- `<CatalogChips>` — horizontal row of category chips + search bar at top. Filters local. Categories come from API `categories` query, filtered by `appliesTo` to match catalog items present. ~80 LoC.
- `<CatalogGrid>` — grid of mixed tiles (services + products + combos), sorted by category sortOrder then name, filtered by selected chip and search query. ~60 LoC.
- `<CatalogTile>` — one item: image/icon + name + price + stock badge (products only) + optional "+EXTRA" indicator (services with extras). Tap → `dispatch({ type: 'add', item })`. Disabled if product stock = 0. ~80 LoC.

### Cart (right panel, ~40%, sticky)

- `<AtendiendoHeader>` — top of cart panel. Editorial banner: "ATENDIENDO" eyebrow + barbero avatar + name. Tap → `<BarberSelectorSheet>`. ~70 LoC.
- `<CustomerChip>` — below header. Empty state shows "+ Cliente (opcional)". Selected state shows name + × to clear. Tap → `<CustomerLookupSheet>`. ~50 LoC.
- `<CartList>` — scrollable list of `<CartLineRow>`. Empty state copy: "Toca un servicio o producto para empezar". ~60 LoC.
- `<CartLineRow>` — name, qty stepper (− qty +), unit price × qty, barber chip with current line's staff. Tap chip → expand `<BarberPickerInline>` inside the row. Long-press anywhere on row → confirm-and-remove. ~120 LoC.
- `<BarberPickerInline>` — horizontal-scroll row of barber avatars (location's staff). Current selection has bravo border; tap another → `dispatch({ type: 'setLineBarber' })` + collapse. ~80 LoC.
- `<CartTotals>` — subtotal + tax (if applicable) + total in large editorial display font. ~40 LoC.
- `<CobrarCTA>` — `<TouchButton variant="primary" size="primary">` full-width sticky bottom: "COBRAR · {total}". Disabled if `lines.length === 0`. Tap → `<PaymentSheet>`. ~30 LoC.

### Sheets / overlays

- `<CustomerLookupSheet>` — Radix bottom sheet (animated per project preference). Search input + results list. "Crear nuevo" inline form: nombre (required) + teléfono opcional + email opcional. ~150 LoC.
- `<BarberSelectorSheet>` — bottom sheet with grid of barber avatars from the location. Tap → `dispatch({ type: 'setDefaultBarber' })` + close. ~80 LoC.
- `<PaymentSheet>` — bottom sheet. 3 method chips (CASH / CARD / TRANSFER). Below: conditional `<CashChangeHelper>` if CASH selected, `<TipInput>` if CARD or TRANSFER. CTA "Confirmar pago". ~150 LoC.
- `<CashChangeHelper>` — `<MoneyInput>` for "Recibido" + auto-calc display "Cambio: $X". Cambio = max(0, recibido - total). ~50 LoC.
- `<TipInput>` — preset chips (10% / 15% / 20% / Otro). "Otro" expands a `<MoneyInput>`. ~60 LoC.

### Post-success

- `<SuccessSplash>` — reuse foundation primitive. 2s auto-dismiss → routes to receipt screen with sale id. ~10 LoC of integration.
- `<ReceiptScreen>` — full-page print-friendly view: sucursal header, fecha/hora, cliente, items con barbero, totales, método de pago. Includes `@media print` CSS to hide chrome and use sharp black/white. CTAs: "Imprimir" (calls `window.print()`), "Enviar por correo" (opens sheet), "Listo" (navigate to `/hoy`). ~180 LoC.
- `<EmailReceiptSheet>` — bottom sheet with email field, pre-filled if customer.email present. "Enviar" button calls `sendSaleReceipt(saleId, email)`. Loading + success + error states. ~80 LoC.

### Domain / lib

- `src/features/checkout/lib/cart.ts` — pure functions: `addLine`, `removeLine`, `updateQty`, `updateLineBarber`, `updateLineCustomer`, `computeTotals`, `cartReducer`. ~150 LoC.
- `src/features/checkout/lib/cart.types.ts` — `CartLine`, `Cart`, `CheckoutContext`, `PaymentMethod`, `PaymentInput`. ~60 LoC.

### Application hooks

- `src/features/checkout/application/useCheckout.ts` — orchestrates: parsing query params, fetching context-specific data (WalkIn or Customer), catalog data via Apollo Client, cart state via reducer, submit logic with error handling. ~200 LoC.
- `src/features/checkout/application/useMostradorCustomer.ts` — single-purpose hook that exposes `getOrCreate()` calling the find-or-create mutation. Cached per tenant. ~40 LoC.

---

## Data flow

```
[ /checkout?completeWalkInId=X ]
        │
        ▼
   useCheckout()
        │
        │ parses params → CheckoutContext
        │ fetches WalkIn(X) → pre-fills customer + defaultBarber
        │
        ▼
   <CheckoutPage>
        │
        ├──────────────┬─────────────────┐
        ▼              ▼                 ▼
   <CatalogGrid>  <Cart sticky>     [hidden post-success]
        │              │                 ▼
        tap            tap COBRAR    <SuccessSplash>
        │              │                 │
        ▼              ▼                 ▼ (after 2s)
   dispatch({add})  <PaymentSheet>  <ReceiptScreen>
        │              │                 │
        │              ▼                 ├─ Imprimir → window.print()
        │              method+tip        ├─ Email → <EmailReceiptSheet>
        │              ▼                 └─ Listo → /hoy
        │           submit()
        │              │
        │              ▼
        │           getOrCreateMostradorCustomer (if customer null)
        │              │
        │              ▼
        │           createPOSSale mutation (passes per-line staffUserId)
        │              │
        │              ▼
        │           setSuccessSale + dispatch({clear})
        ▼
   re-render with new line
```

---

## Error handling

| Scenario | UX |
|---|---|
| Stock insuficiente | Toast with API message + cart line highlighted in bravo border + qty stepper visually disabled |
| No open register session | Toast: "No hay caja abierta. Abre caja primero." + button "Ir a Caja" → `/caja` |
| Network failure on submit | Toast: "Sin conexión. Reintenta." + retry button. Cart state preserved |
| Customer create error | Inline error in the form, sheet stays open |
| `findOrCreateMostradorCustomer` fail | Toast + retry; sale not submitted |
| `sendSaleReceipt` fail | Toast: "No se envió el correo, intenta de nuevo" + retry. Sale already created → no rollback needed |
| Empty cart at submit (shouldn't happen — CTA disabled) | Defensive guard, no-op |
| Customer search returns empty | Inline empty state in sheet: "Sin resultados. ¿Crear cliente nuevo?" with one-tap form access |

---

## Testing strategy

### Unit tests (~50 cases across 12 files)

- `cart.test.ts` — pure functions (8 cases)
- `<CatalogChips>.test.tsx` (4 cases)
- `<CatalogTile>.test.tsx` (4 cases)
- `<AtendiendoHeader>.test.tsx` (3 cases)
- `<CustomerChip>.test.tsx` (4 cases)
- `<CartLineRow>.test.tsx` (5 cases)
- `<BarberPickerInline>.test.tsx` (3 cases)
- `<PaymentSheet>.test.tsx` (5 cases)
- `<CashChangeHelper>.test.tsx` (3 cases)
- `<TipInput>.test.tsx` (3 cases)
- `<ReceiptScreen>.test.tsx` (4 cases)
- `<EmailReceiptSheet>.test.tsx` (4 cases)

### Integration tests (`<CheckoutPage>.test.tsx`)

6 long tests using `renderWithProviders` + Apollo MockedProvider:
1. Free sale happy path: 2 services + COBRAR cash + change + receipt
2. Walk-in completion: pre-filled customer+barber + service + COBRAR card with tip + mutation includes `completeWalkInId`
3. Multi-barber split (papá scenario): 3 cuts → tap each line → set 3 different barbers → COBRAR cash → mutation has 3 items with distinct `staffUserId`
4. Customer skip → Mostrador fallback (mutation includes Mostrador's customerId)
5. Stock insufficient error
6. No open register session error

### E2E

Deferred. Sub-#4a's e2e (multi-barber sale + payroll attribution) already covers the API path. POS frontend e2e is a future task (Playwright config to be added in a separate sub-project).

### Manual smoke (Task 11 of plan)

iPad landscape (1180×820), 10-step walkthrough covering all branches: free sale, walk-in, customer search, multi-barber, cash change, card+tip, receipt print, receipt email, error scenarios.

### Verification gate per task

- `npm run lint` — 0 errors in changed files
- `npx tsc --noEmit -p tsconfig.app.json` — clean
- `npm test` — all green
- `npm run build` — clean

---

## Migration / cutover

- New components live alongside v1 during implementation (Tasks 1-N build new files; v1 remains in `src/features/checkout/`)
- Final task deletes v1 files and rewires the `/checkout` route
- Result: a single coherent v2 implementation, v1 fully removed before merge

**Files to delete in final task:**

- `src/features/checkout/presentation/CatalogView.tsx`
- `src/features/checkout/presentation/CartBar.tsx`
- `src/features/checkout/presentation/CheckoutPage.tsx`
- `src/features/checkout/presentation/CustomerLookup.tsx`
- `src/features/checkout/presentation/PaymentView.tsx`
- `src/features/checkout/presentation/SuccessView.tsx`
- `src/features/checkout/domain/cart.service.ts` (replaced by `lib/cart.ts`)
- `src/features/checkout/application/useCheckout.ts` v1 (replaced by new useCheckout)
- `src/features/checkout/application/useCart.ts` (replaced by reducer)
- `src/features/checkout/application/useCatalog.ts` (logic absorbed into useCheckout)
- `src/features/checkout/application/useActiveRegisterSession.ts` (logic absorbed into useCheckout)

`src/features/checkout/data/checkout.repository.ts` is **kept** — its GraphQL queries (`PosServices`, `PosProducts`, etc.) are reused as-is.

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Sub-#4a not merged when sub-#4b implementation starts | Plan Task 1 explicitly checks `git log origin/main` for the SaleItem.staffUserId schema change before proceeding. If missing, blocks with clear message. |
| `findOrCreateMostradorCustomer` mutation slips to sub-#4c | Plan includes the API mutation as Task 1 of sub-#4b (small, ~30 LoC). If it grows beyond ~80 LoC for any reason, defers to sub-#4c. |
| `sendSaleReceipt` requires email infra not yet in API | If true, defer the email feature to sub-#4c; receipt screen ships with print-only and "Enviar por correo" disabled. Decision made at plan time after API audit. |
| Per-line barber picker UX feels slow | Inline expand (no popup) is the lightest possible interaction. If still slow on real iPads, optimize avatar grid render (memoization) before redesigning. |
| Cart state lost on accidental nav | Acceptable for v1 (matches behavior of v1). If complaints surface post-merge, add sessionStorage persistence in a follow-up. |
| Catalog grid feels sparse with many categories | Initial chip selection defaults to first category with most items; search bar is always available as escape hatch. |

---

## Decisions log

- **Single-screen + sticky right rail cart** with "Atendiendo:" header on top of cart — chosen for non-tech-savvy operators (full state visible, no wizard friction)
- **Category chips + single mixed grid** — services 95% of catalog, tabs would force unnecessary tabbing; chips with `appliesTo` filtering balance discoverability and density
- **Customer optional with Mostrador fallback** — privacy preference (memoria), no PII captured for anonymous sales
- **Per-line barber picker inline expand with horizontal avatars** — aligned with user's videogame-character-select preference; avoids popup that hides cart
- **Payment sheet with cash-change helper, tip only on card/transfer** — cash tip in MX barbershop goes directly to barbero, not recorded
- **Receipt screen with print + email**, no thermal printer integration — `window.print()` + AirPrint covers iPad-connected printers; thermal driver is overkill for v1
- **No appointment completion** — pre-paid model means it's not operational; deferred
- **Sub-#4a is a hard prerequisite** — sub-#4b implementation cannot start until PR #12 is merged

---

## Tech stack

Vite 7 + React 19 + TS 5 + Tailwind 4 + Apollo Client 4 + Vitest 3 + @testing-library/react 16. No new dependencies. Branch: `feat/pos-checkout`.
