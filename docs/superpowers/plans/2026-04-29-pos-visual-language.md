# POS Visual Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation visual language for bienbravo-pos: design tokens (type, touch tiers, spacing, color, motion, sharp corners) + 11 foundation components (TouchButton, TileGrid, TileButton, MoneyDisplay, EmptyState v2, Numpad, PinKeypad, MoneyInput, StepBar, WizardShell, SuccessSplash) + a sample "Hello POS" wizard screen for visual verification.

**Architecture:** Single feature branch `feat/pos-visual-language`. Each task is one component or token group, with TDD using Vitest + React Testing Library. New components live in `src/shared/pos-ui/` alongside existing pos-ui (TapButton, EmptyState, etc.) — old components stay until their consumer feature is rebuilt in sub-projects #1-10. New tokens go in `src/index.css` (POS-specific because editorial tokens aren't in the shared DS today).

**Tech Stack:** Vite 7 + React 19 + TS 5 + Tailwind 4 + Vitest 3 + @testing-library/react 16. No new dependencies.

**Spec reference:** `bienbravo-pos/docs/superpowers/specs/2026-04-29-pos-visual-language-design.md`

**Important codebase facts:**
- POS branch is `master` (not `main`).
- POS uses path alias `@/` → `src/` (configured in vitest.config.ts and tsconfig).
- Apollo imports use `@apollo/client/react` (subpath).
- `src/test/setup.ts` already loads `@testing-library/jest-dom/vitest`.
- Shared design-system at `design-system/` is a symlink to `../bienbravo-admin/design-system/`. Editorial tokens (`--color-bravo`, `--color-carbon`, etc.) are admin-local in `bienbravo-admin/src/index.css` — **NOT in the shared DS**. POS redefines them with matching hex values.
- Existing components in `src/shared/pos-ui/` (TapButton, StatusPill, SkeletonBlock, EmptyState, KanbanColumn, SectionHeader, PosCard) use `rounded-2xl` + `--bb-color-*` tokens — they will be replaced incrementally in subsequent sub-projects. Don't delete them in this plan; new components coexist.
- No tests exist yet. This plan establishes the pattern: `<Component>.test.tsx` colocated next to `<Component>.tsx`.
- Verification gate per task: `npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm test && npm run build`.

---

## File Structure

**New files (created in this plan):**

| Path | Responsibility |
|---|---|
| `src/shared/pos-ui/TouchButton.tsx` | Editorial-language primary CTA / secondary / row button with size tiers (min/row/secondary/primary) |
| `src/shared/pos-ui/TouchButton.test.tsx` | Tests for TouchButton |
| `src/shared/pos-ui/TileGrid.tsx` | Responsive grid wrapper (cols configurable) for tile-based layouts |
| `src/shared/pos-ui/TileButton.tsx` | Square tile button used in CategoryGrid, payment method, denominations |
| `src/shared/pos-ui/TileButton.test.tsx` | Tests |
| `src/shared/pos-ui/MoneyDisplay.tsx` | Barlow Condensed numeral with currency separator + size variants |
| `src/shared/pos-ui/MoneyDisplay.test.tsx` | Tests |
| `src/shared/pos-ui/EmptyStateV2.tsx` | Editorial empty state — typographic, no cute icons (replaces existing EmptyState) |
| `src/shared/pos-ui/EmptyStateV2.test.tsx` | Tests |
| `src/shared/pos-ui/Numpad.tsx` | 3×4 numeric keypad, 72px keys, used for cash entry / counts |
| `src/shared/pos-ui/Numpad.test.tsx` | Tests |
| `src/shared/pos-ui/PinKeypad.tsx` | 4×3 PIN entry variant — no decimal, with clear/backspace |
| `src/shared/pos-ui/PinKeypad.test.tsx` | Tests |
| `src/shared/pos-ui/MoneyInput.tsx` | Large amount display + Numpad, controlled component |
| `src/shared/pos-ui/MoneyInput.test.tsx` | Tests |
| `src/shared/pos-ui/StepBar.tsx` | Horizontal wizard step indicator ("Catálogo › Cliente › Pago") |
| `src/shared/pos-ui/StepBar.test.tsx` | Tests |
| `src/shared/pos-ui/WizardShell.tsx` | Page template: StepBar top + content area + bottom CTA bar |
| `src/shared/pos-ui/WizardShell.test.tsx` | Tests |
| `src/shared/pos-ui/SuccessSplash.tsx` | Full-screen success state for completed sale |
| `src/shared/pos-ui/SuccessSplash.test.tsx` | Tests |
| `src/features/_dev/HelloPosPage.tsx` | Sample wizard screen for visual verification (not a real feature) |

**Modified files:**

| Path | Change |
|---|---|
| `src/index.css` | Add editorial color tokens, type scale, touch tiers, spacing scale, motion tokens; drop `--radius-bb-card: 16px`-style rounded values |
| `src/shared/pos-ui/index.ts` | Export the new primitives |
| `src/app/router.tsx` | Add a `/dev/hello-pos` route gated to dev for the sample screen |

**Untouched (per spec):**
- Existing pos-ui (TapButton, StatusPill, SkeletonBlock, EmptyState v1, KanbanColumn, SectionHeader, PosCard) — coexist; sub-projects #1-10 swap consumers
- Existing features (auth, home, checkout, register, walkins, agenda, clock, my-day) — not touched in this plan

---

## Test pattern (established by Task 2)

This is the testing pattern all subsequent component tasks follow:

```tsx
// File: src/shared/pos-ui/Component.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Component } from './Component'

describe('Component', () => {
  it('renders the expected output', () => {
    render(<Component label="X" />)
    expect(screen.getByText('X')).toBeInTheDocument()
  })

  it('handles user interaction', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<Component label="X" onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
```

`@testing-library/user-event` is included transitively via `@testing-library/react@16` — verify with `node -e "require('@testing-library/user-event/package.json')"` if needed; if missing, the implementer should fall back to `fireEvent` from `@testing-library/react` and note in their report.

---

## Task 1: Add editorial design tokens to POS

**Files:**
- Modify: `src/index.css`

This task lays the foundation. All subsequent tasks consume these tokens.

- [ ] **Step 1: Replace the contents of `src/index.css`**

Open `src/index.css` and replace its entire content with:

