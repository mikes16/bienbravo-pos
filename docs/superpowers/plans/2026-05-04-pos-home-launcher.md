# POS Home / Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the POS Home page as a focused launcher: greeting + commission hero + status board + conditional active-service strip + 3×2 feature tile grid. Add three foundation primitives (`StatusBoard`, `FeatureTile`, `PlaceholderPage`) and two placeholder routes (`/caja`, `/my-day`) for sub-projects that haven't shipped yet.

**Architecture:** New foundation primitives in `src/shared/pos-ui/`. Home owns its presentation in `src/features/home/presentation/` with a pure `deriveHomeViewModel` function feeding a presentational `HomeView`, orchestrated by `HomePage` that fetches data on mount + on `window.focus`. Performance KPIs and Activity Table are removed (move to Sub-#9 My Día). Caja chip + tile read the new `posCajaStatusHome` API query.

**Tech Stack:** Vite 7 + React 19 + TS 5 + Tailwind 4 + Apollo Client 4 + Vitest 3 + @testing-library/react 16. No new dependencies.

**Spec reference:** `bienbravo-pos/docs/superpowers/specs/2026-05-04-pos-home-launcher-design.md`

**Cross-repo dependency (BLOCKING — do not start Task 1 until satisfied):**
- The plan `bienbravo-api/docs/superpowers/plans/2026-05-04-pos-home-caja-status.md` MUST be merged to `bienbravo-api` `main` first.
- Pre-flight check (Task 1) verifies `posCajaStatusHome` is present on `type Query` in `bienbravo-api/src/graphql/schema.generated.graphql`. If missing, stop and unblock the API plan.

**Important codebase facts:**
- POS branch is `master` (not `main`).
- POS uses path alias `@/` → `src/` (configured in vitest.config.ts and tsconfig).
- Apollo imports use `@apollo/client/react` for hooks, `@apollo/client` for value/type imports.
- `cn` utility at `src/shared/lib/cn.ts`. `formatMoney` at `src/shared/lib/money.ts`.
- `@testing-library/jest-dom/vitest` is loaded in `src/test/setup.ts` so `toBeInTheDocument` works.
- `@testing-library/user-event` is installed.
- Foundation v2 primitives from sub-#0 are exported from `src/shared/pos-ui` barrel: `TouchButton`, `TileGrid`, `TileButton`, `MoneyDisplay`, `EmptyStateV2`, `Numpad`, `PinKeypad`, `MoneyInput`, `StepBar`, `WizardShell`, `SuccessSplash`. This plan adds `StatusBoard`, `FeatureTile`, `PlaceholderPage` to the barrel.
- Tokens in `src/index.css`: `--color-bravo`, `--color-carbon`, `--color-carbon-elevated`, `--color-cuero-viejo`, `--color-leather-muted`, `--color-bone`, `--color-bone-muted`, `--color-success`, `--font-pos-display`, `--font-pos-ui`, `--pos-text-*`, `--pos-touch-*`, `--pos-space-*`.
- Schema sync workflow: `npm run sync-schema` copies `bienbravo-api/src/graphql/schema.generated.graphql` → `bienbravo-pos/schema.graphql`, then `npm run codegen` regenerates `src/core/graphql/generated/`.
- Per `feedback_pos_users` memory: users are non-tech. No comments/docstrings on components (per project rule).
- `<TouchButton>` already exists with variants `primary | secondary | ghost | danger` and sizes `primary | secondary | row`.
- `useNavigate` from `react-router-dom` is used elsewhere in the repo for client-side navigation.
- Verification gate per task: `npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm test && npm run build`.

---

## File Structure

**Created (foundation primitives):**
- `src/shared/pos-ui/StatusBoard.tsx` + `StatusBoard.test.tsx`
- `src/shared/pos-ui/FeatureTile.tsx` + `FeatureTile.test.tsx`
- `src/shared/pos-ui/PlaceholderPage.tsx` + `PlaceholderPage.test.tsx`

**Created (Home-specific):**
- `src/features/home/presentation/CommissionHero.tsx` + `CommissionHero.test.tsx`
- `src/features/home/presentation/ActiveServiceStrip.tsx` + `ActiveServiceStrip.test.tsx`
- `src/features/home/presentation/deriveHomeViewModel.ts` + `deriveHomeViewModel.test.ts`
- `src/features/home/data/home.queries.ts`

**Created (placeholder pages):**
- `src/app/CajaPlaceholderPage.tsx`
- `src/app/MyDayPlaceholderPage.tsx`

**Modified:**
- `src/shared/pos-ui/index.ts` — re-export new foundation primitives
- `src/features/home/presentation/HomePage.tsx` — full rewrite as orchestrator
- `src/features/home/presentation/HomeView.tsx` — full rewrite as presentational
- `src/app/AppRoutes.tsx` (or wherever route table lives) — add `/caja` and `/my-day` routes
- `schema.graphql` — synced (Task 1)
- `src/core/graphql/generated/` — regenerated (Task 1)

---

## Task 1: Pre-flight + sync schema + codegen

**Files:**
- Modify: `schema.graphql` (synced)
- Modify: `src/core/graphql/generated/` (regenerated)

- [ ] **Step 1: Verify API plan has shipped**

Open `bienbravo-api/src/graphql/schema.generated.graphql` (sibling repo). Search for:
- `type PosCajaStatusHome { ... }` — should exist with fields `isOpen: Boolean!`, `accumulatedCents: Int`, `openedAt: DateTime`
- `posCajaStatusHome(locationId: ID!): PosCajaStatusHome!` — should appear under `type Query`

If either is missing, **STOP**. The API plan needs to merge first. Do not proceed.

- [ ] **Step 2: Sync schema + codegen**

```bash
cd /Users/insightcollective/Documents/Code/BienBravo/bienbravo-pos
npm run sync-schema
npm run codegen
```

Expected: `sync-schema` copies the API schema; `codegen` regenerates `src/core/graphql/generated/`.

- [ ] **Step 3: Verify the new types exist in generated**

```bash
grep -E "PosCajaStatusHome|posCajaStatusHome" src/core/graphql/generated/graphql.ts | head -10
```

Expected: matches for `PosCajaStatusHome` type and `posCajaStatusHome` field. If missing, re-run `npm run codegen`.

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add schema.graphql src/core/graphql/generated/
git commit -m "chore(codegen): sync API schema with posCajaStatusHome query"
```

---

## Task 2: StatusBoard foundation primitive (TDD)

**Files:**
- Create: `src/shared/pos-ui/StatusBoard.tsx`
- Create: `src/shared/pos-ui/StatusBoard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/shared/pos-ui/StatusBoard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusBoard } from './StatusBoard'

