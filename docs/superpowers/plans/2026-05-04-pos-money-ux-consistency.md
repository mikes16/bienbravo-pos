# POS Money UX Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make denomination-counting the single way operators input cash everywhere in the POS — opening the caja, taking cash payment, or closing the caja — by extracting a shared `<CashCounter>` composite, adding bill-color stripes + tap-to-edit count to `<DenominationCounter>`, and rewriting `<OpenCajaPage>` and `<CashChangeHelper>` against the new pattern.

**Architecture:** Promote `CashCounts` to a shared lib at `src/shared/cash/`. Build a new `<CashCounter>` composite (6 rows: $500/$200/$100/$50/$20/MONEDAS + optional total) consumed by all three contexts. Extend `<DenominationCounter>` with a `denomination?: number` prop (looks up a 4px bill-color stripe token) and tap-to-edit count input. Update `<PaymentSheet>` to hold `CashCounts` state and pass to `<CashChangeHelper>`. The 5 bill colors live as `--color-bill-*` tokens in `src/index.css`.

**Tech Stack:** Vite 7 + React 19 + TS 5 + Tailwind 4 + Vitest 3 + RTL. No new dependencies. Branch: `feat/pos-money-ux-consistency` (already created with the spec commit).

---

## File Structure

**Create:**
- `src/shared/cash/cashCounts.ts` — shared CashCounts model + `totalCountedCents()` + `emptyCashCounts()`
- `src/shared/cash/cashCounts.test.ts` — unit tests for the helpers
- `src/shared/cash/CashCounter.tsx` — composite (6 DenominationCounter rows + optional total)
- `src/shared/cash/CashCounter.test.tsx` — composite tests
- `src/shared/cash/index.ts` — re-exports

**Modify:**
- `src/index.css` — add 5 `--color-bill-*` tokens
- `src/shared/pos-ui/DenominationCounter.tsx` — add `denomination?: number` prop (4px stripe) + tap-to-edit count input
- `src/shared/pos-ui/DenominationCounter.test.tsx` — extend with stripe + tap-to-edit tests
- `src/features/register/lib/cashCounts.ts` — replace contents with re-export from shared lib (kept temporarily, deleted in Task 11)
- `src/features/register/presentation/CloseCajaWizard.tsx` — update import path to shared lib
- `src/features/register/presentation/steps/CountCashStep.tsx` — switch to `<CashCounter>` composite
- `src/features/register/presentation/OpenCajaPage.tsx` — replace Numpad + 5 chip presets + dual keyboard input with `<CashCounter>` + Sin fondo toggle
- `src/features/register/presentation/OpenCajaPage.test.tsx` — rewrite tests for new interaction model
- `src/features/checkout/presentation/CashChangeHelper.tsx` — replace single input with `<CashCounter>` (totalLabelOverride="Recibido") + Cambio
- `src/features/checkout/presentation/CashChangeHelper.test.tsx` — rewrite tests
- `src/features/checkout/presentation/PaymentSheet.tsx` — hold `CashCounts` state and pass down
- `src/features/checkout/presentation/PaymentSheet.test.tsx` — update CASH-shows-counter assertion

**Delete (in Task 11, after re-export shim is no longer needed):**
- `src/features/register/lib/cashCounts.ts`

---

## Task 1: Add bill-color tokens to `src/index.css`

**Files:**
- Modify: `src/index.css` (after line 30, inside the `@theme` block, near the editorial color palette)

- [ ] **Step 1: Add the 5 bill color tokens**

Add after the `--color-error: #b04a4a;` line (line 33), inside the same `@theme` block:

```css
  /* ── Bill-color stripe tokens (sub-#7 money UX consistency).
   *    4px vertical stripe associates each row with the real Mexican peso bill
   *    color. Used by <DenominationCounter denomination={500}> etc. ── */
  --color-bill-500: #2563eb; /* Frida & Diego — blue */
  --color-bill-200: #15803d; /* Allende — green */
  --color-bill-100: #dc2626; /* Nezahualcóyotl — red */
  --color-bill-50: #a855f7;  /* Juárez — purple */
  --color-bill-20: #2dd4bf;  /* Madero historical — teal */
```

- [ ] **Step 2: Verify the build picks up the tokens**