```css
@import "tailwindcss";
@import "../design-system/tokens/dist/bienbravo.tokens.css";

/* ─────────────────────────────────────────────────────────────────────
 * POS Visual Language tokens (sub-project #0)
 *
 * Inherits the shared design-system base tokens, then defines the
 * editorial layer (--color-bravo / carbon / cuero / leather / bone)
 * with the same hex values as bienbravo-admin/src/index.css. These
 * are admin-local today — when they move to the shared DS, this
 * block becomes a re-export.
 *
 * Also defines POS-specific tokens: type scale, touch tiers, spacing,
 * motion. All sharp corners (no rounded values).
 * ───────────────────────────────────────────────────────────────────── */

@theme {
  /* ── Editorial color palette (matches admin) ── */
  --color-bravo: #c41e3a;
  --color-bravo-muted: #a01830;
  --color-carbon: #0f0e0e;
  --color-carbon-elevated: #1a1918;
  --color-carbon-panel: #252422;
  --color-cuero-viejo: #2a221f;
  --color-cuero-viejo-hover: #352c28;
  --color-leather: #8b7355;
  --color-leather-muted: #5c4d3d;
  --color-bone: #e8e4df;
  --color-bone-muted: #9a958f;
  --color-success: #6b8a73;
  --color-warning: #a87a3a;
  --color-error: #b04a4a;

  /* ── Legacy --color-bb-* aliases (mapped to editorial values).
   *    Existing pos-ui v1 components (TapButton, StatusPill, etc.) still
   *    consume bg-bb-primary, text-bb-text utilities. Aliases keep them
   *    compiling during the migration window. They get deleted at the end
   *    of sub-project #10 once all consumers have migrated to v2. ── */
  --color-bb-primary: var(--color-bravo);
  --color-bb-bg: var(--color-carbon);
  --color-bb-surface: var(--color-carbon-elevated);
  --color-bb-surface-2: var(--color-carbon-panel);
  --color-bb-text: var(--color-bone);
  --color-bb-muted: var(--color-bone-muted);
  --color-bb-border: var(--color-leather-muted);
  --color-bb-success: var(--color-success);
  --color-bb-warning: var(--color-warning);
  --color-bb-danger: var(--color-bravo);
  --color-bb-info: var(--color-leather);

  /* ── Fonts (heredados del shared DS pero exportados como tokens POS) ── */
  --font-pos-ui: "Manrope", system-ui, sans-serif;
  --font-pos-display: "Barlow Condensed", system-ui, sans-serif;
  --font-pos-mono: ui-monospace, "SF Mono", Menlo, monospace;

  /* Legacy font aliases — same migration rationale as --color-bb-* above */
  --font-bb-ui: var(--font-pos-ui);
  --font-bb-display: var(--font-pos-display);
  --font-bb-mono: var(--font-pos-mono);

  /* ── Motion (admin durations + easings) ── */
  --duration-pos-tap: 150ms;
  --duration-pos-sheet-open: 280ms;
  --duration-pos-sheet-close: 220ms;
  --duration-pos-step: 200ms;
  --duration-pos-toast-in: 240ms;
  --duration-pos-toast-out: 200ms;
  --ease-pos-sheet: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-pos-step: cubic-bezier(0.16, 1, 0.3, 1);
}

/* ── POS-specific custom properties (used via var() in components) ── */
:root {
  /* Type scale (10 stops) */
  --pos-text-caption: 13px;
  --pos-text-eyebrow: 13px;
  --pos-text-label: 14px;
  --pos-text-body: 16px;
  --pos-text-body-lg: 18px;
  --pos-text-subtitle: 22px;
  --pos-text-heading: 28px;
  --pos-text-numeral-s: 36px;
  --pos-text-numeral-m: 56px;
  --pos-text-numeral-l: 88px;

  /* Touch tiers (5 levels) */
  --pos-touch-min: 40px;
  --pos-touch-row: 48px;
  --pos-touch-secondary: 56px;
  --pos-touch-primary: 64px;
  --pos-touch-numpad: 72px;

  /* Spacing scale (4px base, 10 stops) */
  --pos-space-1: 4px;
  --pos-space-2: 8px;
  --pos-space-3: 12px;
  --pos-space-4: 16px;
  --pos-space-5: 20px;
  --pos-space-6: 24px;
  --pos-space-8: 32px;
  --pos-space-10: 40px;
  --pos-space-14: 56px;
  --pos-space-20: 80px;
}

@layer base {
  :root {
    color-scheme: dark;
    font-family: var(--font-pos-ui);
    font-size: var(--pos-text-body);
    line-height: 1.5;
    color: var(--color-bone);
    background-color: var(--color-carbon);
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
  }

  *:focus-visible {
    outline: 2px solid var(--color-bravo);
    outline-offset: 2px;
  }

  /* Prevent overscroll bounce on iOS */
  html, body {
    overscroll-behavior: none;
    overflow: hidden;
    height: 100%;
  }

  #root {
    height: 100%;
    overflow: auto;
  }
}

/* ── Animation keyframes ── */
@keyframes pos-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@keyframes pos-sheet-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes pos-sheet-down {
  from { transform: translateY(0); }
  to { transform: translateY(100%); }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

This replaces the entire previous content. Notable changes:
- Drops `--bb-color-*` aliases (no longer used after this rework)
- Drops `--radius-bb-card: 16px` and `--radius-bb-control: 12px` — sharp 0px is the rule
- Adds full editorial palette + type/touch/spacing/motion tokens
- Keeps the iOS overscroll prevention + base font setup
- Adds `prefers-reduced-motion` global respect

- [ ] **Step 2: Run typecheck + build to confirm CSS still parses**

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Expected: clean. The build emits without errors. (Existing components using `--bb-color-primary` etc. may now fail visually — that's expected since those tokens are gone. We'll verify Task 12's sample screen renders correctly with the new tokens; old features will be migrated in their respective sub-projects.)

If the build fails because of removed tokens still referenced in components (TapButton uses `bg-bb-primary` for example), the implementer should NOT change those components in this task — note them in the report as "consumers of stale tokens, will migrate in their respective sub-projects."

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(pos-tokens): add editorial design tokens — colors, type, touch, spacing, motion"
```

---

## Task 2: TouchButton primitive (TDD)

**Files:**
- Create: `src/shared/pos-ui/TouchButton.tsx`
- Create: `src/shared/pos-ui/TouchButton.test.tsx`

The first foundation primitive. Establishes the test pattern for the rest of the plan.

- [ ] **Step 1: Write the failing test**

Create `src/shared/pos-ui/TouchButton.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TouchButton } from './TouchButton'

describe('TouchButton', () => {
  it('renders children as label', () => {
    render(<TouchButton onClick={() => {}}>Cobrar</TouchButton>)
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeInTheDocument()
  })

  it('calls onClick when tapped', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<TouchButton onClick={onClick}>Cobrar</TouchButton>)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies primary variant by default at primary touch height', () => {
    render(<TouchButton onClick={() => {}}>Cobrar</TouchButton>)
    const btn = screen.getByRole('button')
    // primary = bg-bravo, height 64px
    expect(btn.className).toContain('bg-[var(--color-bravo)]')
    expect(btn.className).toContain('h-[var(--pos-touch-primary)]')
  })

  it('applies secondary variant + size when requested', () => {
    render(<TouchButton variant="secondary" size="secondary" onClick={() => {}}>Editar</TouchButton>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('h-[var(--pos-touch-secondary)]')
    expect(btn.className).toContain('border-[var(--color-leather-muted)]')
  })

  it('disables click when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<TouchButton onClick={onClick} disabled>Cobrar</TouchButton>)
    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- TouchButton.test
```

Expected: FAIL with "Cannot find module './TouchButton'" or similar import error.

- [ ] **Step 3: Implement the component**

Create `src/shared/pos-ui/TouchButton.tsx` with:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'min' | 'row' | 'secondary' | 'primary'

interface TouchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-[var(--color-bravo)] text-white hover:bg-[var(--color-bravo-muted)] focus-visible:bg-[var(--color-bravo-muted)]',
  secondary:
    'bg-transparent border border-[var(--color-leather-muted)] text-[var(--color-bone)] hover:bg-[var(--color-cuero-viejo)] focus-visible:bg-[var(--color-cuero-viejo)]',
  ghost:
    'bg-transparent text-[var(--color-bone-muted)] hover:text-[var(--color-bone)] hover:bg-[var(--color-cuero-viejo)] focus-visible:bg-[var(--color-cuero-viejo)]',
  danger:
    'bg-transparent border border-[var(--color-bravo)]/50 text-[var(--color-bravo)] hover:bg-[var(--color-bravo)]/10',
}