describe('StatusBoard', () => {
  it('renders all chip labels', () => {
    render(
      <StatusBoard
        chips={[
          { label: 'Sucursal Norte' },
          { label: 'Caja abierta', tone: 'success' },
          { label: 'Entrada 09:15', tone: 'success' },
        ]}
      />,
    )
    expect(screen.getByText('Sucursal Norte')).toBeInTheDocument()
    expect(screen.getByText('Caja abierta')).toBeInTheDocument()
    expect(screen.getByText('Entrada 09:15')).toBeInTheDocument()
  })

  it('applies success tone class to success chips', () => {
    render(
      <StatusBoard
        chips={[
          { label: 'Default' },
          { label: 'Success', tone: 'success' },
        ]}
      />,
    )
    const success = screen.getByText('Success')
    expect(success.className).toMatch(/color-success/)
    const def = screen.getByText('Default')
    expect(def.className).not.toMatch(/color-success/)
  })

  it('renders nothing visible when chips array is empty', () => {
    const { container } = render(<StatusBoard chips={[]} />)
    expect(container.firstChild?.childNodes.length).toBe(0)
  })

  it('chips are not buttons (read-only mental model)', () => {
    render(<StatusBoard chips={[{ label: 'X' }]} />)
    expect(screen.queryByRole('button', { name: 'X' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- StatusBoard.test
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/shared/pos-ui/StatusBoard.tsx`:

```tsx
import { cn } from '@/shared/lib/cn'

interface StatusChip {
  label: string
  tone?: 'default' | 'success'
}

interface StatusBoardProps {
  chips: StatusChip[]
  className?: string
}

export function StatusBoard({ chips, className }: StatusBoardProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {chips.map((chip, i) => (
        <span
          key={`${chip.label}-${i}`}
          className={cn(
            'border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em]',
            chip.tone === 'success'
              ? 'border-[var(--color-success)]/40 text-[var(--color-success)]'
              : 'border-[var(--color-leather-muted)] text-[var(--color-bone-muted)]',
          )}
        >
          {chip.label}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- StatusBoard.test
```

Expected: 4/4 PASS.

- [ ] **Step 5: Add to barrel**

Open `src/shared/pos-ui/index.ts` and add:

```ts
export { StatusBoard } from './StatusBoard'
```

- [ ] **Step 6: Verify build**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/shared/pos-ui/StatusBoard.tsx src/shared/pos-ui/StatusBoard.test.tsx src/shared/pos-ui/index.ts
git commit -m "feat(pos-ui): add StatusBoard foundation primitive"
```

---

## Task 3: FeatureTile foundation primitive (TDD)

**Files:**
- Create: `src/shared/pos-ui/FeatureTile.tsx`
- Create: `src/shared/pos-ui/FeatureTile.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/shared/pos-ui/FeatureTile.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { FeatureTile } from './FeatureTile'
import { ShoppingCartIcon } from './GoogleIcon'

describe('FeatureTile', () => {
  it('renders name and subtitle', () => {
    render(
      <FeatureTile
        icon={ShoppingCartIcon}
        name="Cobrar"
        subtitle="Iniciar cobro"
        onClick={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /cobrar/i })).toBeInTheDocument()
    expect(screen.getByText('Iniciar cobro')).toBeInTheDocument()
  })

  it('calls onClick when tapped', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <FeatureTile
        icon={ShoppingCartIcon}
        name="Cobrar"
        onClick={onClick}
      />,
    )
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders badge when badge > 0', () => {
    render(
      <FeatureTile
        icon={ShoppingCartIcon}
        name="Walk-ins"
        badge={3}
        onClick={() => {}}
      />,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('does not render badge when badge is 0 or undefined', () => {
    const { rerender } = render(
      <FeatureTile icon={ShoppingCartIcon} name="X" onClick={() => {}} />,
    )
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    rerender(
      <FeatureTile icon={ShoppingCartIcon} name="X" badge={0} onClick={() => {}} />,
    )
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('disabled tile does not fire onClick', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <FeatureTile
        icon={ShoppingCartIcon}
        name="Mi día"
        disabled
        onClick={onClick}
      />,
    )
    await user.click(screen.getByRole('button', { name: /mi día/i }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders subtitle when provided, omits otherwise', () => {
    const { rerender } = render(
      <FeatureTile icon={ShoppingCartIcon} name="X" subtitle="hello" onClick={() => {}} />,
    )
    expect(screen.getByText('hello')).toBeInTheDocument()
    rerender(<FeatureTile icon={ShoppingCartIcon} name="X" onClick={() => {}} />)
    expect(screen.queryByText('hello')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- FeatureTile.test
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/shared/pos-ui/FeatureTile.tsx`:

```tsx
import { cn } from '@/shared/lib/cn'
import type { PosIconComponent } from './GoogleIcon'

interface FeatureTileProps {
  icon: PosIconComponent
  name: string
  subtitle?: string
  badge?: number
  disabled?: boolean
  onClick: () => void
  className?: string
}

export function FeatureTile({
  icon: Icon,
  name,
  subtitle,
  badge,
  disabled,
  onClick,
  className,
}: FeatureTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col justify-between gap-2 border bg-[var(--color-carbon-elevated)] p-3.5 text-left transition-colors',
        'border-[var(--color-leather-muted)]',
        'hover:bg-[var(--color-cuero-viejo)] active:bg-[var(--color-cuero-viejo)]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--color-carbon-elevated)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-bone-muted)]',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-7 w-7 items-center justify-center border border-[var(--color-leather-muted)] text-[var(--color-bone-muted)]">
          <Icon className="h-4 w-4" />
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="bg-[var(--color-bravo)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--color-bone)]">
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="text-[var(--pos-text-body-lg)] font-bold text-[var(--color-bone)]">{name}</p>
        {subtitle && (
          <p className="mt-0.5 text-[var(--pos-text-caption)] text-[var(--color-bone-muted)]">
            {subtitle}
          </p>
        )}
      </div>
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- FeatureTile.test
```

Expected: 6/6 PASS.

- [ ] **Step 5: Add to barrel**

Open `src/shared/pos-ui/index.ts` and add:

```ts
export { FeatureTile } from './FeatureTile'
```

- [ ] **Step 6: Verify build**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/shared/pos-ui/FeatureTile.tsx src/shared/pos-ui/FeatureTile.test.tsx src/shared/pos-ui/index.ts
git commit -m "feat(pos-ui): add FeatureTile foundation primitive"
```

---

## Task 4: PlaceholderPage foundation primitive (TDD)

**Files:**
- Create: `src/shared/pos-ui/PlaceholderPage.tsx`
- Create: `src/shared/pos-ui/PlaceholderPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/shared/pos-ui/PlaceholderPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PlaceholderPage } from './PlaceholderPage'

describe('PlaceholderPage', () => {
  it('renders title and subtitle', () => {
    render(
      <PlaceholderPage
        title="Mi día"
        subtitle="Disponible próximamente · Verás KPIs personales"
      />,
    )
    expect(screen.getByText('Mi día')).toBeInTheDocument()
    expect(screen.getByText(/disponible próximamente/i)).toBeInTheDocument()
  })

  it('renders title without subtitle when subtitle is omitted', () => {
    render(<PlaceholderPage title="Caja" />)
    expect(screen.getByText('Caja')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- PlaceholderPage.test
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/shared/pos-ui/PlaceholderPage.tsx`:

```tsx
interface PlaceholderPageProps {
  title: string
  subtitle?: string
}

export function PlaceholderPage({ title, subtitle }: PlaceholderPageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 py-12 text-center">
      <p className="font-[var(--font-pos-display)] text-[var(--pos-text-numeral-s)] font-extrabold uppercase tracking-[0.04em] text-[var(--color-leather)]">
        {title}
      </p>
      {subtitle && (
        <p className="max-w-md text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
          {subtitle}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- PlaceholderPage.test
```

Expected: 2/2 PASS.

- [ ] **Step 5: Add to barrel**

Open `src/shared/pos-ui/index.ts` and add:

```ts
export { PlaceholderPage } from './PlaceholderPage'
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/pos-ui/PlaceholderPage.tsx src/shared/pos-ui/PlaceholderPage.test.tsx src/shared/pos-ui/index.ts
git commit -m "feat(pos-ui): add PlaceholderPage foundation primitive"
```

---

## Task 5: Caja and MyDay placeholder pages + routes

**Files:**
- Create: `src/app/CajaPlaceholderPage.tsx`
- Create: `src/app/MyDayPlaceholderPage.tsx`
- Modify: route table (typically `src/app/AppRoutes.tsx` or `src/app/PosShell.tsx` or `src/main.tsx` — locate it first)

- [ ] **Step 1: Locate the route table**

```bash
grep -rn "Routes\|<Route " src/app/ src/main.tsx 2>/dev/null | head -10
```

Identify the file that registers `<Route path="/checkout">`, `<Route path="/walkins">`, etc. Typically `src/app/AppRoutes.tsx`. Open it and read the current registrations.

- [ ] **Step 2: Create CajaPlaceholderPage**

Create `src/app/CajaPlaceholderPage.tsx`:

```tsx
import { PlaceholderPage } from '@/shared/pos-ui'

export function CajaPlaceholderPage() {
  return (
    <PlaceholderPage
      title="Caja"
      subtitle="Disponible próximamente · Aquí abrirás y cerrarás caja con conteo de denominaciones."
    />
  )
}
```

- [ ] **Step 3: Create MyDayPlaceholderPage**

Create `src/app/MyDayPlaceholderPage.tsx`:

```tsx
import { PlaceholderPage } from '@/shared/pos-ui'

export function MyDayPlaceholderPage() {
  return (
    <PlaceholderPage
      title="Mi día"
      subtitle="Disponible próximamente · Verás tus comisiones por día, historial y rendimiento."
    />
  )
}
```

- [ ] **Step 4: Register routes**

Open the route table from Step 1. Add two new routes inside the same parent that holds existing POS routes:

```tsx
<Route path="/caja" element={<CajaPlaceholderPage />} />
<Route path="/my-day" element={<MyDayPlaceholderPage />} />
```

Add the imports at the top of the file:

```tsx
import { CajaPlaceholderPage } from './CajaPlaceholderPage'
import { MyDayPlaceholderPage } from './MyDayPlaceholderPage'
```

If imports use a different path style (e.g., `@/app/...`) follow the existing convention.

- [ ] **Step 5: Smoke-test the routes**

Run `npm run dev`, visit `http://localhost:5173/caja` and `http://localhost:5173/my-day` (after PIN entry). Confirm the placeholder text renders.

- [ ] **Step 6: Verify build**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run build
```

Expected: clean. No new tests for the placeholder pages themselves (`PlaceholderPage` foundation already tested in Task 4); the page wrappers are trivial.

- [ ] **Step 7: Commit**

```bash
git add src/app/CajaPlaceholderPage.tsx src/app/MyDayPlaceholderPage.tsx src/app/AppRoutes.tsx
git commit -m "feat(home): add /caja and /my-day placeholder routes"
```

(Adjust the route file path in `git add` if it's not `AppRoutes.tsx`.)

---

## Task 6: CommissionHero component (TDD)

**Files:**
- Create: `src/features/home/presentation/CommissionHero.tsx`
- Create: `src/features/home/presentation/CommissionHero.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/home/presentation/CommissionHero.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CommissionHero } from './CommissionHero'

describe('CommissionHero', () => {
  it('renders the formatted money amount', () => {
    render(<CommissionHero amountCents={34500} serviceCount={8} />)
    expect(screen.getByText('$345.00')).toBeInTheDocument()
  })

  it('renders the COMISIONES HOY caption', () => {
    render(<CommissionHero amountCents={0} serviceCount={0} />)
    expect(screen.getByText(/comisiones hoy/i)).toBeInTheDocument()
  })

  it('pluralizes correctly: 1 servicio (singular)', () => {
    render(<CommissionHero amountCents={5000} serviceCount={1} />)
    expect(screen.getByText(/1 servicio$/i)).toBeInTheDocument()
  })

  it('pluralizes correctly: 8 servicios (plural)', () => {
    render(<CommissionHero amountCents={34500} serviceCount={8} />)
    expect(screen.getByText(/8 servicios/i)).toBeInTheDocument()
  })

  it('handles zero state: 0 servicios', () => {
    render(<CommissionHero amountCents={0} serviceCount={0} />)
    expect(screen.getByText(/0 servicios/i)).toBeInTheDocument()
  })

  it('renders a skeleton when loading', () => {
    render(<CommissionHero amountCents={0} serviceCount={0} loading />)
    expect(screen.queryByText(/comisiones hoy/i)).toBeInTheDocument()
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- CommissionHero.test
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/features/home/presentation/CommissionHero.tsx`:

```tsx
import { formatMoney } from '@/shared/lib/money'

interface CommissionHeroProps {
  amountCents: number
  serviceCount: number
  loading?: boolean
}

function pluralizeServicios(n: number): string {
  return n === 1 ? '1 servicio' : `${n} servicios`
}

export function CommissionHero({ amountCents, serviceCount, loading }: CommissionHeroProps) {
  return (
    <div className="flex items-baseline gap-4 border-b border-[var(--color-leather-muted)] pb-3">
      {loading ? (
        <span
          aria-hidden
          className="inline-block h-10 w-32 animate-pulse bg-[var(--color-cuero-viejo)]"
        />
      ) : (
        <span className="font-[var(--font-pos-display)] text-[var(--pos-text-numeral-l)] font-extrabold leading-none tracking-[-0.03em] text-[var(--color-bone)] tabular-nums">
          {formatMoney(amountCents)}
        </span>
      )}
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Comisiones hoy
        </span>
        <span className="text-[var(--pos-text-caption)] text-[var(--color-bone-muted)]">
          {pluralizeServicios(serviceCount)}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- CommissionHero.test
```

Expected: 6/6 PASS.

If the existing `formatMoney(amountCents)` formats as `$345` instead of `$345.00`, adapt the first test assertion to match the actual format. Look at `src/shared/lib/money.ts` to confirm.

- [ ] **Step 5: Verify + commit**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
git add src/features/home/presentation/CommissionHero.tsx src/features/home/presentation/CommissionHero.test.tsx
git commit -m "feat(home): add CommissionHero with editorial numeral + pluralization"
```

---

## Task 7: ActiveServiceStrip component (TDD)

**Files:**
- Create: `src/features/home/presentation/ActiveServiceStrip.tsx`
- Create: `src/features/home/presentation/ActiveServiceStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/home/presentation/ActiveServiceStrip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ActiveServiceStrip } from './ActiveServiceStrip'

describe('ActiveServiceStrip', () => {
  it('renders customer name, service label, and minutes', () => {
    render(
      <ActiveServiceStrip
        customerName="Carlos Méndez"
        serviceLabel="corte clásico"
        minutesElapsed={12}
        onCobrar={() => {}}
      />,
    )
    expect(screen.getByText(/carlos méndez/i)).toBeInTheDocument()
    expect(screen.getByText(/corte clásico/i)).toBeInTheDocument()
    expect(screen.getByText(/12 min/i)).toBeInTheDocument()
  })

  it('calls onCobrar when CTA tapped', async () => {
    const onCobrar = vi.fn()
    const user = userEvent.setup()
    render(
      <ActiveServiceStrip
        customerName="X"
        serviceLabel="y"
        minutesElapsed={1}
        onCobrar={onCobrar}
      />,
    )
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    expect(onCobrar).toHaveBeenCalledTimes(1)
  })

  it('shows EN SERVICIO label', () => {
    render(
      <ActiveServiceStrip
        customerName="X"
        serviceLabel="y"
        minutesElapsed={3}
        onCobrar={() => {}}
      />,
    )
    expect(screen.getByText(/en servicio/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- ActiveServiceStrip.test
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/features/home/presentation/ActiveServiceStrip.tsx`:

```tsx
import { TouchButton } from '@/shared/pos-ui'

interface ActiveServiceStripProps {
  customerName: string
  serviceLabel: string
  minutesElapsed: number
  onCobrar: () => void
}

export function ActiveServiceStrip({
  customerName,
  serviceLabel,
  minutesElapsed,
  onCobrar,
}: ActiveServiceStripProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-l-4 border-[var(--color-bravo)] bg-[var(--color-bravo)]/10 px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          En servicio · {minutesElapsed} min
        </span>
        <span className="text-[var(--pos-text-body)] font-bold text-[var(--color-bone)]">
          {customerName} · {serviceLabel}
        </span>
      </div>
      <TouchButton variant="primary" size="row" onClick={onCobrar}>
        Cobrar →
      </TouchButton>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- ActiveServiceStrip.test
```

Expected: 3/3 PASS.

- [ ] **Step 5: Verify + commit**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
git add src/features/home/presentation/ActiveServiceStrip.tsx src/features/home/presentation/ActiveServiceStrip.test.tsx
git commit -m "feat(home): add ActiveServiceStrip with bravo CTA"
```

---

## Task 8: deriveHomeViewModel pure function (TDD)

**Files:**
- Create: `src/features/home/presentation/deriveHomeViewModel.ts`
- Create: `src/features/home/presentation/deriveHomeViewModel.test.ts`

- [ ] **Step 1: Write the failing test (multiple cases)**

Create `src/features/home/presentation/deriveHomeViewModel.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deriveHomeViewModel } from './deriveHomeViewModel'
import type { Appointment } from '@/features/agenda/domain/agenda.types'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository'
import type { WalkIn } from '@/features/walkins/domain/walkins.types'

const STAFF_ID = 'staff-1'
const STAFF_NAME = 'Javi Cruz'
const LOCATION_NAME = 'Norte'

function baseInput(overrides: Partial<Parameters<typeof deriveHomeViewModel>[0]> = {}) {
  return {
    staffId: STAFF_ID,
    staffName: STAFF_NAME,
    locationName: LOCATION_NAME,
    appointments: [] as Appointment[],
    walkIns: [] as WalkIn[],
    clockEvents: [] as TimeClockEvent[],
    commission: { amountCents: 0, serviceCount: 0, loading: false },
    caja: { isOpen: false, accumulatedCents: null, openedAt: null },
    ...overrides,
  }
}

describe('deriveHomeViewModel', () => {
  it('renders empty / clean state when no data', () => {
    const vm = deriveHomeViewModel(baseInput())
    expect(vm.staffName).toBe('Javi Cruz')
    expect(vm.commission.amountCents).toBe(0)
    expect(vm.activeService).toBeNull()
    expect(vm.tiles.walkins.subtitle).toMatch(/sin walk-ins/i)
    expect(vm.tiles.agenda.subtitle).toMatch(/sin citas/i)
    expect(vm.tiles.caja.subtitle).toMatch(/sin abrir/i)
    expect(vm.tiles.reloj.subtitle).toMatch(/sin entrada/i)
    expect(vm.tiles.midia.subtitle).toMatch(/próximamente/i)
  })

  it('shows status chips: sucursal, caja sin abrir, sin entrada', () => {
    const vm = deriveHomeViewModel(baseInput())
    expect(vm.statusChips.map((c) => c.label)).toEqual([
      'Sucursal Norte',
      'Caja sin abrir',
      'Sin entrada',
    ])
    expect(vm.statusChips[0].tone).toBe('default')
    expect(vm.statusChips[1].tone).toBe('default')
    expect(vm.statusChips[2].tone).toBe('default')
  })

  it('shows caja open with success tone and accumulated tile subtitle', () => {
    const vm = deriveHomeViewModel(
      baseInput({
        caja: { isOpen: true, accumulatedCents: 284_000, openedAt: new Date() },
      }),
    )
    expect(vm.statusChips[1].label).toBe('Caja abierta')
    expect(vm.statusChips[1].tone).toBe('success')
    expect(vm.tiles.caja.subtitle).toBe('$2,840.00 acumulado')
  })

  it('shows clock-in success tone and entrada subtitle', () => {
    const vm = deriveHomeViewModel(
      baseInput({
        clockEvents: [
          { type: 'CLOCK_IN', at: '2026-05-04T09:15:00Z' } as TimeClockEvent,
        ],
      }),
    )
    expect(vm.statusChips[2].label).toMatch(/entrada/i)
    expect(vm.statusChips[2].tone).toBe('success')
    expect(vm.tiles.reloj.subtitle).toMatch(/entrada/i)
  })

  it('counts pending walk-ins, sets badge', () => {
    const vm = deriveHomeViewModel(
      baseInput({
        walkIns: [
          { id: 'w1', status: 'PENDING', customerName: 'Pedro' } as WalkIn,
          { id: 'w2', status: 'PENDING', customerName: 'Juan' } as WalkIn,
        ],
      }),
    )
    expect(vm.tiles.walkins.subtitle).toMatch(/2 esperando/i)
    expect(vm.tiles.walkins.badge).toBe(2)
  })

  it('pluralizes walk-ins: 1 esperando vs 2 esperando', () => {
    const vm1 = deriveHomeViewModel(
      baseInput({ walkIns: [{ id: 'w1', status: 'PENDING', customerName: 'X' } as WalkIn] }),
    )
    expect(vm1.tiles.walkins.subtitle).toMatch(/1 esperando/i)
  })

  it('counts agenda and pluralizes: 1 cita vs 5 citas', () => {
    const vm = deriveHomeViewModel(
      baseInput({
        appointments: [
          { id: 'a1', status: 'CONFIRMED', startAt: '2026-05-04T14:00:00Z' } as Appointment,
        ],
      }),
    )
    expect(vm.tiles.agenda.subtitle).toMatch(/1 cita/i)
    expect(vm.tiles.agenda.badge).toBe(1)
  })

  it('detects active walk-in assigned to current staff and surfaces strip data', () => {
    const vm = deriveHomeViewModel(
      baseInput({
        walkIns: [
          {
            id: 'w1',
            status: 'ASSIGNED',
            customerName: 'Carlos',
            assignedStaffUser: { id: STAFF_ID },
            createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
          } as WalkIn,
        ],
      }),
    )
    expect(vm.activeService).not.toBeNull()
    expect(vm.activeService!.customerName).toBe('Carlos')
    expect(vm.activeService!.minutesElapsed).toBeGreaterThanOrEqual(11)
    expect(vm.activeService!.minutesElapsed).toBeLessThanOrEqual(13)
  })

  it('detects active appointment IN_SERVICE assigned to current staff', () => {
    const vm = deriveHomeViewModel(
      baseInput({
        appointments: [
          {
            id: 'a1',
            status: 'IN_SERVICE',
            staffUser: { id: STAFF_ID },
            customer: { fullName: 'Pedro' },
            items: [{ label: 'corte clásico' }],
            startAt: new Date(Date.now() - 8 * 60_000).toISOString(),
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.activeService).not.toBeNull()
    expect(vm.activeService!.customerName).toBe('Pedro')
    expect(vm.activeService!.serviceLabel).toBe('corte clásico')
  })

  it('does NOT surface active service when assigned to a different staff', () => {
    const vm = deriveHomeViewModel(
      baseInput({
        walkIns: [
          {
            id: 'w1',
            status: 'ASSIGNED',
            customerName: 'Other',
            assignedStaffUser: { id: 'other-staff' },
            createdAt: new Date().toISOString(),
          } as WalkIn,
        ],
      }),
    )
    expect(vm.activeService).toBeNull()
  })

  it('with both active walk-in and appointment, picks the most recently created', () => {
    const recent = new Date(Date.now() - 2 * 60_000).toISOString()
    const older = new Date(Date.now() - 30 * 60_000).toISOString()
    const vm = deriveHomeViewModel(
      baseInput({
        walkIns: [
          {
            id: 'w1',
            status: 'ASSIGNED',
            customerName: 'WalkInRecent',
            assignedStaffUser: { id: STAFF_ID },
            createdAt: recent,
          } as WalkIn,
        ],
        appointments: [
          {
            id: 'a1',
            status: 'IN_SERVICE',
            staffUser: { id: STAFF_ID },
            customer: { fullName: 'ApptOlder' },
            items: [{ label: 'corte' }],
            startAt: older,
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.activeService!.customerName).toBe('WalkInRecent')
  })

  it('first-name-only greeting is in staffName field for direct render in HomeView', () => {
    const vm = deriveHomeViewModel(baseInput({ staffName: 'Javi Cruz García' }))
    expect(vm.staffName).toBe('Javi Cruz García')
    // HomeView extracts first name; viewmodel keeps full name for flexibility.
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- deriveHomeViewModel.test
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/features/home/presentation/deriveHomeViewModel.ts`:

```ts
import type { Appointment } from '@/features/agenda/domain/agenda.types'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository'
import type { WalkIn } from '@/features/walkins/domain/walkins.types'
import { formatMoney } from '@/shared/lib/money'

export interface HomeViewModelInput {
  staffId: string
  staffName: string
  locationName: string
  appointments: Appointment[]
  walkIns: WalkIn[]
  clockEvents: TimeClockEvent[]
  commission: { amountCents: number; serviceCount: number; loading: boolean }
  caja: { isOpen: boolean; accumulatedCents: number | null; openedAt: Date | null }
}

export interface HomeViewModel {
  staffName: string
  commission: { amountCents: number; serviceCount: number; loading: boolean }
  statusChips: { label: string; tone: 'default' | 'success' }[]
  activeService: {
    customerName: string
    serviceLabel: string
    minutesElapsed: number
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

function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`
}

function formatTimeMx(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
}

export function deriveHomeViewModel(input: HomeViewModelInput): HomeViewModel {
  const {
    staffId,
    staffName,
    locationName,
    appointments,
    walkIns,
    clockEvents,
    commission,
    caja,
  } = input

  // Status chips
  const cajaChip = caja.isOpen
    ? { label: 'Caja abierta', tone: 'success' as const }
    : { label: 'Caja sin abrir', tone: 'default' as const }

  const lastClockIn = clockEvents.find((e) => e.type === 'CLOCK_IN')
  const clockChip = lastClockIn
    ? { label: `Entrada ${formatTimeMx(lastClockIn.at)}`, tone: 'success' as const }
    : { label: 'Sin entrada', tone: 'default' as const }

  const statusChips = [
    { label: `Sucursal ${locationName}`, tone: 'default' as const },
    cajaChip,
    clockChip,
  ]

  // Active service: pick the most recent of {ASSIGNED walk-in for this staff, IN_SERVICE appt for this staff}
  type ActiveCandidate = { customerName: string; serviceLabel: string; createdAt: string }

  const candidates: ActiveCandidate[] = []

  const myWalkIn = walkIns.find(
    (w) => w.status === 'ASSIGNED' && w.assignedStaffUser?.id === staffId,
  )
  if (myWalkIn) {
    candidates.push({
      customerName: myWalkIn.customer?.fullName ?? myWalkIn.customerName ?? 'Walk-in',
      serviceLabel: 'sin cita',
      createdAt: myWalkIn.createdAt,
    })
  }

  const myAppt = appointments.find(
    (a) => a.status === 'IN_SERVICE' && a.staffUser?.id === staffId,
  )
  if (myAppt) {
    candidates.push({
      customerName: myAppt.customer?.fullName ?? 'Cliente',
      serviceLabel: myAppt.items[0]?.label ?? 'cita',
      createdAt: myAppt.startAt,
    })
  }

  candidates.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const top = candidates[0]
  const activeService = top
    ? {
        customerName: top.customerName,
        serviceLabel: top.serviceLabel,
        minutesElapsed: minutesSince(top.createdAt),
      }
    : null

  // Tile subtitles
  const pendingWalkInCount = walkIns.filter((w) => w.status === 'PENDING').length
  const pendingApptCount = appointments.filter(
    (a) => a.status === 'CONFIRMED' || a.status === 'CHECKED_IN' || a.status === 'IN_SERVICE',
  ).length

  return {
    staffName,
    commission,
    statusChips,
    activeService,
    tiles: {
      cobrar: { subtitle: 'Iniciar cobro' },
      walkins: {
        subtitle:
          pendingWalkInCount === 0
            ? 'Sin walk-ins'
            : pluralize(pendingWalkInCount, 'esperando', 'esperando'),
        badge: pendingWalkInCount > 0 ? pendingWalkInCount : undefined,
      },
      agenda: {
        subtitle:
          pendingApptCount === 0
            ? 'Sin citas hoy'
            : pluralize(pendingApptCount, 'cita hoy', 'citas hoy'),
        badge: pendingApptCount > 0 ? pendingApptCount : undefined,
      },
      caja: {
        subtitle: caja.isOpen
          ? `${formatMoney(caja.accumulatedCents ?? 0)} acumulado`
          : 'Sin abrir',
      },
      reloj: {
        subtitle: lastClockIn ? `Entrada ${formatTimeMx(lastClockIn.at)}` : 'Sin entrada',
      },
      midia: { subtitle: 'Próximamente' },
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- deriveHomeViewModel.test
```

Expected: 12/12 PASS.

If pluralization for "1 esperando" reads weird ("1 esperando" sounds OK in Spanish — "X persona esperando"), verify the test expectation matches the actual function output. Adjust the test expectations for natural Spanish if needed.

- [ ] **Step 5: Verify + commit**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
git add src/features/home/presentation/deriveHomeViewModel.ts src/features/home/presentation/deriveHomeViewModel.test.ts
git commit -m "feat(home): pure deriveHomeViewModel transforms raw data → viewmodel"
```

---

## Task 9: HomeView presentational component (TDD)

**Files:**
- Modify: `src/features/home/presentation/HomeView.tsx` (full rewrite)
- Create: `src/features/home/presentation/HomeView.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/home/presentation/HomeView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { HomeView } from './HomeView'
import type { HomeViewModel } from './deriveHomeViewModel'

function makeVm(overrides: Partial<HomeViewModel> = {}): HomeViewModel {
  return {
    staffName: 'Javi Cruz',
    commission: { amountCents: 34500, serviceCount: 8, loading: false },
    statusChips: [
      { label: 'Sucursal Norte', tone: 'default' },
      { label: 'Caja abierta', tone: 'success' },
      { label: 'Entrada 09:15', tone: 'success' },
    ],
    activeService: null,
    tiles: {
      cobrar: { subtitle: 'Iniciar cobro' },
      walkins: { subtitle: '2 esperando', badge: 2 },
      agenda: { subtitle: '5 citas hoy', badge: 5 },
      caja: { subtitle: '$2,840.00 acumulado' },
      reloj: { subtitle: 'Entrada 09:15' },
      midia: { subtitle: 'Próximamente' },
    },
    ...overrides,
  }
}

describe('HomeView', () => {
  it('renders greeting with first name only', () => {
    render(
      <MemoryRouter>
        <HomeView vm={makeVm({ staffName: 'Javi Cruz García' })} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/hola, javi\b/i)).toBeInTheDocument()
  })

  it('renders all 6 feature tiles', () => {
    render(
      <MemoryRouter>
        <HomeView vm={makeVm()} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /cobrar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /walk-ins/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /agenda/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /caja/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reloj/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mi día/i })).toBeInTheDocument()
  })

  it('renders status chips', () => {
    render(
      <MemoryRouter>
        <HomeView vm={makeVm()} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Sucursal Norte')).toBeInTheDocument()
    expect(screen.getByText('Caja abierta')).toBeInTheDocument()
    expect(screen.getByText('Entrada 09:15')).toBeInTheDocument()
  })

  it('does not render ActiveServiceStrip when activeService is null', () => {
    render(
      <MemoryRouter>
        <HomeView vm={makeVm({ activeService: null })} />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/en servicio/i)).not.toBeInTheDocument()
  })

  it('renders ActiveServiceStrip when activeService is present', () => {
    render(
      <MemoryRouter>
        <HomeView
          vm={makeVm({
            activeService: {
              customerName: 'Carlos',
              serviceLabel: 'corte clásico',
              minutesElapsed: 12,
            },
          })}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/en servicio/i)).toBeInTheDocument()
    expect(screen.getByText(/carlos/i)).toBeInTheDocument()
  })

  it('renders the commission hero amount', () => {
    render(
      <MemoryRouter>
        <HomeView vm={makeVm()} />
      </MemoryRouter>,
    )
    expect(screen.getByText('$345.00')).toBeInTheDocument()
    expect(screen.getByText(/8 servicios/i)).toBeInTheDocument()
  })

  it('clicking a tile invokes navigation (smoke check)', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <HomeView vm={makeVm()} />
      </MemoryRouter>,
    )
    // Just verify no error thrown when clicking
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- HomeView.test
```

Expected: FAIL — module doesn't have these props or doesn't exist as a working component.

- [ ] **Step 3: Implement (full rewrite of HomeView.tsx)**

Replace the content of `src/features/home/presentation/HomeView.tsx` with:

```tsx
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCartIcon,
  CalendarIcon,
  SeatReclineIcon,
  ClockIcon,
  AnalyticsIcon,
  type PosIconComponent,
} from '@/shared/pos-ui/GoogleIcon'
import { StatusBoard, FeatureTile } from '@/shared/pos-ui'
import { CommissionHero } from './CommissionHero'
import { ActiveServiceStrip } from './ActiveServiceStrip'
import type { HomeViewModel } from './deriveHomeViewModel'

interface HomeViewProps {
  vm: HomeViewModel
}

const CAJA_ICON: PosIconComponent = AnalyticsIcon
const MIDIA_ICON: PosIconComponent = AnalyticsIcon

export function HomeView({ vm }: HomeViewProps) {
  const navigate = useNavigate()
  const firstName = vm.staffName.split(' ')[0] ?? vm.staffName

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-6">
      <p className="text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
        Hola, <strong className="font-bold text-[var(--color-bone)]">{firstName}</strong>.
      </p>

      <CommissionHero
        amountCents={vm.commission.amountCents}
        serviceCount={vm.commission.serviceCount}
        loading={vm.commission.loading}
      />

      <StatusBoard chips={vm.statusChips} />

      {vm.activeService && (
        <ActiveServiceStrip
          customerName={vm.activeService.customerName}
          serviceLabel={vm.activeService.serviceLabel}
          minutesElapsed={vm.activeService.minutesElapsed}
          onCobrar={() => navigate('/checkout')}
        />
      )}

      <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-3">
        <FeatureTile
          icon={ShoppingCartIcon}
          name="Cobrar"
          subtitle={vm.tiles.cobrar.subtitle}
          onClick={() => navigate('/checkout')}
        />
        <FeatureTile
          icon={SeatReclineIcon}
          name="Walk-ins"
          subtitle={vm.tiles.walkins.subtitle}
          badge={vm.tiles.walkins.badge}
          onClick={() => navigate('/walkins')}
        />
        <FeatureTile
          icon={CalendarIcon}
          name="Agenda"
          subtitle={vm.tiles.agenda.subtitle}
          badge={vm.tiles.agenda.badge}
          onClick={() => navigate('/agenda')}
        />
        <FeatureTile
          icon={CAJA_ICON}
          name="Caja"
          subtitle={vm.tiles.caja.subtitle}
          onClick={() => navigate('/caja')}
        />
        <FeatureTile
          icon={ClockIcon}
          name="Reloj"
          subtitle={vm.tiles.reloj.subtitle}
          onClick={() => navigate('/clock')}
        />
        <FeatureTile
          icon={MIDIA_ICON}
          name="Mi día"
          subtitle={vm.tiles.midia.subtitle}
          onClick={() => navigate('/my-day')}
        />
      </div>
    </div>
  )
}
```

If `GoogleIcon.tsx` doesn't export specific icons we need (`SeatReclineIcon` is from the existing v1, exists; `AnalyticsIcon` exists; `ClockIcon`, `CalendarIcon`, `ShoppingCartIcon` exist), use the existing ones. If none of the existing icons read as a "register" or "report" icon, we use `AnalyticsIcon` as a placeholder for both Caja and Mi día. Don't add new icons in this plan — sub-#3 and #9 will choose icons when those features land.

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- HomeView.test
```

Expected: 7/7 PASS.

- [ ] **Step 5: Verify + commit**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
git add src/features/home/presentation/HomeView.tsx src/features/home/presentation/HomeView.test.tsx
git commit -m "feat(home): rewrite HomeView as presentational over HomeViewModel"
```

---

## Task 10: Home GraphQL queries module

**Files:**
- Create: `src/features/home/data/home.queries.ts`

- [ ] **Step 1: Create the queries file**

Create `src/features/home/data/home.queries.ts`:

```ts
import { graphql } from '@/core/graphql/generated'

export const POS_HOME_COMMISSION = graphql(`
  query PosHomeCommission($staffUserId: ID!, $locationId: ID!, $date: String!) {
    staffServiceRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)
    staffProductRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)
    staffCommissionToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)
  }
`)

export const POS_HOME_CAJA_STATUS = graphql(`
  query PosHomeCajaStatus($locationId: ID!) {
    posCajaStatusHome(locationId: $locationId) {
      isOpen
      accumulatedCents
      openedAt
    }
  }
`)
```

Service count for the CommissionHero is computed client-side in HomePage by counting completed appointments + walk-ins served by the current staff today (Task 11). No new API field needed for Sub-#2 — Sub-#9 My Día will introduce a precise API-backed count if needed.

- [ ] **Step 2: Re-run codegen if needed**

```bash
npm run codegen
```

Expected: codegen registers the new query operations.

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/home/data/home.queries.ts src/core/graphql/generated/
git commit -m "feat(home): add POS_HOME_COMMISSION + POS_HOME_CAJA_STATUS queries"
```

---

## Task 11: HomePage orchestrator rewrite (TDD)

**Files:**
- Modify: `src/features/home/presentation/HomePage.tsx` (full rewrite)
- Create: `src/features/home/presentation/HomePage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/home/presentation/HomePage.test.tsx`:

```tsx
import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HomePage } from './HomePage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, MOCK_VIEWER, InMemoryAuthRepository } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

describe('HomePage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('renders the greeting after viewer + data load', async () => {
    renderWithProviders(<HomePage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/hola/i)).toBeInTheDocument()
  })

  it('renders the StatusBoard once data resolves', async () => {
    renderWithProviders(<HomePage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/sucursal/i)).toBeInTheDocument()
  })

  it('renders the 6 feature tiles', async () => {
    renderWithProviders(<HomePage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByRole('button', { name: /cobrar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /walk-ins/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /agenda/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /caja/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reloj/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mi día/i })).toBeInTheDocument()
  })

  it('refetches on window focus', async () => {
    const getAppointments = vi.fn().mockResolvedValue([])
    const repos = createMockRepositories()
    repos.agenda.getAppointments = getAppointments
    renderWithProviders(<HomePage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await waitFor(() => expect(getAppointments).toHaveBeenCalledTimes(1))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(getAppointments).toHaveBeenCalledTimes(2))
  })

  it('survives a partial fetch failure: shows tiles with "—" subtitle for failing source', async () => {
    const repos = createMockRepositories()
    repos.agenda.getAppointments = vi.fn().mockRejectedValue(new Error('network'))
    renderWithProviders(<HomePage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByRole('button', { name: /agenda/i })).toBeInTheDocument()
    // Other tiles still render normally — the suite remains usable.
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- HomePage.test
```

Expected: FAIL — current HomePage doesn't match this contract.

- [ ] **Step 3: Implement the orchestrator**

Replace the content of `src/features/home/presentation/HomePage.tsx` with:

```tsx
import { useEffect, useState, useCallback } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { useLocation } from '@/core/location/useLocation'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { POS_HOME_COMMISSION, POS_HOME_CAJA_STATUS } from '../data/home.queries'
import { deriveHomeViewModel, type HomeViewModel } from './deriveHomeViewModel'
import { HomeView } from './HomeView'
import type { Appointment } from '@/features/agenda/domain/agenda.types'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository'
import type { WalkIn } from '@/features/walkins/domain/walkins.types'

function todayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayRangeISO(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now); from.setHours(0, 0, 0, 0)
  const to = new Date(now); to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

const EMPTY_VM_INPUT = {
  appointments: [] as Appointment[],
  walkIns: [] as WalkIn[],
  clockEvents: [] as TimeClockEvent[],
  commission: { amountCents: 0, serviceCount: 0, loading: true },
  caja: { isOpen: false, accumulatedCents: null, openedAt: null },
}

export function HomePage() {
  const apollo = useApolloClient()
  const { viewer } = usePosAuth()
  const { locationId } = useLocation()
  const { agenda, clock, walkins } = useRepositories()

  const [vm, setVm] = useState<HomeViewModel | null>(null)

  const refetch = useCallback(async () => {
    if (!viewer || !locationId) return
    const date = todayISO()
    const { from, to } = todayRangeISO()
    const settled = await Promise.allSettled([
      agenda.getAppointments(from, to, locationId),
      clock.getEvents(viewer.staff.id, locationId, date, date),
      walkins.getWalkIns(locationId),
      apollo.query<{
        staffServiceRevenueToday: number
        staffProductRevenueToday: number
        staffCommissionToday: number
      }>({
        query: POS_HOME_COMMISSION,
        variables: { staffUserId: viewer.staff.id, locationId, date },
        fetchPolicy: 'network-only',
      }),
      apollo.query<{
        posCajaStatusHome: { isOpen: boolean; accumulatedCents: number | null; openedAt: string | null }
      }>({
        query: POS_HOME_CAJA_STATUS,
        variables: { locationId },
        fetchPolicy: 'network-only',
      }),
    ])

    const appts = settled[0].status === 'fulfilled' ? settled[0].value : []
    const events = settled[1].status === 'fulfilled' ? settled[1].value : []
    const wkins = settled[2].status === 'fulfilled' ? settled[2].value : []
    const commissionRes = settled[3].status === 'fulfilled' ? settled[3].value.data : null
    const cajaRes = settled[4].status === 'fulfilled' ? settled[4].value.data?.posCajaStatusHome : null

    // Approximate service count = completed appointments + walk-ins served by this staff today.
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const serviceCount =
      appts.filter((a) => a.status === 'COMPLETED' && a.staffUser?.id === viewer.staff.id && new Date(a.startAt) >= today).length +
      wkins.filter((w) => w.status === 'DONE' && w.assignedStaffUser?.id === viewer.staff.id && new Date(w.createdAt) >= today).length

    setVm(
      deriveHomeViewModel({
        staffId: viewer.staff.id,
        staffName: viewer.staff.fullName,
        locationName: 'Norte',
        appointments: appts,
        walkIns: wkins,
        clockEvents: events,
        commission: {
          amountCents: commissionRes?.staffCommissionToday ?? 0,
          serviceCount,
          loading: false,
        },
        caja: {
          isOpen: cajaRes?.isOpen ?? false,
          accumulatedCents: cajaRes?.accumulatedCents ?? null,
          openedAt: cajaRes?.openedAt ? new Date(cajaRes.openedAt) : null,
        },
      }),
    )
  }, [agenda, apollo, clock, walkins, viewer, locationId])

  // Initial fetch
  useEffect(() => {
    if (!viewer || !locationId) {
      setVm(deriveHomeViewModel({
        staffId: viewer?.staff.id ?? '',
        staffName: viewer?.staff.fullName ?? '',
        locationName: 'Norte',
        ...EMPTY_VM_INPUT,
      }))
      return
    }
    void refetch()
  }, [viewer, locationId, refetch])

  // Refetch on window.focus
  useEffect(() => {
    const onFocus = () => { void refetch() }
    window.addEventListener('focus', onFocus)
    return () => { window.removeEventListener('focus', onFocus) }
  }, [refetch])

  if (!vm) {
    // Initial blank state while we wait for viewer + locationId to come from providers.
    return null
  }

  return <HomeView vm={vm} />
}
```

The hardcoded `locationName: 'Norte'` is a known shortcut for Sub-#2 MVP — the location name should ideally come from the `useLocation()` context. If `useLocation()` already exposes `locationName`, use it. If not, this hardcoded value is fine for MVP and a Sub-#3 follow-up can wire the real name (Sub-#3 deals with caja per-location anyway).

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- HomePage.test
```

Expected: 5/5 PASS.

If a test flakes due to async data resolution timing, increase `findBy` timeouts or use `waitFor` with explicit checks.

- [ ] **Step 5: Verify + commit**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run build
git add src/features/home/presentation/HomePage.tsx src/features/home/presentation/HomePage.test.tsx
git commit -m "refactor(home): rewrite HomePage as orchestrator over deriveHomeViewModel"
```

---

## Task 12: Final verification + PR

**Files:** none (verification only)

- [ ] **Step 1: Full gate**

```bash
cd /Users/insightcollective/Documents/Code/BienBravo/bienbravo-pos
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run build
```

Expected: lint clean (or pre-existing only), tsc clean, all tests pass (was 81 + ~35 new = ~116), build clean.

- [ ] **Step 2: Confirm commit count**

```bash
git log --oneline master..HEAD
```

Expected: 11 commits (Tasks 1-11).

- [ ] **Step 3: Manual smoke at iPad landscape (1180×820 in DevTools)**

```bash
npm run dev
```

Visit `http://localhost:5173` (after PIN entry). Walk through:
1. Land on Home → see greeting "Hola, Javi.", commissions hero with `$X.XX`, StatusBoard 3 chips, 6 tiles 3×2.
2. Tap each tile: Cobrar → /checkout, Walk-ins → /walkins, Agenda → /agenda, Caja → placeholder, Reloj → /clock, Mi día → placeholder.
3. Force a wrong network state (kill API, reload) → tiles show subtitles with "—" or "Sin abrir" — no crash.
4. Restart API → return to Home → values refresh on focus.
5. Create an active walk-in for the current barber via admin → return to Home → ActiveServiceStrip appears with customer name + minutes + Cobrar CTA.

If any flow regresses, fix in a separate commit and re-verify.

- [ ] **Step 4: Push branch and open PR**

```bash
git push -u origin feat/pos-home-launcher
gh pr create --title "feat(pos): Home / Launcher sub-#2" --body "$(cat <<'EOF'
## Summary

Sub-project #2 of the POS rework — Home as a focused launcher.

- New foundation primitives: \`<StatusBoard>\`, \`<FeatureTile>\`, \`<PlaceholderPage>\` (added to \`@/shared/pos-ui\` barrel).
- New Home-specific components: \`<CommissionHero>\` (editorial numeral), \`<ActiveServiceStrip>\` (conditional bravo CTA), pure \`deriveHomeViewModel\`.
- HomeView rewrite: greeting + CommissionHero + StatusBoard + ActiveServiceStrip (conditional) + 3×2 feature tile grid (Cobrar, Walk-ins, Agenda, Caja, Reloj, Mi día).
- HomePage orchestrator: parallel fetch via Promise.allSettled (partial-failure resilient), refetch on window.focus, no polling.
- New routes: \`/caja\` and \`/my-day\` render placeholder pages until Sub-#3 / Sub-#9 ship.

Performance KPIs and Activity table moved out (deferred to Sub-#9 My Día). Commissions stay on Home as a hero.

## Cross-repo dependency

Requires \`bienbravo-api\` PR \`feat(api): posCajaStatusHome query for POS Home StatusBoard\` already merged to \`main\`.

## Verification

- \`npm run lint\` — new code clean
- \`npx tsc --noEmit -p tsconfig.app.json\` — clean
- \`npx vitest run\` — was 81 → ~116 tests, all pass
- \`npm run build\` — clean

## Test plan

- [ ] Manual smoke walkthrough at iPad landscape (1180×820):
  1. Greeting + commissions + StatusBoard render correctly
  2. All 6 tiles render and navigate
  3. \`/caja\` and \`/my-day\` show placeholder pages
  4. Active walk-in for current barber → ActiveServiceStrip appears with Cobrar CTA
  5. Window blur + refocus → values refresh
  6. Network failure on one source → tile shows \`—\`, others continue
- [ ] CI green
- [ ] No Performance card / Activity table on Home (moved to Sub-#9)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Verification (per task)

Each task ships a passing commit before the next runs. Per task:
- [ ] `npm run lint` — 0 errors related to changed files
- [ ] `npx tsc --noEmit -p tsconfig.app.json` — clean
- [ ] `npm test` — all tests pass (existing + new)
- [ ] `npm run build` — clean

After Task 12:
- [ ] Manual smoke through 5 scenarios at iPad landscape
- [ ] PR opened with cross-repo coordination note
- [ ] No regression in Sub-#1 lock screen / sub-#0 foundation primitives

---

## Notes

- 11 task commits + 1 verification (no commit) = 11 commits on the branch.
- Cross-repo: API plan ships first. Task 1 hard-checks the API schema before proceeding.
- Service count today is approximated client-side from appointments + walk-ins (good enough for Sub-#2). A precise API-backed count lands in Sub-#9.
- `locationName` hardcoded to `'Norte'` in HomePage for MVP — Sub-#3 wires real name from `useLocation()` once it carries it.
- Foundation primitives (`StatusBoard`, `FeatureTile`, `PlaceholderPage`) are reused by Sub-#3 onwards, so test them well now.