Run: `npm run build`
Expected: build succeeds (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(pos-ui): add bill-color stripe tokens for sub-#7"
```

---

## Task 2: Create shared `cashCounts.ts` module + tests

**Files:**
- Create: `src/shared/cash/cashCounts.ts`
- Create: `src/shared/cash/cashCounts.test.ts`
- Create: `src/shared/cash/index.ts`

- [ ] **Step 1: Write failing tests**

Create `src/shared/cash/cashCounts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { emptyCashCounts, totalCountedCents, type CashCounts } from './cashCounts'

describe('cashCounts', () => {
  it('emptyCashCounts returns all zero fields', () => {
    expect(emptyCashCounts()).toEqual({
      d500: 0, d200: 0, d100: 0, d50: 0, d20: 0, coinsCents: 0,
    })
  })

  it('totalCountedCents sums denominations correctly', () => {
    const c: CashCounts = { d500: 1, d200: 2, d100: 3, d50: 4, d20: 5, coinsCents: 1000 }
    // 50000 + 40000 + 30000 + 20000 + 10000 + 1000 = 151000
    expect(totalCountedCents(c)).toBe(151000)
  })

  it('totalCountedCents on empty is 0', () => {
    expect(totalCountedCents(emptyCashCounts())).toBe(0)
  })

  it('totalCountedCents handles only coins', () => {
    expect(totalCountedCents({ ...emptyCashCounts(), coinsCents: 4500 })).toBe(4500)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/cash/cashCounts.test.ts`
Expected: FAIL with "Cannot find module './cashCounts'".

- [ ] **Step 3: Write implementation**

Create `src/shared/cash/cashCounts.ts`:

```ts
export interface CashCounts {
  d500: number
  d200: number
  d100: number
  d50: number
  d20: number
  coinsCents: number
}

export function totalCountedCents(c: CashCounts): number {
  return (
    c.d500 * 50000 +
    c.d200 * 20000 +
    c.d100 * 10000 +
    c.d50 * 5000 +
    c.d20 * 2000 +
    c.coinsCents
  )
}

export function emptyCashCounts(): CashCounts {
  return { d500: 0, d200: 0, d100: 0, d50: 0, d20: 0, coinsCents: 0 }
}
```

- [ ] **Step 4: Create barrel index**

Create `src/shared/cash/index.ts`:

```ts
export { type CashCounts, totalCountedCents, emptyCashCounts } from './cashCounts'
export { CashCounter } from './CashCounter'
```

Note: the `CashCounter` re-export will resolve once Task 4 lands. If you run typecheck between Task 2 and Task 4, the line will fail — that's expected and will be fixed by Task 4. Suppress with a TODO if needed locally, but commit only after Task 4 lands. To keep this task self-contained, the actual content of `index.ts` for now should ONLY export from `./cashCounts`:

Actual contents to write:

```ts
export { type CashCounts, totalCountedCents, emptyCashCounts } from './cashCounts'
```

The `CashCounter` line gets added in Task 4.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/shared/cash/cashCounts.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/cash/cashCounts.ts src/shared/cash/cashCounts.test.ts src/shared/cash/index.ts
git commit -m "feat(shared): promote CashCounts model to shared/cash with emptyCashCounts helper"
```

---

## Task 3: Migrate existing consumers to import from shared lib

**Files:**
- Modify: `src/features/register/lib/cashCounts.ts` (turn into re-export shim)
- Modify: `src/features/register/presentation/CloseCajaWizard.tsx` (update import)
- Modify: `src/features/register/presentation/steps/CountCashStep.tsx` (update import)

- [ ] **Step 1: Replace `src/features/register/lib/cashCounts.ts` with a re-export shim**

Replace entire file contents with:

```ts
// Temporary re-export shim while sub-#7 migration completes.
// Deleted in the final task once all imports point to '@/shared/cash'.
export { type CashCounts, totalCountedCents, emptyCashCounts } from '@/shared/cash/cashCounts'
```

- [ ] **Step 2: Update `CloseCajaWizard.tsx` import**

In `src/features/register/presentation/CloseCajaWizard.tsx` line 8:

Old:
```ts
import { totalCountedCents, type CashCounts } from '../lib/cashCounts'
```

New:
```ts
import { totalCountedCents, type CashCounts } from '@/shared/cash/cashCounts'
```

- [ ] **Step 3: Update `CountCashStep.tsx` import**

In `src/features/register/presentation/steps/CountCashStep.tsx` line 3:

Old:
```ts
import { type CashCounts, totalCountedCents } from '../../lib/cashCounts'
```

New:
```ts
import { type CashCounts, totalCountedCents } from '@/shared/cash/cashCounts'
```

(Keep `export type { CashCounts }` on line 5 — `CloseCajaWizard` still imports the type from this path until Task 6 refactors.)

- [ ] **Step 4: Run the relevant test files to verify nothing broke**

Run: `npx vitest run src/features/register src/shared/cash`
Expected: all existing tests still pass (CloseCajaWizard, CountCashStep, OpenCajaPage, CajaPage, CajaOpenView, CajaClosedView tests + the new cashCounts tests). No regressions.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/register/lib/cashCounts.ts src/features/register/presentation/CloseCajaWizard.tsx src/features/register/presentation/steps/CountCashStep.tsx
git commit -m "refactor(register): point cashCounts consumers to shared/cash"
```

---

## Task 4: Extend `<DenominationCounter>` with `denomination` prop (bill-color stripe)

**Files:**
- Modify: `src/shared/pos-ui/DenominationCounter.tsx`
- Modify: `src/shared/pos-ui/DenominationCounter.test.tsx`

- [ ] **Step 1: Write failing tests for the stripe**

Add to `src/shared/pos-ui/DenominationCounter.test.tsx` at the end of the `describe('DenominationCounter', ...)` block:

```ts
  it('renders bill-color stripe when denomination is 500', () => {
    const { container } = render(
      <DenominationCounter
        amountLabel="$500"
        denomination={500}
        count={0}
        subtotalCents={0}
        onCountChange={() => {}}
      />,
    )
    const stripe = container.querySelector('[data-bill-stripe="500"]')
    expect(stripe).not.toBeNull()
  })

  it('renders bill-color stripe for each denomination', () => {
    const denominations = [500, 200, 100, 50, 20] as const
    for (const d of denominations) {
      const { container, unmount } = render(
        <DenominationCounter
          amountLabel={`$${d}`}
          denomination={d}
          count={0}
          subtotalCents={0}
          onCountChange={() => {}}
        />,
      )
      expect(container.querySelector(`[data-bill-stripe="${d}"]`)).not.toBeNull()
      unmount()
    }
  })

  it('does NOT render a stripe in lump-sum mode', () => {
    const { container } = render(
      <DenominationCounter
        amountLabel="MONEDAS"
        subtotalCents={4000}
        isLumpSum
        lumpSumCents={4000}
        onLumpSumChange={() => {}}
      />,
    )
    expect(container.querySelector('[data-bill-stripe]')).toBeNull()
  })

  it('does NOT render a stripe when denomination prop is omitted', () => {
    const { container } = render(
      <DenominationCounter
        amountLabel="$100"
        count={0}
        subtotalCents={0}
        onCountChange={() => {}}
      />,
    )
    expect(container.querySelector('[data-bill-stripe]')).toBeNull()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/pos-ui/DenominationCounter.test.tsx`
Expected: 4 new tests FAIL (no stripe element).

- [ ] **Step 3: Implement the stripe**

In `src/shared/pos-ui/DenominationCounter.tsx`, update the props interface (line 5–14):

```ts
interface DenominationCounterProps {
  amountLabel: string
  subtotalCents: number              // cents (e.g., 100000 for $1,000)
  count?: number
  onCountChange?: (next: number) => void
  isLumpSum?: boolean
  lumpSumCents?: number
  onLumpSumChange?: (cents: number) => void
  denomination?: 500 | 200 | 100 | 50 | 20
  className?: string
}
```

Update the `function DenominationCounter({...})` signature to destructure `denomination`:

```tsx
export function DenominationCounter({
  amountLabel,
  subtotalCents,
  count = 0,
  onCountChange,
  isLumpSum,
  lumpSumCents = 0,
  onLumpSumChange,
  denomination,
  className,
}: DenominationCounterProps) {
```

Inside the function body, before the `return`, build a stripe color lookup:

```tsx
const stripeColor =
  denomination && !isLumpSum
    ? {
        500: 'var(--color-bill-500)',
        200: 'var(--color-bill-200)',
        100: 'var(--color-bill-100)',
        50: 'var(--color-bill-50)',
        20: 'var(--color-bill-20)',
      }[denomination]
    : undefined
```

Wrap the existing top-level `<div>` (the one with `grid grid-cols-[110px_1fr_auto] ...`) in a relative wrapper that hosts the stripe. Replace the current outer JSX:

Old (line 36–44 area, the opening `<div>`):
```tsx
return (
  <div
    className={cn(
      'grid grid-cols-[110px_1fr_auto] items-center gap-4 border-b border-[var(--color-leather-muted)]/40 px-4 py-3 last:border-b-0',
      hasCount && 'bg-[var(--color-bravo)]/[0.04]',
      isLumpSum && !hasCount && 'bg-[var(--color-cuero-viejo)]/[0.06]',
      className,
    )}
  >
```

New:
```tsx
return (
  <div
    className={cn(
      'relative grid grid-cols-[110px_1fr_auto] items-center gap-4 border-b border-[var(--color-leather-muted)]/40 px-4 py-3 last:border-b-0',
      hasCount && 'bg-[var(--color-bravo)]/[0.04]',
      isLumpSum && !hasCount && 'bg-[var(--color-cuero-viejo)]/[0.06]',
      className,
    )}
  >
    {stripeColor && (
      <span
        data-bill-stripe={denomination}
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: stripeColor }}
      />
    )}
```

(close the `</div>` as before).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/pos-ui/DenominationCounter.test.tsx`
Expected: all stripe tests PASS, all 8 prior tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/pos-ui/DenominationCounter.tsx src/shared/pos-ui/DenominationCounter.test.tsx
git commit -m "feat(pos-ui): bill-color stripe on DenominationCounter"
```

---

## Task 5: Add tap-to-edit count input to `<DenominationCounter>`

**Files:**
- Modify: `src/shared/pos-ui/DenominationCounter.tsx`
- Modify: `src/shared/pos-ui/DenominationCounter.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `src/shared/pos-ui/DenominationCounter.test.tsx` at the end of the `describe(...)` block:

```ts
  it('tap on count number opens an inline input', async () => {
    const user = userEvent.setup()
    render(
      <DenominationCounter
        amountLabel="$100"
        count={3}
        subtotalCents={30000}
        onCountChange={() => {}}
      />,
    )
    // Initially: number is shown as a tap target, no spinbutton input
    expect(screen.queryByRole('spinbutton')).toBeNull()
    await user.click(screen.getByRole('button', { name: /editar cantidad/i }))
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('typing in the inline count input fires onCountChange on blur', async () => {
    const onCountChange = vi.fn()
    const user = userEvent.setup()
    render(
      <DenominationCounter
        amountLabel="$100"
        count={1}
        subtotalCents={10000}
        onCountChange={onCountChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: /editar cantidad/i }))
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '23')
    await user.tab() // blur
    expect(onCountChange).toHaveBeenLastCalledWith(23)
  })

  it('inline count input commits on Enter', async () => {
    const onCountChange = vi.fn()
    const user = userEvent.setup()
    render(
      <DenominationCounter
        amountLabel="$100"
        count={1}
        subtotalCents={10000}
        onCountChange={onCountChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: /editar cantidad/i }))
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '7{Enter}')
    expect(onCountChange).toHaveBeenLastCalledWith(7)
    // Input closed, number shown again
    expect(screen.queryByRole('spinbutton')).toBeNull()
  })

  it('lump-sum mode does not expose the editar-cantidad button', () => {
    render(
      <DenominationCounter
        amountLabel="MONEDAS"
        subtotalCents={4000}
        isLumpSum
        lumpSumCents={4000}
        onLumpSumChange={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /editar cantidad/i })).toBeNull()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/pos-ui/DenominationCounter.test.tsx`
Expected: 4 new tests FAIL (no edit-cantidad button).

- [ ] **Step 3: Implement tap-to-edit count**

In `src/shared/pos-ui/DenominationCounter.tsx`, add `editing` state at the top of the function body (next to `lumpSumDisplay`):

```tsx
const [editing, setEditing] = useState(false)
const [countDraft, setCountDraft] = useState<string>(String(count))
useEffect(() => {
  if (!editing) setCountDraft(String(count))
}, [count, editing])

const commitCount = () => {
  const n = Math.max(0, Number(countDraft) || 0)
  if (n !== count) onCountChange?.(n)
  setEditing(false)
}
```

Replace the existing counter `<span>` for the count (the `<span>` with `'w-10 text-center text-[20px] font-extrabold tabular-nums'`) with:

Old:
```tsx
<span
  className={cn(
    'w-10 text-center text-[20px] font-extrabold tabular-nums',
    count === 0 ? 'text-[var(--color-leather-muted)]' : 'text-[var(--color-bone)]',
  )}
>
  {count}
</span>
```

New:
```tsx
{editing ? (
  <input
    type="number"
    inputMode="numeric"
    min={0}
    autoFocus
    value={countDraft}
    onChange={(e) => setCountDraft(e.target.value)}
    onBlur={commitCount}
    onKeyDown={(e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitCount()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setCountDraft(String(count))
        setEditing(false)
      }
    }}
    aria-label="Cantidad"
    className="w-12 border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-1 text-center text-[20px] font-extrabold tabular-nums text-[var(--color-bone)] outline-none"
  />
) : (
  <button
    type="button"
    onClick={() => setEditing(true)}
    aria-label="Editar cantidad"
    className={cn(
      'w-10 cursor-pointer text-center text-[20px] font-extrabold tabular-nums',
      count === 0 ? 'text-[var(--color-leather-muted)]' : 'text-[var(--color-bone)]',
    )}
  >
    {count}
  </button>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/shared/pos-ui/DenominationCounter.test.tsx`
Expected: all 16+ tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/pos-ui/DenominationCounter.tsx src/shared/pos-ui/DenominationCounter.test.tsx
git commit -m "feat(pos-ui): tap-to-edit count on DenominationCounter for power-user large-count entry"
```

---

## Task 6: Build the `<CashCounter>` composite + tests

**Files:**
- Create: `src/shared/cash/CashCounter.tsx`
- Create: `src/shared/cash/CashCounter.test.tsx`
- Modify: `src/shared/cash/index.ts`

- [ ] **Step 1: Write failing tests**

Create `src/shared/cash/CashCounter.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CashCounter } from './CashCounter'
import { emptyCashCounts } from './cashCounts'

describe('CashCounter', () => {
  it('renders all 6 denomination rows', () => {
    render(<CashCounter counts={emptyCashCounts()} onChange={() => {}} />)
    expect(screen.getByText('$500')).toBeInTheDocument()
    expect(screen.getByText('$200')).toBeInTheDocument()
    expect(screen.getByText('$100')).toBeInTheDocument()
    expect(screen.getByText('$50')).toBeInTheDocument()
    expect(screen.getByText('$20')).toBeInTheDocument()
    expect(screen.getByText('MONEDAS')).toBeInTheDocument()
  })

  it('with showTotal renders the total at the bottom matching counts', () => {
    render(
      <CashCounter
        counts={{ d500: 1, d200: 1, d100: 0, d50: 0, d20: 0, coinsCents: 0 }}
        onChange={() => {}}
        showTotal
      />,
    )
    // 1×500 + 1×200 = $700
    expect(screen.getByText(/\$700/)).toBeInTheDocument()
  })

  it('without showTotal does not render the total row', () => {
    const { container } = render(
      <CashCounter counts={emptyCashCounts()} onChange={() => {}} />,
    )
    expect(container.querySelector('[data-cash-counter-total]')).toBeNull()
  })

  it('plus on $500 row fires onChange with d500=1', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CashCounter counts={emptyCashCounts()} onChange={onChange} />)
    // The $500 row is the first; getAllByRole gives all + buttons
    const plusButtons = screen.getAllByRole('button', { name: /aumentar/i })
    await user.click(plusButtons[0]) // first row = $500
    expect(onChange).toHaveBeenCalledWith({ ...emptyCashCounts(), d500: 1 })
  })

  it('MONEDAS lump-sum input fires onChange with coinsCents in cents', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CashCounter counts={emptyCashCounts()} onChange={onChange} />)
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '45')
    expect(onChange).toHaveBeenLastCalledWith({ ...emptyCashCounts(), coinsCents: 4500 })
  })

  it('totalLabelOverride changes the total label', () => {
    render(
      <CashCounter
        counts={emptyCashCounts()}
        onChange={() => {}}
        showTotal
        totalLabelOverride="Recibido"
      />,
    )
    expect(screen.getByText(/recibido/i)).toBeInTheDocument()
  })

  it('renders bill-color stripes for the 5 bill rows', () => {
    const { container } = render(
      <CashCounter counts={emptyCashCounts()} onChange={() => {}} />,
    )
    expect(container.querySelector('[data-bill-stripe="500"]')).not.toBeNull()
    expect(container.querySelector('[data-bill-stripe="200"]')).not.toBeNull()
    expect(container.querySelector('[data-bill-stripe="100"]')).not.toBeNull()
    expect(container.querySelector('[data-bill-stripe="50"]')).not.toBeNull()
    expect(container.querySelector('[data-bill-stripe="20"]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/shared/cash/CashCounter.test.tsx`
Expected: FAIL with "Cannot find module './CashCounter'".

- [ ] **Step 3: Implement the composite**

Create `src/shared/cash/CashCounter.tsx`:

```tsx
import { DenominationCounter } from '@/shared/pos-ui/DenominationCounter'
import { formatMoney } from '@/shared/lib/money'
import { type CashCounts, totalCountedCents } from './cashCounts'

interface CashCounterProps {
  counts: CashCounts
  onChange: (next: CashCounts) => void
  showTotal?: boolean
  totalLabelOverride?: string
  className?: string
}

export function CashCounter({
  counts,
  onChange,
  showTotal = false,
  totalLabelOverride,
  className,
}: CashCounterProps) {
  const total = totalCountedCents(counts)
  const update = (field: keyof CashCounts, value: number) => {
    onChange({ ...counts, [field]: value })
  }

  return (
    <div className={className}>
      <div className="flex flex-col border border-[var(--color-leather-muted)]/40">
        <DenominationCounter
          amountLabel="$500"
          denomination={500}
          subtotalCents={counts.d500 * 50000}
          count={counts.d500}
          onCountChange={(n) => update('d500', n)}
        />
        <DenominationCounter
          amountLabel="$200"
          denomination={200}
          subtotalCents={counts.d200 * 20000}
          count={counts.d200}
          onCountChange={(n) => update('d200', n)}
        />
        <DenominationCounter
          amountLabel="$100"
          denomination={100}
          subtotalCents={counts.d100 * 10000}
          count={counts.d100}
          onCountChange={(n) => update('d100', n)}
        />
        <DenominationCounter
          amountLabel="$50"
          denomination={50}
          subtotalCents={counts.d50 * 5000}
          count={counts.d50}
          onCountChange={(n) => update('d50', n)}
        />
        <DenominationCounter
          amountLabel="$20"
          denomination={20}
          subtotalCents={counts.d20 * 2000}
          count={counts.d20}
          onCountChange={(n) => update('d20', n)}
        />
        <DenominationCounter
          amountLabel="MONEDAS"
          subtotalCents={counts.coinsCents}
          isLumpSum
          lumpSumCents={counts.coinsCents}
          onLumpSumChange={(cents) => update('coinsCents', cents)}
        />
      </div>

      {showTotal && (
        <div
          data-cash-counter-total
          className="mt-3 flex items-baseline justify-between border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-5 py-4"
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
            {totalLabelOverride ?? 'Total contado'}
          </p>
          <p className="font-[var(--font-pos-display)] text-[32px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-bone)]">
            {formatMoney(total)}
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update `src/shared/cash/index.ts` to re-export `CashCounter`**

Replace contents with:

```ts
export { type CashCounts, totalCountedCents, emptyCashCounts } from './cashCounts'
export { CashCounter } from './CashCounter'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/shared/cash`
Expected: all CashCounter + cashCounts tests PASS.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/shared/cash/CashCounter.tsx src/shared/cash/CashCounter.test.tsx src/shared/cash/index.ts
git commit -m "feat(shared): CashCounter composite (6 rows + optional total)"
```

---

## Task 7: Refactor `<CountCashStep>` to use `<CashCounter>`

**Files:**
- Modify: `src/features/register/presentation/steps/CountCashStep.tsx`

- [ ] **Step 1: Replace the body with `<CashCounter>`**

Replace the entire contents of `src/features/register/presentation/steps/CountCashStep.tsx` with:

```tsx
import { CashCounter } from '@/shared/cash'
import { formatMoney } from '@/shared/lib/money'
import { type CashCounts, totalCountedCents } from '@/shared/cash/cashCounts'

export type { CashCounts }

interface CountCashStepProps {
  counts: CashCounts
  expectedCashCents: number
  onChange: (next: CashCounts) => void
}

export function CountCashStep({ counts, expectedCashCents, onChange }: CountCashStepProps) {
  const total = totalCountedCents(counts)

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      <p className="font-[var(--font-pos-display)] text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--color-bone)]">
        Cuenta el efectivo en caja
      </p>
      <p className="max-w-[540px] text-[13px] text-[var(--color-bone-muted)]">
        Saca los billetes y cuenta cuántos hay de cada denominación. El sistema suma automáticamente. Las monedas (menos de $20) van en una sola línea.
      </p>

      <CashCounter counts={counts} onChange={onChange} />

      <div className="flex items-baseline justify-between border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-5 py-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
            Total contado
          </p>
          <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
            Esperado: {formatMoney(expectedCashCents)}
          </p>
        </div>
        <p className="font-[var(--font-pos-display)] text-[32px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-[var(--color-bone)]">
          {formatMoney(total)}
        </p>
      </div>
    </div>
  )
}
```

(Note: we use `<CashCounter>` without `showTotal` because CountCashStep needs a custom total block that includes the "Esperado" line. The CashCounter handles only the rows.)

- [ ] **Step 2: Run all existing tests for the area**

Run: `npx vitest run src/features/register`
Expected: all CloseCajaWizard tests still pass (CountCashStep is exercised through CloseCajaWizard).

- [ ] **Step 3: Run typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/register/presentation/steps/CountCashStep.tsx
git commit -m "refactor(register): CountCashStep uses shared CashCounter composite"
```

---

## Task 8: Rewrite `<OpenCajaPage>` against `<CashCounter>` + Sin fondo toggle

**Files:**
- Modify: `src/features/register/presentation/OpenCajaPage.tsx`
- Modify: `src/features/register/presentation/OpenCajaPage.test.tsx`

- [ ] **Step 1: Rewrite the test file for the new interaction model**

Replace entire contents of `src/features/register/presentation/OpenCajaPage.test.tsx` with:

```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { OpenCajaPage } from './OpenCajaPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

describe('OpenCajaPage', () => {
  it('renders the title and FONDO INICIAL label', () => {
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(screen.getByText(/abrir caja/i)).toBeInTheDocument()
    expect(screen.getByText(/fondo inicial/i)).toBeInTheDocument()
  })

  it('renders all 6 denomination rows (NOT the legacy Numpad)', () => {
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(screen.getByText('$500')).toBeInTheDocument()
    expect(screen.getByText('$200')).toBeInTheDocument()
    expect(screen.getByText('$100')).toBeInTheDocument()
    expect(screen.getByText('$50')).toBeInTheDocument()
    expect(screen.getByText('$20')).toBeInTheDocument()
    expect(screen.getByText('MONEDAS')).toBeInTheDocument()
    // Numpad ('7') should not be on screen — there is no Numpad anymore
    expect(screen.queryByRole('button', { name: '7' })).toBeNull()
  })

  it('tapping + on $500 row enables CTA and shows the amount', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    const plusButtons = screen.getAllByRole('button', { name: /aumentar/i })
    await user.click(plusButtons[0]) // $500 row
    expect(screen.getByRole('button', { name: /abrir caja · \$500/i })).toBeInTheDocument()
  })

  it('CTA disabled when counts empty AND Sin fondo not checked', () => {
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    const cta = screen.getByRole('button', { name: /selecciona el fondo|abrir caja/i })
    expect(cta).toBeDisabled()
  })

  it('checking "Sin fondo" enables CTA with empty counts', async () => {
    const user = userEvent.setup()
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    const toggle = screen.getByRole('checkbox', { name: /sin fondo/i })
    await user.click(toggle)
    const cta = screen.getByRole('button', { name: /abrir sin fondo|abrir caja sin fondo/i })
    expect(cta).not.toBeDisabled()
  })

  it('submitting calls register.openSession with summed total in cents', async () => {
    const repos = createMockRepositories()
    const openSessionSpy = vi.spyOn(repos.register, 'openSession')
    const user = userEvent.setup()
    renderWithProviders(<OpenCajaPage />, {
      initialRoute: '/caja/abrir?reg=reg-a',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    const plusButtons = screen.getAllByRole('button', { name: /aumentar/i })
    // 2 × $500 = 100000 cents
    await user.click(plusButtons[0])
    await user.click(plusButtons[0])
    const cta = screen.getByRole('button', { name: /abrir caja · \$1,000/i })
    await user.click(cta)
    expect(openSessionSpy).toHaveBeenCalledWith('reg-a', 100000)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/register/presentation/OpenCajaPage.test.tsx`
Expected: most new tests FAIL (OpenCajaPage still has Numpad+presets).

- [ ] **Step 3: Rewrite `OpenCajaPage.tsx`**

Replace entire contents of `src/features/register/presentation/OpenCajaPage.tsx` with:

```tsx
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { MoneyDisplay } from '@/shared/pos-ui/MoneyDisplay'
import { CashCounter } from '@/shared/cash'
import { type CashCounts, emptyCashCounts, totalCountedCents } from '@/shared/cash/cashCounts'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'

export function OpenCajaPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const registerId = params.get('reg') ?? ''
  const { register } = useRepositories()
  const [counts, setCounts] = useState<CashCounts>(emptyCashCounts())
  const [explicitZero, setExplicitZero] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cents = totalCountedCents(counts)
  const canOpen = (cents > 0 || explicitZero) && !submitting

  const handleSubmit = async () => {
    if (!registerId || submitting) return
    if (cents <= 0 && !explicitZero) return
    setSubmitting(true)
    setError(null)
    try {
      await register.openSession(registerId, cents)
      navigate('/caja')
    } catch (e) {
      const msg =
        (e as { message?: string }).message ??
        'No se pudo abrir la caja. Intenta de nuevo.'
      setError(msg)
      setSubmitting(false)
    }
  }

  const ctaLabel = submitting
    ? 'Abriendo…'
    : explicitZero && cents === 0
      ? 'Abrir sin fondo →'
      : cents > 0
        ? `Abrir caja · ${formatMoney(cents)} →`
        : 'Selecciona el fondo →'

  return (
    <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[1fr_auto]">
      {/* Scroll area: header, fondo display, denomination counter, sin-fondo, error */}
      <div className="col-start-1 row-start-1 flex flex-col gap-4 overflow-y-auto px-5 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 lg:px-10 lg:py-6">
        <button
          type="button"
          onClick={() => navigate('/caja')}
          className="self-start cursor-pointer font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
        >
          ← Cancelar
        </button>

        <p className="font-[var(--font-pos-display)] text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--color-bone)] sm:text-[28px]">
          Abrir caja
        </p>
        <p className="max-w-[480px] text-[12px] text-[var(--color-bone-muted)] sm:text-[13px]">
          Cuenta los billetes que dejaste de fondo. Toca + por cada billete, o tap el número para escribir cantidad. Las monedas van en una sola línea.
        </p>

        <div className="flex flex-col gap-2 border-y border-[var(--color-leather-muted)]/40 py-3 sm:py-4">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
            Fondo inicial
          </span>
          <MoneyDisplay cents={cents} size="M" className="sm:text-[var(--pos-text-numeral-l)]" />
        </div>

        <CashCounter
          counts={counts}
          onChange={(next) => {
            setCounts(next)
            if (totalCountedCents(next) > 0) setExplicitZero(false)
          }}
        />

        <label className="flex cursor-pointer items-center gap-3 border border-dashed border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 py-3">
          <input
            type="checkbox"
            checked={explicitZero}
            onChange={(e) => {
              setExplicitZero(e.target.checked)
              if (e.target.checked) setCounts(emptyCashCounts())
            }}
            className="h-4 w-4 cursor-pointer accent-[var(--color-bravo)]"
          />
          <span className="flex flex-col leading-tight">
            <span className="text-[14px] font-bold text-[var(--color-bone)]">Abrir sin fondo</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
              caja vacía
            </span>
          </span>
        </label>

        {error && (
          <div role="alert" className="border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/[0.06] px-4 py-3">
            <p className="text-[13px] text-[var(--color-bravo)]">{error}</p>
          </div>
        )}
      </div>

      {/* CTA bar */}
      <div className={cn(
        'col-start-1 row-start-2 border-t border-[var(--color-leather-muted)]/40',
        'bg-[var(--color-carbon)] px-5 py-3 sm:px-6 lg:px-10 lg:py-4',
      )}>
        <TouchButton
          variant="primary"
          size="primary"
          disabled={!canOpen}
          onClick={handleSubmit}
          aria-label={ctaLabel}
          className="w-full rounded-none uppercase tracking-[0.06em]"
        >
          {ctaLabel}
        </TouchButton>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/register/presentation/OpenCajaPage.test.tsx`
Expected: all 6 OpenCajaPage tests PASS.

- [ ] **Step 5: Run the full register feature suite to catch any side effects**

Run: `npx vitest run src/features/register`
Expected: all tests pass.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/register/presentation/OpenCajaPage.tsx src/features/register/presentation/OpenCajaPage.test.tsx
git commit -m "feat(register): OpenCajaPage uses CashCounter (drops Numpad + chip presets)"
```

---

## Task 9: Rewrite `<CashChangeHelper>` against `<CashCounter>`

**Files:**
- Modify: `src/features/checkout/presentation/CashChangeHelper.tsx`
- Modify: `src/features/checkout/presentation/CashChangeHelper.test.tsx`

- [ ] **Step 1: Rewrite the test file for the new API**

Replace contents of `src/features/checkout/presentation/CashChangeHelper.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CashChangeHelper } from './CashChangeHelper'
import { emptyCashCounts } from '@/shared/cash/cashCounts'

describe('CashChangeHelper', () => {
  it('renders the 6 denomination rows', () => {
    render(
      <CashChangeHelper totalCents={81000} counts={emptyCashCounts()} onCountsChange={() => {}} />,
    )
    expect(screen.getByText('$500')).toBeInTheDocument()
    expect(screen.getByText('MONEDAS')).toBeInTheDocument()
  })

  it('renders 0 change when received < total', () => {
    render(
      <CashChangeHelper
        totalCents={81000}
        counts={{ ...emptyCashCounts(), d500: 1 }} // $500 received
        onCountsChange={() => {}}
      />,
    )
    expect(screen.getByText(/cambio.*\$0/i)).toBeInTheDocument()
  })

  it('renders correct change when received > total', () => {
    render(
      <CashChangeHelper
        totalCents={81000}
        counts={{ ...emptyCashCounts(), d500: 2 }} // $1,000 received → change $190
        onCountsChange={() => {}}
      />,
    )
    expect(screen.getByText(/cambio.*\$190/i)).toBeInTheDocument()
  })

  it('renders the "Recibido" total derived from counts', () => {
    render(
      <CashChangeHelper
        totalCents={81000}
        counts={{ ...emptyCashCounts(), d500: 2 }}
        onCountsChange={() => {}}
      />,
    )
    expect(screen.getByText(/recibido/i)).toBeInTheDocument()
    // Two $500 = $1,000 displayed somewhere in the total row
    expect(screen.getAllByText(/\$1,000/).length).toBeGreaterThan(0)
  })

  it('tapping + on $500 row fires onCountsChange with d500=1', async () => {
    const onCountsChange = vi.fn()
    const user = userEvent.setup()
    render(
      <CashChangeHelper totalCents={81000} counts={emptyCashCounts()} onCountsChange={onCountsChange} />,
    )
    const plusButtons = screen.getAllByRole('button', { name: /aumentar/i })
    await user.click(plusButtons[0])
    expect(onCountsChange).toHaveBeenCalledWith({ ...emptyCashCounts(), d500: 1 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/checkout/presentation/CashChangeHelper.test.tsx`
Expected: all 5 tests FAIL (component still has the old API).

- [ ] **Step 3: Rewrite the component**

Replace contents of `src/features/checkout/presentation/CashChangeHelper.tsx` with:

```tsx
import { CashCounter } from '@/shared/cash'
import { type CashCounts, totalCountedCents } from '@/shared/cash/cashCounts'
import { formatMoney } from '@/shared/lib/money'

interface CashChangeHelperProps {
  totalCents: number
  counts: CashCounts
  onCountsChange: (next: CashCounts) => void
}

export function CashChangeHelper({ totalCents, counts, onCountsChange }: CashChangeHelperProps) {
  const receivedCents = totalCountedCents(counts)
  const changeCents = Math.max(0, receivedCents - totalCents)

  return (
    <div className="flex flex-col gap-3">
      <CashCounter
        counts={counts}
        onChange={onCountsChange}
        showTotal
        totalLabelOverride="Recibido"
      />
      <div className="flex items-baseline justify-between border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-5 py-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Cambio
        </span>
        <span className="font-[var(--font-pos-display)] text-[22px] font-extrabold tabular-nums text-[var(--color-bone)]">
          {formatMoney(changeCents)}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test file in isolation — it will still fail because PaymentSheet still passes the old props**

Run: `npx vitest run src/features/checkout/presentation/CashChangeHelper.test.tsx`
Expected: 5 CashChangeHelper tests PASS. PaymentSheet tests will fail (expected — fixed in Task 10).

- [ ] **Step 5: Commit (do not run typecheck yet — Task 10 fixes the PaymentSheet integration in the same workstream)**

```bash
git add src/features/checkout/presentation/CashChangeHelper.tsx src/features/checkout/presentation/CashChangeHelper.test.tsx
git commit -m "feat(checkout): CashChangeHelper uses CashCounter; receives counts instead of pesos"
```

---

## Task 10: Update `<PaymentSheet>` to hold `CashCounts` state

**Files:**
- Modify: `src/features/checkout/presentation/PaymentSheet.tsx`
- Modify: `src/features/checkout/presentation/PaymentSheet.test.tsx`

- [ ] **Step 1: Update the failing test (selector now needs CashCounter shape)**

Replace contents of `src/features/checkout/presentation/PaymentSheet.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PaymentSheet } from './PaymentSheet'

describe('PaymentSheet', () => {
  it('renders 3 method chips when open', () => {
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={() => {}} />)
    expect(screen.getByRole('button', { name: /efectivo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tarjeta/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /transferencia/i })).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<PaymentSheet open={false} totalCents={100000} onClose={() => {}} onConfirm={() => {}} />)
    expect(screen.queryByRole('button', { name: /efectivo/i })).not.toBeInTheDocument()
  })

  it('selecting CASH shows the CashCounter denomination rows', async () => {
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={() => {}} />)
    await user.click(screen.getByRole('button', { name: /efectivo/i }))
    // CashCounter renders all 6 rows; pick MONEDAS as the unique-to-counter signal
    expect(screen.getByText('MONEDAS')).toBeInTheDocument()
    expect(screen.getByText(/recibido/i)).toBeInTheDocument()
  })

  it('selecting TARJETA shows TipInput', async () => {
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={() => {}} />)
    await user.click(screen.getByRole('button', { name: /tarjeta/i }))
    expect(screen.getByText(/propina/i)).toBeInTheDocument()
  })

  it('Confirmar fires onConfirm with method + tip (CARD)', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /tarjeta/i }))
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(onConfirm).toHaveBeenCalledWith({ method: 'CARD', tipCents: 0 })
  })

  it('Confirmar fires onConfirm with tipCents=0 for CASH (cash never includes tip)', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={50000} onClose={() => {}} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /efectivo/i }))
    // Tap +$500 once to make the form valid (received >= 0 is fine)
    const plusButtons = screen.getAllByRole('button', { name: /aumentar/i })
    await user.click(plusButtons[0])
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(onConfirm).toHaveBeenCalledWith({ method: 'CASH', tipCents: 0 })
  })
})
```

- [ ] **Step 2: Run the test file to verify failures**

Run: `npx vitest run src/features/checkout/presentation/PaymentSheet.test.tsx`
Expected: most tests FAIL because PaymentSheet still passes `receivedPesos` to CashChangeHelper.

- [ ] **Step 3: Update `PaymentSheet.tsx`**

In `src/features/checkout/presentation/PaymentSheet.tsx`:

Replace import line 5:
```tsx
import { CashChangeHelper } from './CashChangeHelper'
```
Add immediately after it:
```tsx
import { type CashCounts, emptyCashCounts } from '@/shared/cash/cashCounts'
```

Replace the state hook on line 30:
```tsx
const [receivedPesos, setReceivedPesos] = useState(0)
```
With:
```tsx
const [cashCounts, setCashCounts] = useState<CashCounts>(emptyCashCounts())
```

Replace the CashChangeHelper usage block (lines 74–80):
```tsx
{method === 'CASH' && (
  <CashChangeHelper
    totalCents={totalCents}
    receivedPesos={receivedPesos}
    onReceivedChange={setReceivedPesos}
  />
)}
```
With:
```tsx
{method === 'CASH' && (
  <CashChangeHelper
    totalCents={totalCents}
    counts={cashCounts}
    onCountsChange={setCashCounts}
  />
)}
```

(`onConfirm` already passes `tipCents: method === 'CASH' ? 0 : tipCents` — unchanged.)

- [ ] **Step 4: Run all checkout tests**

Run: `npx vitest run src/features/checkout`
Expected: all tests PASS (PaymentSheet, CashChangeHelper, CheckoutPage).

- [ ] **Step 5: Run typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/checkout/presentation/PaymentSheet.tsx src/features/checkout/presentation/PaymentSheet.test.tsx
git commit -m "refactor(checkout): PaymentSheet holds CashCounts state for the new CashChangeHelper API"
```

---

## Task 11: Delete the legacy `cashCounts.ts` shim

**Files:**
- Delete: `src/features/register/lib/cashCounts.ts`
- Verify: no other imports remain

- [ ] **Step 1: Verify no remaining imports of the legacy path**

Run: `grep -rn "features/register/lib/cashCounts\|register/lib/cashCounts\|\.\./lib/cashCounts\|\.\.\/\.\.\/lib/cashCounts" src/ 2>&1`
Expected: zero matches (Task 3 migrated all known consumers; CountCashStep was rewritten in Task 7).

If any matches surface, replace each with `@/shared/cash/cashCounts` and rerun.

- [ ] **Step 2: Delete the file**

Run: `rm src/features/register/lib/cashCounts.ts`

If `src/features/register/lib/` is now empty, also remove the directory:
```bash
rmdir src/features/register/lib 2>/dev/null || true
```

- [ ] **Step 3: Run all register + checkout tests**

Run: `npx vitest run src/features/register src/features/checkout src/shared/cash`
Expected: all tests PASS.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A src/features/register/lib
git commit -m "chore(register): remove legacy cashCounts re-export shim"
```

---

## Task 12: Final verification + push + open PR

**Files:** None (verification only)

- [ ] **Step 1: Full lint + test + build**

Run in sequence:

```bash
npm run lint
```
Expected: 0 errors.

```bash
npx vitest run
```
Expected: all tests pass.

```bash
npm run build
```
Expected: clean build, no chunk regressions.

- [ ] **Step 2: Manual smoke check (visual sanity, the operator's-eye view)**

Run: `npm run dev`

In the browser at the dev URL, verify:
- `/caja/abrir?reg=<id>` → shows the 6 denomination rows with bill-color stripes (blue/green/red/purple/teal). Tapping + increments. Tapping the count number opens an inline input. The "Abrir sin fondo" checkbox is below the rows.
- Going through a checkout → tapping "Efectivo" in the PaymentSheet → shows the same 6 rows with stripes; "Recibido" total updates as you tap; "Cambio" shows correctly.
- Closing the caja (CajaCloseWizard step 1) → still works as before; bill-color stripes also show on the existing CountCashStep (because Task 7 swapped it to CashCounter and the primitive picks up the stripe via the `denomination` prop in the composite).

If anything looks off, fix and re-run tests/build. Document any deviation in the commit.

- [ ] **Step 3: Push and open PR**

```bash
git push -u origin feat/pos-money-ux-consistency
gh pr create --title "POS sub-#7: Money UX consistency (denomination rows everywhere)" --body "$(cat <<'EOF'
## Summary
- Adds 5 `--color-bill-*` tokens for Mexican peso bill colors (4px stripe per row)
- Promotes `CashCounts` to `src/shared/cash/` with new `emptyCashCounts()` helper
- Extends `<DenominationCounter>` with `denomination` prop (color stripe) + tap-to-edit count input for power-user large counts
- Adds shared `<CashCounter>` composite (6 rows + optional total) used by 3 contexts
- Rewrites `<OpenCajaPage>` (drops Numpad + 5 chip presets + dual-keyboard input) to use `<CashCounter>` + a "Sin fondo" checkbox
- Rewrites `<CashChangeHelper>` to use `<CashCounter>` (totalLabelOverride="Recibido") + `<PaymentSheet>` updated to hold `CashCounts` state

Spec: docs/superpowers/specs/2026-05-04-pos-money-ux-consistency-design.md

## Test plan
- [ ] Lint passes
- [ ] All vitest tests pass
- [ ] Build succeeds
- [ ] Open caja with denomination rows → submit → register session opened with totalCents
- [ ] Cash payment in checkout shows denomination rows; Cambio updates correctly
- [ ] Close caja still works (CountCashStep still uses CashCounter through the same path)
- [ ] Bill-color stripes render on $500/$200/$100/$50/$20 (no stripe on MONEDAS)
- [ ] Tap-to-edit count: tap number → input → type 23 → blur fires onCountChange(23)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR created, URL printed.

---

## Final Self-Review Notes

**Spec coverage (Self-Review #1):**
- Bill color tokens (5) → Task 1 ✅
- DenominationCounter `denomination` prop + stripe → Task 4 ✅
- DenominationCounter tap-to-edit count → Task 5 ✅
- Shared `CashCounts` + `emptyCashCounts()` → Task 2 ✅
- `<CashCounter>` composite → Task 6 ✅
- `<CountCashStep>` migrated to composite → Task 7 ✅
- `<OpenCajaPage>` rewrite (drops Numpad/presets/keyboard, adds Sin fondo toggle) → Task 8 ✅
- `<CashChangeHelper>` rewrite → Task 9 ✅
- `<PaymentSheet>` integration update → Task 10 ✅
- `register.openSession(registerId, totalCents)` API unchanged → Task 8 confirms ✅
- `tipCents=0` for CASH unchanged → Task 10 test confirms ✅

**Type consistency (Self-Review #3):**
- `CashCounts` shape (`d500/d200/d100/d50/d20/coinsCents`) used identically across cashCounts.ts (Task 2), CashCounter (Task 6), OpenCajaPage (Task 8), CashChangeHelper (Task 9), PaymentSheet (Task 10).
- `emptyCashCounts()` used in Task 6 tests, Task 8, Task 9 tests, Task 10.
- `totalCountedCents()` used in Task 6 (CashCounter), Task 7 (CountCashStep), Task 8 (OpenCajaPage), Task 9 (CashChangeHelper).
- `<DenominationCounter denomination={500 | 200 | 100 | 50 | 20}>` typed in Task 4, used in Task 6's CashCounter exactly with those literal values.
- `data-bill-stripe={denomination}` attribute is the test seam for Task 4 stripe assertions and Task 6 composite stripe assertions.

**Placeholder scan (Self-Review #2):**
- No TBD / TODO / "implement later" tokens.
- Every code step shows the exact code.
- Every file path is explicit.
- Every test specifies the run command + expected pass/fail.