const sizeClasses: Record<Size, string> = {
  min: 'h-[var(--pos-touch-min)] px-4 text-[14px] font-medium',
  row: 'h-[var(--pos-touch-row)] px-5 text-[14px] font-medium',
  secondary: 'h-[var(--pos-touch-secondary)] px-6 text-[16px] font-medium',
  primary: 'h-[var(--pos-touch-primary)] px-7 text-[17px] font-bold',
}

/**
 * Editorial touch button with size tiers (min / row / secondary / primary).
 * Sharp corners, sentence case, designed for iPad landscape POS.
 */
export function TouchButton({
  variant = 'primary',
  size = 'primary',
  className,
  disabled,
  children,
  type = 'button',
  ...rest
}: TouchButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center transition-colors duration-[var(--duration-pos-tap)]',
        'focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- TouchButton.test
```

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Run lint + typecheck**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```

Expected: 0 errors related to TouchButton files.

- [ ] **Step 6: Commit**

```bash
git add src/shared/pos-ui/TouchButton.tsx src/shared/pos-ui/TouchButton.test.tsx
git commit -m "feat(pos-ui): add TouchButton primitive with size tiers"
```

---

## Task 3: TileGrid + TileButton (TDD)

**Files:**
- Create: `src/shared/pos-ui/TileGrid.tsx`
- Create: `src/shared/pos-ui/TileButton.tsx`
- Create: `src/shared/pos-ui/TileButton.test.tsx`

`TileGrid` is a layout wrapper; `TileButton` is the unit. Combined they cover catalog tiles, payment method cards, denomination tiles, etc. TileGrid has no logic worth testing — only TileButton gets tests.

- [ ] **Step 1: Write the failing test**

Create `src/shared/pos-ui/TileButton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TileButton } from './TileButton'

describe('TileButton', () => {
  it('renders title and subtitle', () => {
    render(<TileButton title="Corte clásico" subtitle="$250" onClick={() => {}} />)
    expect(screen.getByText('Corte clásico')).toBeInTheDocument()
    expect(screen.getByText('$250')).toBeInTheDocument()
  })

  it('renders without subtitle if omitted', () => {
    render(<TileButton title="Pomada" onClick={() => {}} />)
    expect(screen.getByText('Pomada')).toBeInTheDocument()
    expect(screen.queryByText('$')).not.toBeInTheDocument()
  })

  it('calls onClick when tapped', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<TileButton title="Corte" onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies selected styles when selected prop is true', () => {
    render(<TileButton title="Corte" selected onClick={() => {}} />)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('border-[var(--color-bravo)]')
  })

  it('disables click when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<TileButton title="Corte" disabled onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- TileButton.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement TileButton**

Create `src/shared/pos-ui/TileButton.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

interface TileButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  title: string
  subtitle?: string
  selected?: boolean
}

/**
 * Square tile button used for category items, payment methods,
 * denominations. Aspect 1:1, sharp corners, leather border.
 */
export function TileButton({
  title,
  subtitle,
  selected,
  disabled,
  className,
  type = 'button',
  ...rest
}: TileButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'flex aspect-square w-full flex-col items-center justify-center gap-1 px-3 py-3',
        'border bg-[var(--color-cuero-viejo)] text-[var(--color-bone)]',
        'transition-colors duration-[var(--duration-pos-tap)]',
        'hover:bg-[var(--color-cuero-viejo-hover)] focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-[var(--color-bravo)] bg-[var(--color-cuero-viejo-hover)]'
          : 'border-[var(--color-leather-muted)]',
        className,
      )}
      {...rest}
    >
      <span className="text-center text-[16px] font-medium leading-tight">{title}</span>
      {subtitle && (
        <span className="font-mono text-[13px] text-[var(--color-leather)]">{subtitle}</span>
      )}
    </button>
  )
}
```

- [ ] **Step 4: Implement TileGrid (no tests — pure layout)**

Create `src/shared/pos-ui/TileGrid.tsx`:

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

interface TileGridProps {
  children: ReactNode
  /** Number of columns. Default 4. */
  cols?: 2 | 3 | 4 | 5 | 6
  className?: string
}

const colsClasses: Record<NonNullable<TileGridProps['cols']>, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
}

/**
 * Grid container for TileButtons. Default 4 columns matches catalog layout
 * on iPad landscape; payment-method screens use 3, denominations 4-5.
 */
export function TileGrid({ children, cols = 4, className }: TileGridProps) {
  return (
    <div className={cn('grid gap-3', colsClasses[cols], className)}>{children}</div>
  )
}
```

- [ ] **Step 5: Run tests + lint + typecheck**

```bash
npm test -- TileButton.test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```

Expected: tests PASS, 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/pos-ui/TileGrid.tsx src/shared/pos-ui/TileButton.tsx src/shared/pos-ui/TileButton.test.tsx
git commit -m "feat(pos-ui): add TileGrid + TileButton for catalog/payment tiles"
```

---

## Task 4: MoneyDisplay (TDD)

**Files:**
- Create: `src/shared/pos-ui/MoneyDisplay.tsx`
- Create: `src/shared/pos-ui/MoneyDisplay.test.tsx`

Numerals across the POS use Barlow Condensed at fixed sizes (S/M/L). MoneyDisplay normalizes that.

- [ ] **Step 1: Write the failing test**

Create `src/shared/pos-ui/MoneyDisplay.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MoneyDisplay } from './MoneyDisplay'

describe('MoneyDisplay', () => {
  it('renders cents as MXN with peso sign', () => {
    render(<MoneyDisplay cents={82000} />)
    // The peso sign is rendered separately so it can be styled in leather color
    expect(screen.getByText('$')).toBeInTheDocument()
    expect(screen.getByText('820')).toBeInTheDocument()
  })

  it('renders zero correctly', () => {
    render(<MoneyDisplay cents={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('formats thousands with commas', () => {
    render(<MoneyDisplay cents={342000} />)
    expect(screen.getByText('3,420')).toBeInTheDocument()
  })

  it('shows fractional cents in the decimals span when nonzero', () => {
    render(<MoneyDisplay cents={82050} />)
    expect(screen.getByText('820')).toBeInTheDocument()
    expect(screen.getByText('.50')).toBeInTheDocument()
  })

  it('omits decimals when value is whole', () => {
    render(<MoneyDisplay cents={82000} />)
    expect(screen.queryByText(/\.\d{2}/)).not.toBeInTheDocument()
  })

  it('applies size class for the chosen variant', () => {
    const { container } = render(<MoneyDisplay cents={82000} size="L" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('text-[var(--pos-text-numeral-l)]')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- MoneyDisplay.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement MoneyDisplay**

Create `src/shared/pos-ui/MoneyDisplay.tsx`:

```tsx
import { cn } from '@/shared/lib/cn'

type Size = 'S' | 'M' | 'L'

interface MoneyDisplayProps {
  /** Amount in cents (e.g. 82000 = $820.00). */
  cents: number
  size?: Size
  className?: string
}

const sizeClasses: Record<Size, string> = {
  S: 'text-[var(--pos-text-numeral-s)]',
  M: 'text-[var(--pos-text-numeral-m)]',
  L: 'text-[var(--pos-text-numeral-l)]',
}

/**
 * Editorial money display — Barlow Condensed numeral with leather peso sign.
 * Whole cents render without decimals (e.g. $820); fractional cents render
 * decimals in a dimmer span (e.g. $820.50).
 */
export function MoneyDisplay({ cents, size = 'M', className }: MoneyDisplayProps) {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100).toLocaleString('es-MX')
  const fractional = abs % 100
  const decimals = fractional === 0 ? null : `.${String(fractional).padStart(2, '0')}`

  return (
    <span
      className={cn(
        'font-[var(--font-pos-display)] font-extrabold leading-[0.95] tabular-nums text-[var(--color-bone)]',
        sizeClasses[size],
        className,
      )}
    >
      {sign}
      <span className="text-[var(--color-leather)]">$</span>
      {whole}
      {decimals && <span className="text-[var(--color-bone-muted)]">{decimals}</span>}
    </span>
  )
}
```

- [ ] **Step 4: Run tests + lint + typecheck**

```bash
npm test -- MoneyDisplay.test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```

Expected: tests PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/pos-ui/MoneyDisplay.tsx src/shared/pos-ui/MoneyDisplay.test.tsx
git commit -m "feat(pos-ui): add MoneyDisplay primitive with size tiers"
```

---

## Task 5: EmptyStateV2 (TDD)

**Files:**
- Create: `src/shared/pos-ui/EmptyStateV2.tsx`
- Create: `src/shared/pos-ui/EmptyStateV2.test.tsx`

Editorial empty state — typographic, no cute icons. Replaces the v1 EmptyState which uses `--bb-color-*` tokens.

- [ ] **Step 1: Write the failing test**

Create `src/shared/pos-ui/EmptyStateV2.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { EmptyStateV2 } from './EmptyStateV2'

describe('EmptyStateV2', () => {
  it('renders title and description', () => {
    render(
      <EmptyStateV2
        title="Sin actividad"
        description="No hay ventas hoy todavía"
      />,
    )
    expect(screen.getByText('Sin actividad')).toBeInTheDocument()
    expect(screen.getByText('No hay ventas hoy todavía')).toBeInTheDocument()
  })

  it('renders without action by default', () => {
    render(<EmptyStateV2 title="Vacío" description="Sin items" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders action button when provided and triggers callback', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    render(
      <EmptyStateV2
        title="Vacío"
        description="Sin items"
        action={{ label: 'Agregar primero', onClick: onAction }}
      />,
    )
    const btn = screen.getByRole('button', { name: 'Agregar primero' })
    await user.click(btn)
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- EmptyStateV2.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement EmptyStateV2**

Create `src/shared/pos-ui/EmptyStateV2.tsx`:

```tsx
import { cn } from '@/shared/lib/cn'
import { TouchButton } from './TouchButton'

interface EmptyStateAction {
  label: string
  onClick: () => void
}

interface EmptyStateV2Props {
  title: string
  description: string
  action?: EmptyStateAction
  className?: string
}

/**
 * Editorial empty state — typographic only, no decorative icons. Used when
 * a list/grid has no content. Optional CTA brings the user back to action.
 */
export function EmptyStateV2({ title, description, action, className }: EmptyStateV2Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <p className="font-[var(--font-pos-display)] text-[var(--pos-text-numeral-s)] font-extrabold leading-none text-[var(--color-leather)]">
        {title}
      </p>
      <p className="max-w-md text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
        {description}
      </p>
      {action && (
        <div className="mt-4">
          <TouchButton variant="secondary" size="secondary" onClick={action.onClick}>
            {action.label}
          </TouchButton>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests + lint + typecheck**

```bash
npm test -- EmptyStateV2.test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```

Expected: tests PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/pos-ui/EmptyStateV2.tsx src/shared/pos-ui/EmptyStateV2.test.tsx
git commit -m "feat(pos-ui): add EmptyStateV2 with optional action"
```

---

## Task 6: Numpad (TDD)

**Files:**
- Create: `src/shared/pos-ui/Numpad.tsx`
- Create: `src/shared/pos-ui/Numpad.test.tsx`

3×4 numeric keypad with 72px keys. Used for cash entry, denomination counts. Controlled component — onChange receives the digit pressed.

- [ ] **Step 1: Write the failing test**

Create `src/shared/pos-ui/Numpad.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Numpad } from './Numpad'

describe('Numpad', () => {
  it('renders 0-9 + decimal + backspace', () => {
    render(<Numpad onKey={() => {}} />)
    for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      expect(screen.getByRole('button', { name: d })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: '.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument()
  })

  it('calls onKey with the digit when a number is pressed', async () => {
    const onKey = vi.fn()
    const user = userEvent.setup()
    render(<Numpad onKey={onKey} />)
    await user.click(screen.getByRole('button', { name: '7' }))
    expect(onKey).toHaveBeenCalledWith('7')
  })

  it('calls onKey with "." when decimal pressed', async () => {
    const onKey = vi.fn()
    const user = userEvent.setup()
    render(<Numpad onKey={onKey} />)
    await user.click(screen.getByRole('button', { name: '.' }))
    expect(onKey).toHaveBeenCalledWith('.')
  })

  it('calls onKey with "backspace" when backspace pressed', async () => {
    const onKey = vi.fn()
    const user = userEvent.setup()
    render(<Numpad onKey={onKey} />)
    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(onKey).toHaveBeenCalledWith('backspace')
  })

  it('hides decimal when allowDecimal is false', () => {
    render(<Numpad onKey={() => {}} allowDecimal={false} />)
    expect(screen.queryByRole('button', { name: '.' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- Numpad.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement Numpad**

Create `src/shared/pos-ui/Numpad.tsx`:

```tsx
import { cn } from '@/shared/lib/cn'

export type NumpadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'backspace'

interface NumpadProps {
  onKey: (key: NumpadKey) => void
  /** When false, hides the decimal key (used for PIN-style entry). Default true. */
  allowDecimal?: boolean
  className?: string
}

const BackspaceIcon = () => (
  <svg
    aria-hidden
    className="h-6 w-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l4.5-4.5A2 2 0 019 7h11v10H9a2 2 0 01-1.5-.5L3 12z" />
    <line strokeLinecap="round" x1="13" y1="10" x2="17" y2="14" />
    <line strokeLinecap="round" x1="17" y1="10" x2="13" y2="14" />
  </svg>
)

const NUMPAD_KEYS: { value: NumpadKey; label: string; aria: string }[] = [
  { value: '7', label: '7', aria: '7' },
  { value: '8', label: '8', aria: '8' },
  { value: '9', label: '9', aria: '9' },
  { value: '4', label: '4', aria: '4' },
  { value: '5', label: '5', aria: '5' },
  { value: '6', label: '6', aria: '6' },
  { value: '1', label: '1', aria: '1' },
  { value: '2', label: '2', aria: '2' },
  { value: '3', label: '3', aria: '3' },
]

/**
 * 3×4 numeric keypad with 72px keys. Last row: decimal (when allowed),
 * 0, backspace. Used for cash counts, money entry. Stateless — parent
 * receives every key press via onKey.
 */
export function Numpad({ onKey, allowDecimal = true, className }: NumpadProps) {
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {NUMPAD_KEYS.map((k) => (
        <NumpadButton key={k.value} onClick={() => onKey(k.value)} aria-label={k.aria}>
          {k.label}
        </NumpadButton>
      ))}
      {allowDecimal ? (
        <NumpadButton onClick={() => onKey('.')} aria-label=".">
          .
        </NumpadButton>
      ) : (
        <div />
      )}
      <NumpadButton onClick={() => onKey('0')} aria-label="0">
        0
      </NumpadButton>
      <NumpadButton onClick={() => onKey('backspace')} aria-label="Borrar">
        <BackspaceIcon />
      </NumpadButton>
    </div>
  )
}

interface NumpadButtonProps {
  onClick: () => void
  children: React.ReactNode
  'aria-label': string
}

function NumpadButton({ onClick, children, ...rest }: NumpadButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-[var(--pos-touch-numpad)] items-center justify-center',
        'border border-[var(--color-leather-muted)] bg-[var(--color-cuero-viejo)]',
        'font-[var(--font-pos-display)] text-[30px] font-extrabold text-[var(--color-bone)]',
        'transition-colors duration-[var(--duration-pos-tap)]',
        'hover:bg-[var(--color-cuero-viejo-hover)] focus-visible:outline-none focus-visible:bg-[var(--color-cuero-viejo-hover)]',
        'active:bg-[var(--color-cuero-viejo-hover)]',
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Run tests + lint + typecheck**

```bash
npm test -- Numpad.test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```

Expected: tests PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/pos-ui/Numpad.tsx src/shared/pos-ui/Numpad.test.tsx
git commit -m "feat(pos-ui): add Numpad with 72px keys and decimal toggle"
```

---

## Task 7: PinKeypad (TDD)

**Files:**
- Create: `src/shared/pos-ui/PinKeypad.tsx`
- Create: `src/shared/pos-ui/PinKeypad.test.tsx`

PIN entry variant — internally uses Numpad with `allowDecimal={false}` and tracks entered digits, calling onComplete when length reached. Simpler API than Numpad: PinKeypad owns the digit accumulation.

- [ ] **Step 1: Write the failing test**

Create `src/shared/pos-ui/PinKeypad.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PinKeypad } from './PinKeypad'

describe('PinKeypad', () => {
  it('does not render decimal key', () => {
    render(<PinKeypad length={4} onComplete={() => {}} />)
    expect(screen.queryByRole('button', { name: '.' })).not.toBeInTheDocument()
  })

  it('renders 4 dot indicators by default for length=4', () => {
    const { container } = render(<PinKeypad length={4} onComplete={() => {}} />)
    const dots = container.querySelectorAll('[data-pin-dot]')
    expect(dots).toHaveLength(4)
  })

  it('fills dots as digits are pressed', async () => {
    const user = userEvent.setup()
    const { container } = render(<PinKeypad length={4} onComplete={() => {}} />)
    await user.click(screen.getByRole('button', { name: '1' }))
    await user.click(screen.getByRole('button', { name: '2' }))
    const filled = container.querySelectorAll('[data-pin-dot="filled"]')
    expect(filled).toHaveLength(2)
  })

  it('calls onComplete with the full PIN when length reached', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<PinKeypad length={4} onComplete={onComplete} />)
    await user.click(screen.getByRole('button', { name: '1' }))
    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: '3' }))
    await user.click(screen.getByRole('button', { name: '4' }))
    expect(onComplete).toHaveBeenCalledWith('1234')
  })

  it('removes the last digit when backspace pressed', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<PinKeypad length={4} onComplete={onComplete} />)
    await user.click(screen.getByRole('button', { name: '1' }))
    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    const filled = container.querySelectorAll('[data-pin-dot="filled"]')
    expect(filled).toHaveLength(1)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('ignores additional digits after length is reached', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<PinKeypad length={4} onComplete={onComplete} />)
    for (const d of ['1', '2', '3', '4', '5']) {
      await user.click(screen.getByRole('button', { name: d }))
    }
    // onComplete still only called once, with first 4 digits
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('1234')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- PinKeypad.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement PinKeypad**

Create `src/shared/pos-ui/PinKeypad.tsx`:

```tsx
import { useState, useCallback } from 'react'
import { cn } from '@/shared/lib/cn'
import { Numpad, type NumpadKey } from './Numpad'

interface PinKeypadProps {
  /** Number of digits the PIN should have (typically 4 or 6). */
  length: number
  /** Called once when the user reaches `length` digits. Receives the full PIN string. */
  onComplete: (pin: string) => void
  className?: string
}

/**
 * PIN entry — Numpad without decimal, plus dot indicators above showing
 * how many digits have been entered. Calls onComplete once when full
 * length reached; subsequent digits are ignored until parent resets
 * (typically by remounting with a new `key` prop).
 */
export function PinKeypad({ length, onComplete, className }: PinKeypadProps) {
  const [digits, setDigits] = useState('')

  const handleKey = useCallback(
    (key: NumpadKey) => {
      if (key === 'backspace') {
        setDigits((prev) => prev.slice(0, -1))
        return
      }
      if (key === '.') return
      setDigits((prev) => {
        if (prev.length >= length) return prev
        const next = prev + key
        if (next.length === length) {
          // Defer onComplete so React state has settled before parent reacts.
          queueMicrotask(() => onComplete(next))
        }
        return next
      })
    },
    [length, onComplete],
  )

  return (
    <div className={cn('flex flex-col items-center gap-8', className)}>
      <div className="flex gap-3">
        {Array.from({ length }).map((_, i) => {
          const filled = i < digits.length
          return (
            <span
              key={i}
              data-pin-dot={filled ? 'filled' : 'empty'}
              className={cn(
                'h-4 w-4 rounded-full border-2 transition-colors duration-[var(--duration-pos-tap)]',
                filled
                  ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]'
                  : 'border-[var(--color-leather-muted)] bg-transparent',
              )}
            />
          )
        })}
      </div>
      <Numpad onKey={handleKey} allowDecimal={false} />
    </div>
  )
}
```

- [ ] **Step 4: Run tests + lint + typecheck**

```bash
npm test -- PinKeypad.test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```

Expected: tests PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/pos-ui/PinKeypad.tsx src/shared/pos-ui/PinKeypad.test.tsx
git commit -m "feat(pos-ui): add PinKeypad with dot indicators and onComplete"
```

---

## Task 8: MoneyInput (TDD)

**Files:**
- Create: `src/shared/pos-ui/MoneyInput.tsx`
- Create: `src/shared/pos-ui/MoneyInput.test.tsx`

Large amount display + Numpad combined. Controlled component — parent gives `cents` and receives onChange. Used for cash entry, denomination counts.

- [ ] **Step 1: Write the failing test**

Create `src/shared/pos-ui/MoneyInput.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MoneyInput } from './MoneyInput'

describe('MoneyInput', () => {
  it('renders the current amount via MoneyDisplay', () => {
    render(<MoneyInput cents={82000} onChange={() => {}} />)
    expect(screen.getByText('820')).toBeInTheDocument()
  })

  it('appends digit when number key pressed', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MoneyInput cents={0} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '5' }))
    // 5 cents
    expect(onChange).toHaveBeenLastCalledWith(5)
  })

  it('shifts and appends for sequential digits', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<MoneyInput cents={0} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '1' }))
    expect(onChange).toHaveBeenLastCalledWith(1)
    rerender(<MoneyInput cents={1} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '2' }))
    expect(onChange).toHaveBeenLastCalledWith(12)
    rerender(<MoneyInput cents={12} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '5' }))
    expect(onChange).toHaveBeenLastCalledWith(125)
  })

  it('removes the last digit when backspace pressed', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MoneyInput cents={125} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(onChange).toHaveBeenLastCalledWith(12)
  })

  it('ignores decimal key (cents are implicit by digit position)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MoneyInput cents={0} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '.' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- MoneyInput.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement MoneyInput**

Create `src/shared/pos-ui/MoneyInput.tsx`:

```tsx
import { useCallback } from 'react'
import { cn } from '@/shared/lib/cn'
import { MoneyDisplay } from './MoneyDisplay'
import { Numpad, type NumpadKey } from './Numpad'

interface MoneyInputProps {
  /** Current amount in cents. */
  cents: number
  onChange: (nextCents: number) => void
  className?: string
}

/**
 * Money entry: large MoneyDisplay readout above + Numpad below. Each digit
 * shifts the value left (×10) — so "1" → "12" → "125" → 125 cents = $1.25.
 * Decimal key is intentionally ignored: cents are implicit by position
 * (last 2 digits are always cents).
 */
export function MoneyInput({ cents, onChange, className }: MoneyInputProps) {
  const handleKey = useCallback(
    (key: NumpadKey) => {
      if (key === '.') return
      if (key === 'backspace') {
        onChange(Math.floor(cents / 10))
        return
      }
      const digit = Number(key)
      onChange(cents * 10 + digit)
    },
    [cents, onChange],
  )

  return (
    <div className={cn('flex flex-col items-center gap-8', className)}>
      <MoneyDisplay cents={cents} size="L" />
      <Numpad onKey={handleKey} allowDecimal={false} />
    </div>
  )
}
```

- [ ] **Step 4: Run tests + lint + typecheck**

```bash
npm test -- MoneyInput.test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```

Expected: tests PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/pos-ui/MoneyInput.tsx src/shared/pos-ui/MoneyInput.test.tsx
git commit -m "feat(pos-ui): add MoneyInput — MoneyDisplay + Numpad shift-left entry"
```

---

## Task 9: StepBar (TDD)

**Files:**
- Create: `src/shared/pos-ui/StepBar.tsx`
- Create: `src/shared/pos-ui/StepBar.test.tsx`

Horizontal wizard step indicator: "Catálogo › Cliente › Pago" with the active step in bone, others muted.

- [ ] **Step 1: Write the failing test**

Create `src/shared/pos-ui/StepBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StepBar } from './StepBar'

describe('StepBar', () => {
  it('renders all step labels', () => {
    render(<StepBar steps={['Catálogo', 'Cliente', 'Pago']} activeIndex={0} />)
    expect(screen.getByText('Catálogo')).toBeInTheDocument()
    expect(screen.getByText('Cliente')).toBeInTheDocument()
    expect(screen.getByText('Pago')).toBeInTheDocument()
  })

  it('marks the active step with bone color', () => {
    render(<StepBar steps={['Catálogo', 'Cliente', 'Pago']} activeIndex={1} />)
    const active = screen.getByText('Cliente')
    expect(active.className).toContain('text-[var(--color-bone)]')
  })

  it('renders separators between steps', () => {
    const { container } = render(
      <StepBar steps={['Catálogo', 'Cliente', 'Pago']} activeIndex={0} />,
    )
    const separators = container.querySelectorAll('[data-step-separator]')
    expect(separators).toHaveLength(2)
  })

  it('renders only labels with no separators when single step', () => {
    const { container } = render(<StepBar steps={['Solo paso']} activeIndex={0} />)
    expect(container.querySelectorAll('[data-step-separator]')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- StepBar.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement StepBar**

Create `src/shared/pos-ui/StepBar.tsx`:

```tsx
import { Fragment } from 'react'
import { cn } from '@/shared/lib/cn'

interface StepBarProps {
  steps: string[]
  /** Index of the active (current) step. Past steps render as completed. */
  activeIndex: number
  className?: string
}

/**
 * Horizontal wizard step indicator. Active step in bone (--color-bone),
 * past steps in bone-muted, future steps in leather-muted. Sentence case.
 */
export function StepBar({ steps, activeIndex, className }: StepBarProps) {
  return (
    <ol
      className={cn(
        'flex items-center gap-2 px-5 py-3 text-[var(--pos-text-label)]',
        className,
      )}
      aria-label="Pasos del proceso"
    >
      {steps.map((step, i) => {
        const state =
          i === activeIndex ? 'active' : i < activeIndex ? 'past' : 'future'
        return (
          <Fragment key={step}>
            {i > 0 && (
              <span
                aria-hidden
                data-step-separator
                className="text-[var(--color-leather-muted)]"
              >
                ›
              </span>
            )}
            <li
              aria-current={state === 'active' ? 'step' : undefined}
              className={cn(
                'font-medium',
                state === 'active' && 'font-semibold text-[var(--color-bone)]',
                state === 'past' && 'text-[var(--color-bone-muted)]',
                state === 'future' && 'text-[var(--color-leather-muted)]',
              )}
            >
              {step}
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
```

- [ ] **Step 4: Run tests + lint + typecheck**

```bash
npm test -- StepBar.test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```

Expected: tests PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/pos-ui/StepBar.tsx src/shared/pos-ui/StepBar.test.tsx
git commit -m "feat(pos-ui): add StepBar wizard indicator"
```

---

## Task 10: WizardShell (TDD)

**Files:**
- Create: `src/shared/pos-ui/WizardShell.tsx`
- Create: `src/shared/pos-ui/WizardShell.test.tsx`

Page template: StepBar top + content area scrollable + bottom CTA bar fixed. The CTA bar accepts a `cta` slot (the primary "Siguiente" button) plus optional `meta` (e.g., cart total).

- [ ] **Step 1: Write the failing test**

Create `src/shared/pos-ui/WizardShell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { WizardShell } from './WizardShell'

describe('WizardShell', () => {
  it('renders steps via StepBar', () => {
    render(
      <WizardShell
        steps={['Catálogo', 'Cliente', 'Pago']}
        activeIndex={0}
        cta={<button type="button">Siguiente</button>}
      >
        <p>Body content</p>
      </WizardShell>,
    )
    expect(screen.getByText('Catálogo')).toBeInTheDocument()
    expect(screen.getByText('Cliente')).toBeInTheDocument()
    expect(screen.getByText('Pago')).toBeInTheDocument()
  })

  it('renders body children', () => {
    render(
      <WizardShell
        steps={['A']}
        activeIndex={0}
        cta={<button type="button">Siguiente</button>}
      >
        <p>Body content</p>
      </WizardShell>,
    )
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('renders cta', () => {
    render(
      <WizardShell
        steps={['A']}
        activeIndex={0}
        cta={<button type="button">Siguiente</button>}
      >
        <p>Body</p>
      </WizardShell>,
    )
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument()
  })

  it('renders meta slot when provided', () => {
    render(
      <WizardShell
        steps={['A']}
        activeIndex={0}
        cta={<button type="button">Siguiente</button>}
        meta={<span>3 líneas</span>}
      >
        <p>Body</p>
      </WizardShell>,
    )
    expect(screen.getByText('3 líneas')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- WizardShell.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement WizardShell**

Create `src/shared/pos-ui/WizardShell.tsx`:

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'
import { StepBar } from './StepBar'

interface WizardShellProps {
  steps: string[]
  activeIndex: number
  /** Primary CTA — typically a TouchButton size="primary". */
  cta: ReactNode
  /** Optional metadata in the bottom bar — typically cart total / count. */
  meta?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Wizard page template. StepBar top, scrollable content area, fixed
 * bottom bar with meta (left) + CTA (right). Designed for iPad landscape
 * where the wizard owns the entire viewport.
 */
export function WizardShell({
  steps,
  activeIndex,
  cta,
  meta,
  children,
  className,
}: WizardShellProps) {
  return (
    <div className={cn('flex h-full flex-col bg-[var(--color-carbon)]', className)}>
      <header className="shrink-0 border-b border-[var(--color-leather-muted)]/40">
        <StepBar steps={steps} activeIndex={activeIndex} />
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</main>
      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-6 py-4">
        <div className="min-w-0 flex-1">{meta}</div>
        <div className="shrink-0">{cta}</div>
      </footer>
    </div>
  )
}
```

- [ ] **Step 4: Run tests + lint + typecheck**

```bash
npm test -- WizardShell.test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```

Expected: tests PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/pos-ui/WizardShell.tsx src/shared/pos-ui/WizardShell.test.tsx
git commit -m "feat(pos-ui): add WizardShell page template"
```

---

## Task 11: SuccessSplash (TDD)

**Files:**
- Create: `src/shared/pos-ui/SuccessSplash.tsx`
- Create: `src/shared/pos-ui/SuccessSplash.test.tsx`

Full-screen success state for completed sale. Big numeral hero, optional subtitle, optional action.

- [ ] **Step 1: Write the failing test**

Create `src/shared/pos-ui/SuccessSplash.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SuccessSplash } from './SuccessSplash'

describe('SuccessSplash', () => {
  it('renders the title', () => {
    render(<SuccessSplash title="¡Cobrado!" />)
    expect(screen.getByText('¡Cobrado!')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<SuccessSplash title="¡Cobrado!" subtitle="Mesa 3 · $820" />)
    expect(screen.getByText('Mesa 3 · $820')).toBeInTheDocument()
  })

  it('renders action button and triggers callback', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    render(
      <SuccessSplash
        title="¡Cobrado!"
        action={{ label: 'Nueva venta', onClick: onAction }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Nueva venta' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- SuccessSplash.test
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement SuccessSplash**

Create `src/shared/pos-ui/SuccessSplash.tsx`:

```tsx
import { cn } from '@/shared/lib/cn'
import { TouchButton } from './TouchButton'

interface SuccessAction {
  label: string
  onClick: () => void
}

interface SuccessSplashProps {
  title: string
  subtitle?: string
  action?: SuccessAction
  className?: string
}

/**
 * Full-screen success state. Big Barlow Condensed title in success green,
 * optional subtitle, optional CTA. Used for completed sale, completed cash
 * count, completed PIN unlock.
 */
export function SuccessSplash({
  title,
  subtitle,
  action,
  className,
}: SuccessSplashProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex h-full flex-col items-center justify-center gap-6 bg-[var(--color-carbon)] px-6 text-center',
        className,
      )}
    >
      <p className="font-[var(--font-pos-display)] text-[var(--pos-text-numeral-l)] font-extrabold leading-none text-[var(--color-success)]">
        {title}
      </p>
      {subtitle && (
        <p className="text-[var(--pos-text-body-lg)] text-[var(--color-bone-muted)]">
          {subtitle}
        </p>
      )}
      {action && (
        <div className="mt-4">
          <TouchButton onClick={action.onClick}>{action.label}</TouchButton>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests + lint + typecheck**

```bash
npm test -- SuccessSplash.test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```

Expected: tests PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/pos-ui/SuccessSplash.tsx src/shared/pos-ui/SuccessSplash.test.tsx
git commit -m "feat(pos-ui): add SuccessSplash full-screen success state"
```

---

## Task 12: Update pos-ui barrel + add sample wizard route

**Files:**
- Modify: `src/shared/pos-ui/index.ts`
- Create: `src/features/_dev/HelloPosPage.tsx`
- Modify: `src/app/router.tsx`

Sample screen lets us visually verify the entire token + component system on a real iPad. Lives at `/dev/hello-pos`. Not a real feature.

- [ ] **Step 1: Update the pos-ui barrel**

Replace `src/shared/pos-ui/index.ts` with:

```ts
// Existing v1 components — kept until consumers migrate in sub-projects #1-10
export { PosCard } from './PosCard'
export { TapButton } from './TapButton'
export { StatusPill } from './StatusPill'
export { SkeletonBlock } from './SkeletonBlock'
export { EmptyState } from './EmptyState'
export { KanbanColumn } from './KanbanColumn'
export { SectionHeader } from './SectionHeader'

// Foundation v2 components — sub-project #0
export { TouchButton } from './TouchButton'
export { TileGrid } from './TileGrid'
export { TileButton } from './TileButton'
export { MoneyDisplay } from './MoneyDisplay'
export { EmptyStateV2 } from './EmptyStateV2'
export { Numpad } from './Numpad'
export type { NumpadKey } from './Numpad'
export { PinKeypad } from './PinKeypad'
export { MoneyInput } from './MoneyInput'
export { StepBar } from './StepBar'
export { WizardShell } from './WizardShell'
export { SuccessSplash } from './SuccessSplash'
```

- [ ] **Step 2: Create the sample page**

Create `src/features/_dev/HelloPosPage.tsx`:

```tsx
import { useState } from 'react'
import {
  WizardShell,
  TileGrid,
  TileButton,
  MoneyDisplay,
  TouchButton,
  MoneyInput,
  EmptyStateV2,
  SuccessSplash,
} from '@/shared/pos-ui'

const STEPS = ['Catálogo', 'Pago', 'Listo']

interface CartLine {
  id: string
  title: string
  cents: number
}

const SAMPLE_ITEMS = [
  { id: 's1', title: 'Corte clásico', cents: 25000 },
  { id: 's2', title: 'Fade', cents: 28000 },
  { id: 's3', title: 'Barba', cents: 18000 },
  { id: 's4', title: 'Diseño', cents: 12000 },
  { id: 'p1', title: 'Pomada', cents: 39000 },
  { id: 'p2', title: 'Shampoo', cents: 22000 },
]

/**
 * Visual verification screen for the foundation tokens + components.
 * Mounted at /dev/hello-pos, not a real POS feature. Validates that
 * tokens, primitives, and the wizard shell compose correctly.
 */
export function HelloPosPage() {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [cart, setCart] = useState<CartLine[]>([])
  const [paid, setPaid] = useState(0)

  const total = cart.reduce((sum, l) => sum + l.cents, 0)

  function addToCart(item: { id: string; title: string; cents: number }) {
    setCart((prev) => [...prev, { ...item, id: `${item.id}-${prev.length}` }])
  }

  if (step === 2) {
    return (
      <SuccessSplash
        title="¡Cobrado!"
        subtitle={`Total: $${(total / 100).toLocaleString('es-MX')}`}
        action={{
          label: 'Nueva venta',
          onClick: () => {
            setCart([])
            setPaid(0)
            setStep(0)
          },
        }}
      />
    )
  }

  if (step === 1) {
    return (
      <WizardShell
        steps={STEPS}
        activeIndex={1}
        meta={
          <span className="text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
            Total: <strong className="text-[var(--color-bone)]">${(total / 100).toLocaleString('es-MX')}</strong>
          </span>
        }
        cta={
          <TouchButton onClick={() => setStep(2)} disabled={paid < total}>
            Confirmar pago
          </TouchButton>
        }
      >
        <div className="flex flex-col items-center gap-8">
          <p className="text-[var(--pos-text-body-lg)] text-[var(--color-bone-muted)]">
            Recibe del cliente
          </p>
          <MoneyInput cents={paid} onChange={setPaid} />
        </div>
      </WizardShell>
    )
  }

  return (
    <WizardShell
      steps={STEPS}
      activeIndex={0}
      meta={
        <div className="flex items-baseline gap-3">
          <span className="text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
            Carrito
          </span>
          <MoneyDisplay cents={total} size="S" />
          <span className="text-[var(--pos-text-caption)] text-[var(--color-leather)]">
            {cart.length} {cart.length === 1 ? 'línea' : 'líneas'}
          </span>
        </div>
      }
      cta={
        <TouchButton onClick={() => setStep(1)} disabled={cart.length === 0}>
          Cobrar
        </TouchButton>
      }
    >
      {SAMPLE_ITEMS.length === 0 ? (
        <EmptyStateV2
          title="Sin servicios"
          description="No hay nada en el catálogo todavía."
        />
      ) : (
        <TileGrid cols={3}>
          {SAMPLE_ITEMS.map((item) => (
            <TileButton
              key={item.id}
              title={item.title}
              subtitle={`$${(item.cents / 100).toLocaleString('es-MX')}`}
              onClick={() => addToCart(item)}
            />
          ))}
        </TileGrid>
      )}
    </WizardShell>
  )
}
```

- [ ] **Step 3: Add the route**

Open `src/app/router.tsx` and add the import + route. The current file structure (per earlier inspection) wraps routes inside `PosShell`. Since `/dev/hello-pos` is a sample screen that should bypass shell chrome, mount it as a sibling of the lock route (top-level).

Add this import near the top:
```tsx
import { HelloPosPage } from '@/features/_dev/HelloPosPage'
```

Add this route entry to the top-level array (before the `{ path: '*', ... }` catch-all):
```tsx
{ path: '/dev/hello-pos', element: <HelloPosPage /> },
```

- [ ] **Step 4: Run lint + typecheck + build**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Expected: 0 errors.

- [ ] **Step 5: Manual visual verification**

Run `npm run dev` and load `http://localhost:5173/dev/hello-pos` in a browser at iPad landscape resolution (1180×820 in DevTools).

Expected:
- Wizard shows steps "Catálogo › Pago › Listo" with first active.
- Catalog grid 3-column with 6 sample tiles, each tappable.
- Tap a tile → adds to cart, footer "Carrito" total updates.
- "Cobrar" CTA in footer disabled until something is in the cart, then enabled.
- Click "Cobrar" → step transitions to "Pago" with MoneyInput showing "$0".
- Numpad fills the amount; "Confirmar pago" disabled until paid >= total.
- Click "Confirmar pago" → SuccessSplash with "¡Cobrado!" + "Nueva venta" CTA.
- Click "Nueva venta" → resets to step 0.

Spot-check accessibility:
- Tab key navigates through tiles + footer CTA.
- Focus rings visible (2px bravo with offset).
- All interactive elements ≥40px touch target (Numpad keys 72px, primary CTA 64px, tiles 1:1 aspect at column width).
- Color contrast: bone (#e8e4df) on carbon (#0f0e0e) clearly readable.

If any of the above fails, the implementer should report the specific failure and the controller will dispatch a fix.

- [ ] **Step 6: Commit**

```bash
git add src/shared/pos-ui/index.ts src/features/_dev/HelloPosPage.tsx src/app/router.tsx
git commit -m "feat(pos-ui): export foundation primitives + add /dev/hello-pos sample wizard"
```

---

## Task 13: Final verification + acceptance

**Files:** none (verification only)

- [ ] **Step 1: Re-run the full test suite**

```bash
npm test
```

Expected: all tests pass. New foundation primitives have ~30+ tests collectively.

- [ ] **Step 2: Final lint + typecheck + build**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Expected: 0 errors, 0 type errors, build succeeds.

- [ ] **Step 3: Verify token consistency**

Run: `grep -rn "rounded-2xl\|rounded-xl\|rounded-md\|rounded-lg" src/shared/pos-ui/Touch* src/shared/pos-ui/Tile* src/shared/pos-ui/Money* src/shared/pos-ui/Empty*V2* src/shared/pos-ui/Num* src/shared/pos-ui/Pin* src/shared/pos-ui/Step* src/shared/pos-ui/Wizard* src/shared/pos-ui/Success*`

Expected: zero matches. The new primitives use sharp 0px corners only.

Run: `grep -rn "bb-color\|bb-radius" src/shared/pos-ui/Touch* src/shared/pos-ui/Tile* src/shared/pos-ui/Money* src/shared/pos-ui/Empty*V2* src/shared/pos-ui/Num* src/shared/pos-ui/Pin* src/shared/pos-ui/Step* src/shared/pos-ui/Wizard* src/shared/pos-ui/Success*`

Expected: zero matches. New primitives use editorial `--color-*` tokens only.

- [ ] **Step 4: Acceptance against spec**

Open `docs/superpowers/specs/2026-04-29-pos-visual-language-design.md` and verify each acceptance bullet of sub-project #0:

- [ ] Tokens (type, touch, spacing, color, motion) defined in `src/index.css` ✅ (Task 1)
- [ ] 10 foundation components implemented (TouchButton, TileGrid+TileButton, MoneyDisplay, EmptyStateV2, Numpad, PinKeypad, MoneyInput, StepBar, WizardShell, SuccessSplash) ✅ (Tasks 2-11; TileGrid+TileButton count as 1)
- [ ] Tests for each ✅ (Tasks 2-11)
- [ ] Sample screen renders correctly at iPad landscape ✅ (Task 12)
- [ ] Lint + typecheck + build clean ✅ (Step 2 of this task)
- [ ] WCAG AA verified in spot-check ✅ (Task 12 Step 5)
- [ ] Tokens documented in spec ✅ (already in spec)

- [ ] **Step 5: Final commit (if cleanup needed)**

If verification surfaced minor fixes (typo, comment, etc.), commit them with:

```bash
git commit -am "chore(pos-ui): post-acceptance cleanup"
```

If everything was already clean, no commit needed.

---

## Verification (per task)

Each task ships a passing PR before the next runs. Per task:
- [ ] All tests pass (`npm test`)
- [ ] Lint clean (`npm run lint`)
- [ ] Typecheck clean (`npx tsc --noEmit -p tsconfig.app.json`)
- [ ] Build succeeds (`npm run build`)

After Task 13:
- [ ] Sample screen visually verified at iPad landscape
- [ ] Cero `rounded-{md,lg,xl,2xl}` en los nuevos primitives
- [ ] Cero `bb-color-*` o `bb-radius-*` en los nuevos primitives
- [ ] Foundation listo para que sub-proyectos #1-10 lo consuman

---

## Notes

- This plan is intended to be executed via subagent-driven-development. Each task ≈ one subagent dispatch (implementer + spec review + code quality review).
- The 13 tasks are sequential by data flow (T1 unblocks rest, T6 unblocks T8, T9-T10 unblock T12), but tasks T2-T5 are independent and can also run sequentially with no extra coordination needed.
- Old pos-ui components (TapButton, EmptyState v1, etc.) are intentionally left untouched. They'll be deleted incrementally as their consumers migrate in sub-projects #1-10. Final deletion happens at the end of #10.
- If any task surfaces a token gap (e.g., need a new spacing stop), the implementer should add it to `src/index.css` in that task's commit and note the addition in their report.
