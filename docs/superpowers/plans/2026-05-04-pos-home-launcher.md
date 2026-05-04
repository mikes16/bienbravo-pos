# POS Home / Hoy Implementation Plan (D direction)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current grid-launcher Hoy with a queue-list view (greeting + commission row + chronological list of citas+walk-ins + contextual CTA + bottom-tab nav). Privacy: per-user filtering. Familiar bottom-tab pattern with editorial v2 visual.

**Architecture:** PosShell upgrade hosts new `<IdentityStripV2>` (top) + `<Outlet />` + new `<BottomTabNav>` (bottom). HoyPage orchestrator feeds `HoyView` via pure `deriveHoyViewModel`. New foundation: `<BottomTabNav>` + 4 Game Icons React wrappers. Reuses Sub-#0 tokens; reuses existing API queries (no new API work — PR #11 already merged).

**Tech Stack:** Vite 7 + React 19 + TS 5 + Tailwind 4 + Apollo Client 4 + Vitest 3.

**Spec reference:** `bienbravo-pos/docs/superpowers/specs/2026-05-04-pos-home-launcher-design.md`

**Branch state at start of execution:**
- Current branch is `feat/pos-home-launcher` with commits from the v1 grid attempt + new spec.
- The plan ASSUMES the branch will be reset to keep only foundation primitives + schema sync + new spec, dropping the v1 grid components. Task 0 documents the reset.
- API plan (PR #11) already merged to bienbravo-api `main`. No further API work.

**Important codebase facts:**
- POS branch is `master`. Path alias `@/` → `src/`.
- Apollo: `@apollo/client/react` for hooks, `@apollo/client` for values/types.
- `cn` at `src/shared/lib/cn.ts`. `formatMoney` at `src/shared/lib/money.ts` (returns `$345` for whole numbers, `$345.50` for fractional, es-MX locale).
- Foundation primitives already in `@/shared/pos-ui` barrel: `TouchButton`, `TileGrid`, `TileButton`, `MoneyDisplay`, `EmptyStateV2`, `Numpad`, `PinKeypad`, `MoneyInput`, `StepBar`, `WizardShell`, `SuccessSplash`, `StatusBoard`, `FeatureTile`, `PlaceholderPage`. The last three (StatusBoard/FeatureTile/PlaceholderPage) were built in PR #10's foundation phase and are kept.
- Existing icons at `@/shared/pos-ui/GoogleIcon.tsx` (Material Symbols). Game Icons go to a NEW dir `@/shared/pos-ui/icons/`.
- Routes registered in `src/app/router.tsx`. Existing routes: `/`, `/home`, `/checkout`, `/register`, `/clock`, `/agenda`, `/walkins`, `/my-day`, `/dev/hello-pos`, `*`.
- `useLocation()` from `@/core/location/useLocation` returns `{ locationId, setLocationId }`. Does NOT currently expose `locationName`. Sub-#2 needs this — see Task 2.
- `usePosAuth()` returns `{ viewer, isAuthenticated, isLocked, loading, pinLockedUntil, pinLogin, logout, lock, unlock }`. Viewer has `staff: { id, fullName, photoUrl, email, ... }`.
- `renderWithProviders` test helper wraps with MemoryRouter + RepositoryProvider + LocationProvider + PosAuthProvider + ToastProvider + MockedProvider (Apollo). Use it for HoyPage tests.
- Verification gate per task: `npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm test && npm run build`.

---

## File Structure

**Created**:
- `src/shared/pos-ui/icons/StopwatchIcon.tsx` (Game Icons SVG wrapper)
- `src/shared/pos-ui/icons/GameCalendarIcon.tsx`
- `src/shared/pos-ui/icons/TwoCoinsIcon.tsx`
- `src/shared/pos-ui/icons/StrongboxIcon.tsx`
- `src/shared/pos-ui/icons/index.ts` (barrel)
- `src/shared/pos-ui/icons/LICENSE_GAME_ICONS.md`
- `src/shared/pos-ui/BottomTabNav.tsx` + `.test.tsx`
- `src/app/IdentityStripV2.tsx` + `.test.tsx`
- `src/features/home/presentation/HoyRow.tsx` + `.test.tsx`
- `src/features/home/presentation/ContextualCTABar.tsx` + `.test.tsx`
- `src/features/home/presentation/HoyView.tsx` + `.test.tsx`
- `src/features/home/presentation/HoyPage.tsx` + `.test.tsx`
- `src/features/home/presentation/deriveHoyViewModel.ts` + `.test.ts`

**Modified**:
- `src/app/PosShell.tsx` — full rewrite to host IdentityStripV2 + BottomTabNav
- `src/app/router.tsx` — new `/hoy` route, redirects for old paths
- `src/shared/pos-ui/index.ts` — export BottomTabNav + icons barrel re-export
- `src/core/location/LocationProvider.tsx` — expose `locationName` (Task 2)

**Deleted (the v1 grid components)**:
- `src/features/home/presentation/HomeView.tsx` + `.test.tsx`
- `src/features/home/presentation/HomePage.tsx` + `.test.tsx`
- `src/features/home/presentation/CommissionHero.tsx` + `.test.tsx`
- `src/features/home/presentation/ActiveServiceStrip.tsx` + `.test.tsx`
- `src/features/home/presentation/deriveHomeViewModel.ts` + `.test.ts`
- `src/features/home/data/home.queries.ts` (kept) — but the file content stays, queries unchanged

**Kept (foundation, untouched)**:
- `src/shared/pos-ui/StatusBoard.tsx` + test
- `src/shared/pos-ui/FeatureTile.tsx` + test
- `src/shared/pos-ui/PlaceholderPage.tsx` + test
- `src/features/home/data/home.queries.ts` (POS_HOME_COMMISSION + POS_HOME_CAJA_STATUS)

---

## Task 0: Reset branch to foundation state

**Files:** none (git operation only)

- [ ] **Step 1: Identify the foundation commits to keep**

The branch currently has 11 task commits. We keep:
- `05424c6` `chore(codegen): sync API schema with posCajaStatusHome query`
- `e059afb` `feat(pos-ui): add StatusBoard foundation primitive`
- `a7430ea` `feat(pos-ui): add FeatureTile foundation primitive`
- `ab5b269` `feat(pos-ui): add PlaceholderPage foundation primitive`
- `2887cd9` `feat(home): add POS_HOME_COMMISSION + POS_HOME_CAJA_STATUS queries`
- `85de41c` `docs(spec): pivot Sub-#2 to D direction (queue-list + bottom-tab)` (the new spec)

We drop:
- `62261a4` `feat(home): add CommissionHero with editorial numeral + pluralization`
- `a109872` `feat(home): add ActiveServiceStrip with bravo CTA`
- `8e71ca0` `feat(home): pure deriveHomeViewModel transforms raw data → viewmodel`
- `a1fdcde` `feat(home): rewrite HomeView as presentational over HomeViewModel`
- `ed3c26c` `refactor(home): clean HomePage orchestrator + window.focus refetch + tests`

- [ ] **Step 2: Cherry-pick the foundation commits onto a fresh base, OR use interactive rebase to drop the unwanted ones**

The cleanest approach is a manual reset + cherry-pick:

```bash
cd /Users/insightcollective/Documents/Code/BienBravo/bienbravo-pos
git fetch origin master
# Save current commits we want to keep
git log --oneline master..HEAD
# Reset branch to master, then cherry-pick the keepers in order:
git reset --hard origin/master
git cherry-pick 05424c6   # schema sync
git cherry-pick e059afb   # StatusBoard
git cherry-pick a7430ea   # FeatureTile
git cherry-pick ab5b269   # PlaceholderPage
git cherry-pick 2887cd9   # home.queries.ts
git cherry-pick 85de41c   # new spec
```

Verify: `git log --oneline master..HEAD` shows exactly 6 commits in that order.

- [ ] **Step 3: Verify the codebase builds + tests pass**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run build
```

Expected: clean. Test count should reflect only the foundation tests (StatusBoard/FeatureTile/PlaceholderPage = ~12 tests on top of pre-Sub-#2 baseline of 81 = ~93 tests total). The deleted v1 grid tests are gone.

If tests fail because something references the deleted files (e.g., HomeView import), search and fix:

```bash
grep -rn "HomeView\|HomePage\|CommissionHero\|ActiveServiceStrip\|deriveHomeViewModel" src/ --include="*.tsx" --include="*.ts"
```

If `src/features/home/index.ts` re-exported these, update it. If `src/app/router.tsx` imported `HomePage`, leave it broken for now — Task 8 fixes routing.

- [ ] **Step 4: Force-push the reset branch**

```bash
git push --force-with-lease origin feat/pos-home-launcher
```

PR #10 auto-updates with the new history. The PR description should be updated (see Task 11).

---

## Task 1: Game Icons foundation set

**Files:**
- Create: `src/shared/pos-ui/icons/StopwatchIcon.tsx`
- Create: `src/shared/pos-ui/icons/GameCalendarIcon.tsx`
- Create: `src/shared/pos-ui/icons/TwoCoinsIcon.tsx`
- Create: `src/shared/pos-ui/icons/StrongboxIcon.tsx`
- Create: `src/shared/pos-ui/icons/index.ts`
- Create: `src/shared/pos-ui/icons/LICENSE_GAME_ICONS.md`
- Modify: `src/shared/pos-ui/index.ts`

- [ ] **Step 1: Download SVGs from game-icons.net**

Save to `src/shared/pos-ui/icons/raw/` (gitignored locally; we won't commit raw):

```bash
mkdir -p /tmp/gi-final
curl -s "https://game-icons.net/icons/000000/transparent/1x1/lorc/stopwatch.svg" -o /tmp/gi-final/stopwatch.svg
curl -s "https://game-icons.net/icons/000000/transparent/1x1/delapouite/calendar.svg" -o /tmp/gi-final/calendar.svg
curl -s "https://game-icons.net/icons/000000/transparent/1x1/delapouite/two-coins.svg" -o /tmp/gi-final/two-coins.svg
curl -s "https://game-icons.net/icons/000000/transparent/1x1/delapouite/strongbox.svg" -o /tmp/gi-final/strongbox.svg
ls -l /tmp/gi-final/
```

Each file should be 500-3700 bytes. Inspect one with `cat /tmp/gi-final/stopwatch.svg | head -5` to confirm SVG content.

- [ ] **Step 2: Create the React wrapper components**

For each icon, create a React component with `currentColor` fill. Pattern (do this for all 4):

`src/shared/pos-ui/icons/StopwatchIcon.tsx`:

```tsx
import type { SVGProps } from 'react'

export function StopwatchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" {...props}>
      <path
        fill="currentColor"
        d="M179.594 20.688v41.406h143.25V20.687h-143.25zM256.03 82C143.04 82 51.25 173.727 51.25 286.656c0 112.93 91.788 204.656 204.78 204.656 112.994 0 204.75-91.728 204.75-204.656C460.78 173.73 369.025 82 256.03 82zm0 35.625c93.42 0 169.126 75.665 169.126 169.03 0 93.368-75.706 169.564-169.125 169.564-93.417 0-169.155-76.197-169.155-169.564 0-93.366 75.736-169.03 169.156-169.03zm76.19 20.28-72.47 107.5c10.67 1.036 20.516 6.045 27.625 13.814l44.844-121.314zm-85.533 1.064v45.31c3.077-.275 6.196-.405 9.344-.405 3.155 0 6.263.13 9.345.406v-45.31h-18.688zm-88.53 36.655-13.22 13.22L177 220.874a103.591 103.591 0 0 1 13.22-13.188l-32.064-32.062zm195.75 0-32.063 32.063a103.39 103.39 0 0 1 13.187 13.187l32.064-32.03-13.188-13.22zm-98.344 81.22c-2.08.01-4.195.243-6.313.686a31.117 31.117 0 0 0-24.156 36.94c3.544 16.932 20.02 27.698 36.97 24.155a31.115 31.115 0 0 0 24.155-36.938c-3.102-14.816-16.104-24.925-30.658-24.843zM108.28 277.31V296h45.314c-.278-3.08-.406-6.192-.406-9.344 0-3.146.13-6.27.406-9.344H108.28zm250.157 0c.277 3.075.438 6.197.438 9.344 0 3.153-.16 6.264-.438 9.344h45.344V277.31H358.44zm-60.062 6.72c.993 10.522-1.968 20.742-7.813 28.937l124 19.092-116.187-48.03zM176.97 352.405l-32.032 32.03 13.218 13.22 32.063-32.03c-4.798-4-9.253-8.424-13.25-13.22zm158.093 0c-4 4.796-8.423 9.22-13.22 13.22l32.063 32.03 13.188-13.22-32.03-32.03zM246.688 389v45.313h18.687V389c-3.082.278-6.19.438-9.344.438-3.147 0-6.266-.16-9.342-.438z"
      />
    </svg>
  )
}
```

For the path data of each icon, copy from the downloaded SVG. The wrapper:
1. Imports `SVGProps` from `react`
2. Spreads props (so callers can pass `className`, `width`, `height`, `aria-label`)
3. Uses the original viewBox `0 0 512 512`
4. Sets `fill="currentColor"` on the path

Repeat for `GameCalendarIcon`, `TwoCoinsIcon`, `StrongboxIcon`. Use the path data from `/tmp/gi-final/calendar.svg`, `/tmp/gi-final/two-coins.svg`, `/tmp/gi-final/strongbox.svg` respectively.

NO docstring on each component. Names self-documenting.

- [ ] **Step 3: Create the barrel index**

`src/shared/pos-ui/icons/index.ts`:

```ts
export { StopwatchIcon } from './StopwatchIcon'
export { GameCalendarIcon } from './GameCalendarIcon'
export { TwoCoinsIcon } from './TwoCoinsIcon'
export { StrongboxIcon } from './StrongboxIcon'
```

- [ ] **Step 4: Add LICENSE attribution**

`src/shared/pos-ui/icons/LICENSE_GAME_ICONS.md`:

```markdown
# Game Icons attribution

The icons in this directory are sourced from https://game-icons.net under the
Creative Commons Attribution 3.0 Unported License (CC BY 3.0).

| Icon | Author |
|---|---|
| `StopwatchIcon` | Lorc |
| `GameCalendarIcon` | Delapouite |
| `TwoCoinsIcon` | Delapouite |
| `StrongboxIcon` | Delapouite |

License: https://creativecommons.org/licenses/by/3.0/
Source: https://game-icons.net
```

- [ ] **Step 5: Re-export from pos-ui barrel**

Open `src/shared/pos-ui/index.ts` and add (group near other primitive exports):

```ts
export * from './icons'
```

- [ ] **Step 6: Verify build**

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Expected clean. No tests for the icon wrappers — they're pass-through SVGs, content tested visually in the consumer components.

- [ ] **Step 7: Commit**

```bash
git add src/shared/pos-ui/icons/ src/shared/pos-ui/index.ts
git commit -m "feat(pos-ui): add Game Icons foundation set (Stopwatch / Calendar / TwoCoins / Strongbox)"
```

Stay on `feat/pos-home-launcher`.

---

## Task 2: Expose `locationName` from LocationProvider

**Files:**
- Modify: `src/core/location/LocationProvider.tsx`
- Modify: `src/core/location/useLocation.ts` (if separate)

- [ ] **Step 1: Inspect existing LocationProvider**

```bash
cat src/core/location/LocationProvider.tsx
cat src/core/location/useLocation.ts
```

Identify the `LocationContextValue` shape. Currently has `locationId` + `setLocationId`. We need to add `locationName: string | null`.

- [ ] **Step 2: Add `locationName` to context**

In `LocationProvider.tsx`:
- Extend `LocationContextValue` interface to include `locationName: string | null`
- When `locationId` changes (or on mount with a stored locationId), fetch the location's name from `auth.getLocations()` (already exposed) and store it in state
- Default to `null` until resolved

The fetch should be cached locally per `locationId` to avoid refetching on every render. A simple `useEffect` watching `locationId` works.

- [ ] **Step 3: Update tests**

If `LocationProvider.test.tsx` exists, add a test that verifies `locationName` resolves to the matching location's name. If no test exists, add a minimal one.

- [ ] **Step 4: Verify**

```bash
npm test -- LocationProvider
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Expected clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/location/LocationProvider.tsx src/core/location/useLocation.ts src/core/location/*.test.tsx
git commit -m "feat(location): expose resolved locationName via context"
```

Stay on `feat/pos-home-launcher`.

---

## Task 3: BottomTabNav foundation primitive (TDD)

**Files:**
- Create: `src/shared/pos-ui/BottomTabNav.tsx`
- Create: `src/shared/pos-ui/BottomTabNav.test.tsx`
- Modify: `src/shared/pos-ui/index.ts`

- [ ] **Step 1: Write the failing test**

Create `src/shared/pos-ui/BottomTabNav.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { BottomTabNav } from './BottomTabNav'
import { StopwatchIcon, GameCalendarIcon, TwoCoinsIcon, StrongboxIcon } from './icons'

const TABS = [
  { to: '/reloj', icon: StopwatchIcon, label: 'Reloj' },
  { to: '/hoy', icon: GameCalendarIcon, label: 'Hoy' },
  { to: '/mis-ventas', icon: TwoCoinsIcon, label: 'Mis ventas' },
  { to: '/caja', icon: StrongboxIcon, label: 'Caja', meta: '$2,840' },
]

describe('BottomTabNav', () => {
  it('renders all tab labels', () => {
    render(
      <MemoryRouter>
        <BottomTabNav tabs={TABS} activeTo="/hoy" />
      </MemoryRouter>,
    )
    expect(screen.getByText('Reloj')).toBeInTheDocument()
    expect(screen.getByText('Hoy')).toBeInTheDocument()
    expect(screen.getByText('Mis ventas')).toBeInTheDocument()
    expect(screen.getByText('Caja')).toBeInTheDocument()
  })

  it('renders meta line on tabs that have it', () => {
    render(
      <MemoryRouter>
        <BottomTabNav tabs={TABS} activeTo="/hoy" />
      </MemoryRouter>,
    )
    expect(screen.getByText('$2,840')).toBeInTheDocument()
  })

  it('marks the active tab with a distinguishing class', () => {
    render(
      <MemoryRouter>
        <BottomTabNav tabs={TABS} activeTo="/hoy" />
      </MemoryRouter>,
    )
    const hoyButton = screen.getByRole('button', { name: /hoy/i })
    expect(hoyButton.className).toMatch(/border-t-\[var\(--color-bravo\)\]|active/i)
  })

  it('clicking a tab navigates to its route', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/hoy']}>
        <BottomTabNav tabs={TABS} activeTo="/hoy" />
      </MemoryRouter>,
    )
    // The component uses navigate() under the hood; smoke-check that clicking doesn't throw
    await user.click(screen.getByRole('button', { name: /reloj/i }))
  })
})
```

Run: `npm test -- BottomTabNav.test`. Expected: FAIL.

- [ ] **Step 2: Implement**

Create `src/shared/pos-ui/BottomTabNav.tsx`:

```tsx
import { useNavigate } from 'react-router-dom'
import type { ComponentType, SVGProps } from 'react'
import { cn } from '@/shared/lib/cn'

export interface BottomTabNavTab {
  to: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  meta?: string
  badge?: number
}

interface BottomTabNavProps {
  tabs: BottomTabNavTab[]
  activeTo: string
  className?: string
}

export function BottomTabNav({ tabs, activeTo, className }: BottomTabNavProps) {
  const navigate = useNavigate()
  return (
    <nav
      className={cn(
        'grid grid-cols-4 border-t border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)]',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTo === tab.to
        const Icon = tab.icon
        return (
          <button
            key={tab.to}
            type="button"
            onClick={() => navigate(tab.to)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-2 py-3 transition-colors',
              'border-t-2 border-transparent cursor-pointer',
              'h-16 sm:h-20',
              isActive
                ? 'border-t-[var(--color-bravo)] bg-[var(--color-bravo)]/4 text-[var(--color-bone)]'
                : 'text-[var(--color-bone-muted)] hover:bg-white/[0.02] hover:text-[var(--color-bone)]',
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em]">
              {tab.label}
            </span>
            {tab.meta && (
              <span className="text-[10px] font-semibold text-[var(--color-success)]">
                {tab.meta}
              </span>
            )}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute right-2 top-2 bg-[var(--color-bravo)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-bone)]">
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
```

NO docstring.

Run: `npm test -- BottomTabNav.test`. Expected: 4/4 PASS.

If the active-class assertion is too strict, adapt the regex. The point is to verify the active state is visually distinct.

- [ ] **Step 3: Add to barrel**

Open `src/shared/pos-ui/index.ts` and add:

```ts
export { BottomTabNav, type BottomTabNavTab } from './BottomTabNav'
```

- [ ] **Step 4: Verify + commit**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
git add src/shared/pos-ui/BottomTabNav.tsx src/shared/pos-ui/BottomTabNav.test.tsx src/shared/pos-ui/index.ts
git commit -m "feat(pos-ui): add BottomTabNav foundation primitive"
```

Stay on `feat/pos-home-launcher`.

---

## Task 4: IdentityStripV2 (PosShell upgrade prep)

**Files:**
- Create: `src/app/IdentityStripV2.tsx`
- Create: `src/app/IdentityStripV2.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/IdentityStripV2.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { IdentityStripV2 } from './IdentityStripV2'

describe('IdentityStripV2', () => {
  it('renders brand wordmark', () => {
    render(
      <IdentityStripV2
        sucursalName="Sucursal Norte"
        isOnline
        now={new Date('2026-05-04T11:47:00')}
        staffName="Eli Cruz"
        staffPhotoUrl={null}
        onLock={() => {}}
      />,
    )
    expect(screen.getByText('BIENBRAVO')).toBeInTheDocument()
  })

  it('renders sucursal name', () => {
    render(
      <IdentityStripV2
        sucursalName="Sucursal Norte"
        isOnline
        now={new Date('2026-05-04T11:47:00')}
        staffName="Eli Cruz"
        staffPhotoUrl={null}
        onLock={() => {}}
      />,
    )
    expect(screen.getByText(/sucursal norte/i)).toBeInTheDocument()
  })

  it('renders ONLINE pill when isOnline=true', () => {
    render(
      <IdentityStripV2
        sucursalName="X"
        isOnline
        now={new Date()}
        staffName="X"
        staffPhotoUrl={null}
        onLock={() => {}}
      />,
    )
    expect(screen.getByText(/online/i)).toBeInTheDocument()
  })

  it('renders the time and date', () => {
    render(
      <IdentityStripV2
        sucursalName="X"
        isOnline
        now={new Date('2026-05-04T11:47:00')}
        staffName="X"
        staffPhotoUrl={null}
        onLock={() => {}}
      />,
    )
    expect(screen.getByText(/11:47/)).toBeInTheDocument()
  })

  it('renders staff initials when no photoUrl', () => {
    render(
      <IdentityStripV2
        sucursalName="X"
        isOnline
        now={new Date()}
        staffName="Eli Cruz"
        staffPhotoUrl={null}
        onLock={() => {}}
      />,
    )
    expect(screen.getByText('EC')).toBeInTheDocument()
  })

  it('renders staff photo when photoUrl provided', () => {
    render(
      <IdentityStripV2
        sucursalName="X"
        isOnline
        now={new Date()}
        staffName="Eli"
        staffPhotoUrl="https://example.com/eli.jpg"
        onLock={() => {}}
      />,
    )
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/eli.jpg')
  })

  it('calls onLock when lock button tapped', async () => {
    const onLock = vi.fn()
    const user = userEvent.setup()
    render(
      <IdentityStripV2
        sucursalName="X"
        isOnline
        now={new Date()}
        staffName="Eli"
        staffPhotoUrl={null}
        onLock={onLock}
      />,
    )
    await user.click(screen.getByRole('button', { name: /bloquear|lock/i }))
    expect(onLock).toHaveBeenCalledTimes(1)
  })
})
```

Run: `npm test -- IdentityStripV2.test`. Expected: FAIL.

- [ ] **Step 2: Implement**

Create `src/app/IdentityStripV2.tsx`:

```tsx
import { LockIcon } from '@/shared/pos-ui/GoogleIcon'

interface IdentityStripV2Props {
  brand?: string
  sucursalName: string
  isOnline: boolean
  now: Date
  staffName: string
  staffPhotoUrl: string | null
  onLock: () => void
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

export function IdentityStripV2({
  brand = 'BIENBRAVO',
  sucursalName,
  isOnline,
  now,
  staffName,
  staffPhotoUrl,
  onLock,
}: IdentityStripV2Props) {
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dateStr = now.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()
  const initials = getInitials(staffName)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-5 sm:h-16">
      <div className="flex items-baseline gap-3">
        <span className="font-bold tracking-[0.08em] text-[13px] text-[var(--color-bone)]">{brand}</span>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
          {sucursalName}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {isOnline && (
          <span className="hidden sm:flex items-center gap-1.5 border border-[var(--color-success)]/40 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-success)]">
            <span aria-hidden className="h-1.5 w-1.5 bg-[var(--color-success)]" />
            ONLINE
          </span>
        )}
        <div className="text-right">
          <p className="text-[14px] font-bold tabular-nums text-[var(--color-bone)] leading-none">{timeStr}</p>
          <p className="mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
            {dateStr}
          </p>
        </div>

        {staffPhotoUrl ? (
          <img
            src={staffPhotoUrl}
            alt={staffName}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-leather-muted)] bg-[var(--color-cuero-viejo)] text-[11px] font-bold text-[var(--color-bone)]">
            {initials}
          </div>
        )}

        <button
          type="button"
          onClick={onLock}
          className="flex h-9 w-9 cursor-pointer items-center justify-center text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)] hover:text-[var(--color-bone)]"
          aria-label="Bloquear sesión"
        >
          <LockIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
```

NO docstring.

Run: `npm test -- IdentityStripV2.test`. Expected: 7/7 PASS.

- [ ] **Step 3: Verify + commit**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
git add src/app/IdentityStripV2.tsx src/app/IdentityStripV2.test.tsx
git commit -m "feat(pos-shell): add IdentityStripV2 with sucursal, clock, avatar, lock"
```

Stay on `feat/pos-home-launcher`.

---

## Task 5: HoyRow component (TDD)

**Files:**
- Create: `src/features/home/presentation/HoyRow.tsx`
- Create: `src/features/home/presentation/HoyRow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/home/presentation/HoyRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { HoyRow } from './HoyRow'

const baseProps = {
  id: 'a1',
  kind: 'pending' as const,
  timeLabel: '12:30',
  customerName: 'Pedro Soto',
  customerPhotoUrl: null,
  customerInitials: 'PS',
  serviceLabel: 'Corte + barba',
  meta: null as string | null,
  pillLabel: 'Cita',
  pillTone: 'appt' as const,
  onClick: () => {},
}

describe('HoyRow', () => {
  it('renders customer name and service', () => {
    render(<HoyRow {...baseProps} />)
    expect(screen.getByText('Pedro Soto')).toBeInTheDocument()
    expect(screen.getByText(/corte \+ barba/i)).toBeInTheDocument()
  })

  it('renders time label', () => {
    render(<HoyRow {...baseProps} timeLabel="12:30" />)
    expect(screen.getByText('12:30')).toBeInTheDocument()
  })

  it('renders initials when no photo', () => {
    render(<HoyRow {...baseProps} customerPhotoUrl={null} customerInitials="PS" />)
    expect(screen.getByText('PS')).toBeInTheDocument()
  })

  it('renders photo when provided', () => {
    render(<HoyRow {...baseProps} customerPhotoUrl="https://example.com/p.jpg" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/p.jpg')
  })

  it('renders meta when provided', () => {
    render(<HoyRow {...baseProps} meta="esperando 8 min" />)
    expect(screen.getByText(/esperando 8 min/)).toBeInTheDocument()
  })

  it('does not render meta when null', () => {
    render(<HoyRow {...baseProps} meta={null} />)
    expect(screen.queryByText(/esperando/i)).not.toBeInTheDocument()
  })

  it('renders pill label', () => {
    render(<HoyRow {...baseProps} pillLabel="Walk-in" pillTone="walkin" />)
    expect(screen.getByText('Walk-in')).toBeInTheDocument()
  })

  it('calls onClick when row tapped', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<HoyRow {...baseProps} onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies active kind styling', () => {
    const { container } = render(<HoyRow {...baseProps} kind="active" timeLabel="EN SERVICIO · 12 MIN" />)
    expect(screen.getByText(/en servicio/i)).toBeInTheDocument()
    // Visual: bravo border-left expected
    expect(container.firstChild?.className).toMatch(/bravo/i)
  })

  it('applies queue kind styling (dashed avatar)', () => {
    render(<HoyRow {...baseProps} kind="queue" timeLabel="EN COLA" pillLabel="Walk-in" pillTone="walkin" />)
    expect(screen.getByText(/en cola/i)).toBeInTheDocument()
  })
})
```

Run: `npm test -- HoyRow.test`. Expected: FAIL.

- [ ] **Step 2: Implement**

Create `src/features/home/presentation/HoyRow.tsx`:

```tsx
import { cn } from '@/shared/lib/cn'

export interface HoyRowProps {
  id: string
  kind: 'active' | 'next' | 'queue' | 'pending'
  timeLabel: string
  customerName: string
  customerPhotoUrl: string | null
  customerInitials: string
  serviceLabel: string
  meta: string | null
  pillLabel: string
  pillTone: 'serving' | 'appt' | 'walkin'
  onClick: () => void
}

export function HoyRow({
  kind,
  timeLabel,
  customerName,
  customerPhotoUrl,
  customerInitials,
  serviceLabel,
  meta,
  pillLabel,
  pillTone,
  onClick,
}: HoyRowProps) {
  const isActive = kind === 'active'
  const isNext = kind === 'next'
  const isQueue = kind === 'queue'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'grid w-full cursor-pointer grid-cols-[100px_56px_1fr_auto] items-center gap-4 border-b border-[var(--color-leather-muted)]/40 px-5 py-3 text-left transition-colors hover:bg-white/[0.02]',
        isActive && 'border-l-[3px] border-l-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.06] pl-[calc(1.25rem-3px)]',
        isNext && 'border-l-[2px] border-l-[var(--color-leather)] bg-[var(--color-cuero-viejo)]/30 pl-[calc(1.25rem-2px)]',
        isQueue && 'bg-[var(--color-cuero-viejo)]/10',
      )}
    >
      <span
        className={cn(
          'tabular-nums',
          isActive
            ? 'font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]'
            : isQueue
              ? 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-leather)]'
              : 'font-mono text-[13px] font-bold tracking-[0.04em] text-[var(--color-bone-muted)]',
        )}
      >
        {timeLabel}
      </span>

      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border bg-[var(--color-cuero-viejo)] text-[14px] font-bold text-[var(--color-bone)]',
          isActive
            ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.12] text-[var(--color-bravo)]'
            : isQueue
              ? 'border border-dashed border-[var(--color-leather)] text-[var(--color-leather)]'
              : 'border-[var(--color-leather-muted)]',
        )}
      >
        {customerPhotoUrl ? (
          <img
            src={customerPhotoUrl}
            alt={customerName}
            className="h-full w-full object-cover"
          />
        ) : (
          customerInitials
        )}
      </div>

      <div className="min-w-0">
        <p className={cn('text-[16px] font-bold leading-tight text-[var(--color-bone)]', isActive && 'text-[17px]')}>
          {customerName}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-[var(--color-bone-muted)]">
          <strong className="font-semibold text-[var(--color-bone-muted)]">{serviceLabel}</strong>
          {meta && <span> · {meta}</span>}
        </p>
      </div>

      <span
        className={cn(
          'font-mono text-[9px] font-bold uppercase tracking-[0.18em] border px-2 py-1',
          pillTone === 'serving' && 'border-[var(--color-bravo)] text-[var(--color-bravo)]',
          pillTone === 'appt' && 'border-[var(--color-leather-muted)] text-[var(--color-bone-muted)]',
          pillTone === 'walkin' && 'border-[var(--color-leather)] text-[var(--color-leather)]',
        )}
      >
        {pillLabel}
      </span>
    </button>
  )
}
```

Run: `npm test -- HoyRow.test`. Expected: 10/10 PASS.

- [ ] **Step 3: Verify + commit**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
git add src/features/home/presentation/HoyRow.tsx src/features/home/presentation/HoyRow.test.tsx
git commit -m "feat(home): add HoyRow with active/next/queue/pending visual treatments"
```

Stay on `feat/pos-home-launcher`.

---

## Task 6: ContextualCTABar component (TDD)

**Files:**
- Create: `src/features/home/presentation/ContextualCTABar.tsx`
- Create: `src/features/home/presentation/ContextualCTABar.test.tsx`

- [ ] **Step 1: Failing test**

Create `src/features/home/presentation/ContextualCTABar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ContextualCTABar } from './ContextualCTABar'

describe('ContextualCTABar', () => {
  it('renders action label', () => {
    render(
      <ContextualCTABar
        actionLabel="Cobrar a Carlos Méndez"
        variant="cobrar"
        onClick={() => {}}
      />,
    )
    expect(screen.getByText('Cobrar a Carlos Méndez')).toBeInTheDocument()
  })

  it('renders meta label when provided', () => {
    render(
      <ContextualCTABar
        metaLabel="EN SERVICIO · 12 MIN"
        actionLabel="Cobrar a Carlos"
        variant="cobrar"
        onClick={() => {}}
      />,
    )
    expect(screen.getByText(/en servicio · 12 min/i)).toBeInTheDocument()
  })

  it('omits meta when not provided', () => {
    render(
      <ContextualCTABar
        actionLabel="Nueva venta"
        variant="nueva-venta"
        onClick={() => {}}
      />,
    )
    expect(screen.queryByText(/en servicio/i)).not.toBeInTheDocument()
  })

  it('calls onClick when tapped', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <ContextualCTABar
        actionLabel="Abrir caja"
        variant="abrir-caja"
        onClick={onClick}
      />,
    )
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('exposes the variant via data-variant for testing', () => {
    render(
      <ContextualCTABar
        actionLabel="Atender a Pedro"
        variant="atender"
        onClick={() => {}}
      />,
    )
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'atender')
  })
})
```

Run: FAIL.

- [ ] **Step 2: Implement**

Create `src/features/home/presentation/ContextualCTABar.tsx`:

```tsx
interface ContextualCTABarProps {
  metaLabel?: string
  actionLabel: string
  variant: 'cobrar' | 'atender' | 'abrir-caja' | 'nueva-venta'
  onClick: () => void
}

export function ContextualCTABar({
  metaLabel,
  actionLabel,
  variant,
  onClick,
}: ContextualCTABarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-variant={variant}
      className="flex w-full shrink-0 cursor-pointer items-center justify-between gap-4 bg-[var(--color-bravo)] px-5 py-4 text-left text-[var(--color-bone)] transition-colors hover:bg-[var(--color-bravo-hover)]"
    >
      <div className="flex flex-col gap-0.5">
        {metaLabel && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone)]/75">
            {metaLabel}
          </span>
        )}
        <span className="text-[18px] font-extrabold leading-tight tracking-[-0.01em]">
          {actionLabel}
        </span>
      </div>
      <span className="text-[28px] font-thin leading-none">→</span>
    </button>
  )
}
```

Note: relies on `--color-bravo-hover` token. If not defined in `src/index.css`, add it (a slightly darker shade of bravo, e.g., `#b32d24`):

```bash
grep "color-bravo-hover" src/index.css || echo "MISSING — add to :root in index.css"
```

If missing, add to `:root` in `src/index.css`:

```css
--color-bravo-hover: #b32d24;
```

Run: `npm test -- ContextualCTABar.test`. Expected: 5/5 PASS.

- [ ] **Step 3: Verify + commit**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
git add src/features/home/presentation/ContextualCTABar.tsx src/features/home/presentation/ContextualCTABar.test.tsx src/index.css
git commit -m "feat(home): add ContextualCTABar with bravo full-width action"
```

Stay on `feat/pos-home-launcher`.

---

## Task 7: deriveHoyViewModel (pure function with rich tests)

**Files:**
- Create: `src/features/home/presentation/deriveHoyViewModel.ts`
- Create: `src/features/home/presentation/deriveHoyViewModel.test.ts`

- [ ] **Step 1: Failing test**

Create `src/features/home/presentation/deriveHoyViewModel.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deriveHoyViewModel } from './deriveHoyViewModel'
import type { Appointment } from '@/features/agenda/domain/agenda.types'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository'
import type { WalkIn } from '@/features/walkins/domain/walkins.types'

const STAFF_ID = 'staff-1'
const STAFF_NAME = 'Eli Cruz'

function baseInput(overrides: Partial<Parameters<typeof deriveHoyViewModel>[0]> = {}) {
  return {
    staffId: STAFF_ID,
    staffName: STAFF_NAME,
    appointments: [] as Appointment[],
    walkIns: [] as WalkIn[],
    clockEvents: [] as TimeClockEvent[],
    commission: { amountCents: 0, serviceCount: 0, loading: false },
    caja: { isOpen: true, accumulatedCents: 0, openedAt: new Date() },
    ...overrides,
  }
}

describe('deriveHoyViewModel', () => {
  // Empty state
  it('empty day returns empty rows and Nueva venta CTA', () => {
    const vm = deriveHoyViewModel(baseInput())
    expect(vm.rows).toEqual([])
    expect(vm.cta?.variant).toBe('nueva-venta')
    expect(vm.staffName).toBe('Eli Cruz')
  })

  // Privacy filter
  it('appointment assigned to OTHER staff is excluded', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a1',
            status: 'CONFIRMED',
            staffUser: { id: 'other-staff', fullName: 'Luis' },
            customer: { id: 'c1', fullName: 'Pedro', email: null, phone: null },
            items: [{ label: 'corte', priceCents: 0, qty: 1 }],
            startAt: '2026-05-04T13:00:00Z',
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.rows).toEqual([])
  })

  it('appointment assigned to me is included', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a1',
            status: 'CONFIRMED',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c1', fullName: 'Pedro Soto', email: null, phone: null },
            items: [{ label: 'Corte + barba', priceCents: 0, qty: 1 }],
            startAt: '2026-05-04T13:00:00Z',
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.rows).toHaveLength(1)
    expect(vm.rows[0].customerName).toBe('Pedro Soto')
    expect(vm.rows[0].pillLabel).toMatch(/cita/i)
  })

  it('walk-in assigned to me is included', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        walkIns: [
          {
            id: 'w1',
            status: 'ASSIGNED',
            customerName: 'Carlos',
            assignedStaffUser: { id: STAFF_ID, fullName: 'Eli' },
            createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
          } as WalkIn,
        ],
      }),
    )
    expect(vm.rows).toHaveLength(1)
    expect(vm.rows[0].customerName).toBe('Carlos')
    expect(vm.rows[0].pillLabel).toMatch(/walk-in/i)
  })

  it('walk-in assigned to OTHER staff is excluded', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        walkIns: [
          {
            id: 'w1',
            status: 'ASSIGNED',
            customerName: 'Carlos',
            assignedStaffUser: { id: 'other', fullName: 'Luis' },
            createdAt: new Date().toISOString(),
          } as WalkIn,
        ],
      }),
    )
    expect(vm.rows).toEqual([])
  })

  it('PENDING walk-in (queue, unassigned) is included as kind=queue', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        walkIns: [
          {
            id: 'w1',
            status: 'PENDING',
            customerName: 'Juan',
            assignedStaffUser: null,
            createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
          } as WalkIn,
        ],
      }),
    )
    expect(vm.rows).toHaveLength(1)
    expect(vm.rows[0].kind).toBe('queue')
    expect(vm.rows[0].pillTone).toBe('walkin')
  })

  // Active service detection
  it('IN_SERVICE appointment for me marked as kind=active', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a1',
            status: 'IN_SERVICE',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c1', fullName: 'Carlos', email: null, phone: null },
            items: [{ label: 'corte', priceCents: 0, qty: 1 }],
            startAt: new Date(Date.now() - 12 * 60_000).toISOString(),
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.rows[0].kind).toBe('active')
    expect(vm.rows[0].timeLabel).toMatch(/en servicio.*\d+\s*min/i)
  })

  // CTA derivation
  it('CTA = abrir-caja when caja is closed (overrides everything)', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        caja: { isOpen: false, accumulatedCents: null, openedAt: null },
        appointments: [
          {
            id: 'a1',
            status: 'IN_SERVICE',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c1', fullName: 'Carlos', email: null, phone: null },
            items: [{ label: 'corte', priceCents: 0, qty: 1 }],
            startAt: new Date().toISOString(),
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.cta?.variant).toBe('abrir-caja')
    expect(vm.cta?.actionLabel).toMatch(/abrir caja/i)
  })

  it('CTA = cobrar when active service exists', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a1',
            status: 'IN_SERVICE',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c1', fullName: 'Carlos Méndez', email: null, phone: null },
            items: [{ label: 'corte', priceCents: 0, qty: 1 }],
            startAt: new Date().toISOString(),
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.cta?.variant).toBe('cobrar')
    expect(vm.cta?.actionLabel).toMatch(/carlos méndez/i)
  })

  it('CTA = atender when next appointment exists (no active)', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a1',
            status: 'CONFIRMED',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c1', fullName: 'Pedro', email: null, phone: null },
            items: [{ label: 'corte', priceCents: 0, qty: 1 }],
            startAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.cta?.variant).toBe('atender')
    expect(vm.cta?.actionLabel).toMatch(/pedro/i)
  })

  it('CTA = atender al siguiente when only queue walk-in (no mine)', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        walkIns: [
          {
            id: 'w1',
            status: 'PENDING',
            customerName: 'Juan',
            assignedStaffUser: null,
            createdAt: new Date().toISOString(),
          } as WalkIn,
        ],
      }),
    )
    expect(vm.cta?.variant).toBe('atender')
    expect(vm.cta?.actionLabel).toMatch(/juan/i)
  })

  it('CTA = nueva-venta when nothing pending', () => {
    const vm = deriveHoyViewModel(baseInput())
    expect(vm.cta?.variant).toBe('nueva-venta')
  })

  // Mixed timeline ordering
  it('rows are sorted chronologically by start time', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a-late',
            status: 'CONFIRMED',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c1', fullName: 'Late', email: null, phone: null },
            items: [{ label: 'x', priceCents: 0, qty: 1 }],
            startAt: '2026-05-04T15:00:00Z',
          } as unknown as Appointment,
          {
            id: 'a-early',
            status: 'CONFIRMED',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c2', fullName: 'Early', email: null, phone: null },
            items: [{ label: 'y', priceCents: 0, qty: 1 }],
            startAt: '2026-05-04T11:00:00Z',
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.rows[0].customerName).toBe('Early')
    expect(vm.rows[1].customerName).toBe('Late')
  })

  // Photo passthrough
  it('uses customer.photoUrl when available, computes initials when not', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a1',
            status: 'CONFIRMED',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c1', fullName: 'Pedro Soto', email: null, phone: null, photoUrl: null },
            items: [{ label: 'x', priceCents: 0, qty: 1 }],
            startAt: '2026-05-04T13:00:00Z',
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.rows[0].customerInitials).toBe('PS')
    expect(vm.rows[0].customerPhotoUrl).toBeNull()
  })
})
```

Run: FAIL (module doesn't exist).

- [ ] **Step 2: Implement**

Create `src/features/home/presentation/deriveHoyViewModel.ts`:

```ts
import type { Appointment } from '@/features/agenda/domain/agenda.types'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository'
import type { WalkIn } from '@/features/walkins/domain/walkins.types'

export interface HoyViewModelInput {
  staffId: string
  staffName: string
  appointments: Appointment[]
  walkIns: WalkIn[]
  clockEvents: TimeClockEvent[]
  commission: { amountCents: number; serviceCount: number; loading: boolean }
  caja: { isOpen: boolean; accumulatedCents: number | null; openedAt: Date | null }
}

export interface HoyRowData {
  id: string
  kind: 'active' | 'next' | 'queue' | 'pending'
  timeLabel: string
  customerName: string
  customerPhotoUrl: string | null
  customerInitials: string
  serviceLabel: string
  meta: string | null
  pillLabel: string
  pillTone: 'serving' | 'appt' | 'walkin'
  sourceKind: 'appointment' | 'walk-in'
  sourceId: string
}

export interface ContextualCTAData {
  metaLabel?: string
  actionLabel: string
  variant: 'cobrar' | 'atender' | 'abrir-caja' | 'nueva-venta'
  targetId?: string
}

export interface HoyViewModel {
  staffName: string
  commission: { amountCents: number; serviceCount: number; loading: boolean; projectedCents: number | null }
  rows: HoyRowData[]
  cta: ContextualCTAData
  cajaIsOpen: boolean
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function formatTimeMx(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
}

export function deriveHoyViewModel(input: HoyViewModelInput): HoyViewModel {
  const { staffId, staffName, appointments, walkIns, commission, caja } = input

  // Privacy filter: my appointments + my walk-ins + PENDING walk-ins (queue)
  const myAppts = appointments.filter((a) => a.staffUser?.id === staffId)
  const myWalkIns = walkIns.filter((w) => w.assignedStaffUser?.id === staffId)
  const queueWalkIns = walkIns.filter(
    (w) => w.status === 'PENDING' && (w.assignedStaffUser === null || w.assignedStaffUser === undefined),
  )

  // Build rows
  type Candidate = { row: HoyRowData; sortKey: string; isActive: boolean; isNext: boolean }
  const candidates: Candidate[] = []

  for (const a of myAppts) {
    const customer = (a.customer ?? null) as { fullName?: string; photoUrl?: string | null } | null
    const customerName = customer?.fullName ?? 'Cliente'
    const photo = customer?.photoUrl ?? null
    const isInService = a.status === 'IN_SERVICE'
    const isPending = a.status === 'CONFIRMED' || a.status === 'CHECKED_IN'
    const startAt = a.startAt
    const minutes = isInService ? minutesSince(startAt) : 0
    const timeLabel = isInService ? `EN SERVICIO · ${minutes} MIN` : formatTimeMx(startAt)

    candidates.push({
      row: {
        id: `appt-${a.id}`,
        kind: isInService ? 'active' : 'pending',
        timeLabel,
        customerName,
        customerPhotoUrl: photo,
        customerInitials: getInitials(customerName),
        serviceLabel: a.items[0]?.label ?? 'Servicio',
        meta: isInService ? `cita ${formatTimeMx(startAt)}` : null,
        pillLabel: 'Cita',
        pillTone: isInService ? 'serving' : 'appt',
        sourceKind: 'appointment',
        sourceId: a.id,
      },
      sortKey: startAt,
      isActive: isInService,
      isNext: isPending,
    })
  }

  for (const w of myWalkIns) {
    const customer = w.customer ?? null
    const customerName = customer?.fullName ?? w.customerName ?? 'Walk-in'
    const photo = null // WalkIn customer doesn't have photoUrl in the type; future enhancement
    const isAssigned = w.status === 'ASSIGNED'
    const minutes = minutesSince(w.createdAt)
    const timeLabel = isAssigned ? `EN SERVICIO · ${minutes} MIN` : formatTimeMx(w.createdAt)

    candidates.push({
      row: {
        id: `walk-${w.id}`,
        kind: isAssigned ? 'active' : 'pending',
        timeLabel,
        customerName,
        customerPhotoUrl: photo,
        customerInitials: getInitials(customerName),
        serviceLabel: 'Walk-in',
        meta: isAssigned ? null : null,
        pillLabel: 'Walk-in',
        pillTone: isAssigned ? 'serving' : 'walkin',
        sourceKind: 'walk-in',
        sourceId: w.id,
      },
      sortKey: w.createdAt,
      isActive: isAssigned,
      isNext: !isAssigned,
    })
  }

  for (const w of queueWalkIns) {
    const customer = w.customer ?? null
    const customerName = customer?.fullName ?? w.customerName ?? 'Walk-in'
    const minutes = minutesSince(w.createdAt)

    candidates.push({
      row: {
        id: `queue-${w.id}`,
        kind: 'queue',
        timeLabel: 'EN COLA',
        customerName,
        customerPhotoUrl: null,
        customerInitials: getInitials(customerName),
        serviceLabel: 'Walk-in',
        meta: `esperando ${minutes} min · sin asignar`,
        pillLabel: 'Walk-in',
        pillTone: 'walkin',
        sourceKind: 'walk-in',
        sourceId: w.id,
      },
      sortKey: w.createdAt,
      isActive: false,
      isNext: false,
    })
  }

  // Sort chronologically (active first regardless of time, queue grouped after my pending)
  candidates.sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  // Mark "next" — the earliest non-active pending of mine
  let nextSet = false
  for (const c of candidates) {
    if (c.isActive) continue
    if (c.row.kind === 'queue') continue
    if (!nextSet && c.isNext) {
      c.row.kind = 'next'
      c.row.meta = c.row.meta ? `siguiente · ${c.row.meta}` : 'siguiente'
      nextSet = true
    }
  }

  const rows = candidates.map((c) => c.row)

  // CTA derivation
  let cta: ContextualCTAData
  if (!caja.isOpen) {
    cta = { variant: 'abrir-caja', actionLabel: 'Abrir caja' }
  } else {
    const active = candidates.find((c) => c.isActive)
    const nextMine = candidates.find((c) => c.row.kind === 'next')
    const queueHead = candidates.find((c) => c.row.kind === 'queue')

    if (active) {
      const minutes = minutesSince(active.sortKey)
      cta = {
        variant: 'cobrar',
        metaLabel: `EN SERVICIO · ${minutes} MIN`,
        actionLabel: `Cobrar a ${active.row.customerName}`,
        targetId: active.row.sourceId,
      }
    } else if (nextMine) {
      cta = {
        variant: 'atender',
        metaLabel: nextMine.row.kind === 'next' ? `CITA ${formatTimeMx(nextMine.sortKey)}` : undefined,
        actionLabel: `Atender a ${nextMine.row.customerName}`,
        targetId: nextMine.row.sourceId,
      }
    } else if (queueHead) {
      cta = {
        variant: 'atender',
        metaLabel: 'WALK-IN EN COLA',
        actionLabel: `Atender al siguiente: ${queueHead.row.customerName}`,
        targetId: queueHead.row.sourceId,
      }
    } else {
      cta = { variant: 'nueva-venta', actionLabel: 'Nueva venta' }
    }
  }

  // Commission projection (simple: hide for now)
  const projectedCents = null

  return {
    staffName,
    commission: {
      amountCents: commission.amountCents,
      serviceCount: commission.serviceCount,
      loading: commission.loading,
      projectedCents,
    },
    rows,
    cta,
    cajaIsOpen: caja.isOpen,
  }
}
```

Run: `npm test -- deriveHoyViewModel.test`. Expected: 14/14 PASS.

If a test about WalkIn `customerPhotoUrl` fails (the `WalkIn` type doesn't have that field — we hardcoded `null` for walk-in photos), that's expected behavior for v1.

- [ ] **Step 3: Verify + commit**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
git add src/features/home/presentation/deriveHoyViewModel.ts src/features/home/presentation/deriveHoyViewModel.test.ts
git commit -m "feat(home): pure deriveHoyViewModel with privacy filter + CTA derivation"
```

Stay on `feat/pos-home-launcher`.

---

## Task 8: HoyView (presentational, integrates everything)

**Files:**
- Create: `src/features/home/presentation/HoyView.tsx`
- Create: `src/features/home/presentation/HoyView.test.tsx`

- [ ] **Step 1: Failing test**

Create `src/features/home/presentation/HoyView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { HoyView } from './HoyView'
import type { HoyViewModel } from './deriveHoyViewModel'

function makeVm(overrides: Partial<HoyViewModel> = {}): HoyViewModel {
  return {
    staffName: 'Eli Cruz',
    commission: { amountCents: 84500, serviceCount: 5, loading: false, projectedCents: null },
    rows: [],
    cta: { variant: 'nueva-venta', actionLabel: 'Nueva venta' },
    cajaIsOpen: true,
    ...overrides,
  }
}

describe('HoyView', () => {
  it('renders greeting with first name', () => {
    render(
      <MemoryRouter>
        <HoyView vm={makeVm({ staffName: 'Eli Cruz García' })} onCtaClick={() => {}} onRowClick={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/eli/i)).toBeInTheDocument()
  })

  it('renders commission amount', () => {
    render(
      <MemoryRouter>
        <HoyView vm={makeVm()} onCtaClick={() => {}} onRowClick={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText('$845')).toBeInTheDocument()
  })

  it('renders empty list message when rows is empty', () => {
    render(
      <MemoryRouter>
        <HoyView vm={makeVm({ rows: [] })} onCtaClick={() => {}} onRowClick={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/todavía no tienes movimiento|sin actividad/i)).toBeInTheDocument()
  })

  it('renders rows when provided', () => {
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({
            rows: [
              {
                id: 'r1',
                kind: 'pending',
                timeLabel: '12:30',
                customerName: 'Pedro Soto',
                customerPhotoUrl: null,
                customerInitials: 'PS',
                serviceLabel: 'Corte + barba',
                meta: null,
                pillLabel: 'Cita',
                pillTone: 'appt',
                sourceKind: 'appointment',
                sourceId: 'a1',
              },
            ],
          })}
          onCtaClick={() => {}}
          onRowClick={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Pedro Soto')).toBeInTheDocument()
  })

  it('renders the CTA button', () => {
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({ cta: { variant: 'cobrar', actionLabel: 'Cobrar a Carlos' } })}
          onCtaClick={() => {}}
          onRowClick={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Cobrar a Carlos')).toBeInTheDocument()
  })

  it('positive copy on commission $0 (no depressing zero)', () => {
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({ commission: { amountCents: 0, serviceCount: 0, loading: false, projectedCents: null } })}
          onCtaClick={() => {}}
          onRowClick={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/empezamos el día|empezando|0 servicios/i)).toBeInTheDocument()
  })
})
```

Run: FAIL.

- [ ] **Step 2: Implement**

Create `src/features/home/presentation/HoyView.tsx`:

```tsx
import { formatMoney } from '@/shared/lib/money'
import { HoyRow } from './HoyRow'
import { ContextualCTABar } from './ContextualCTABar'
import type { HoyViewModel } from './deriveHoyViewModel'

interface HoyViewProps {
  vm: HoyViewModel
  onCtaClick: () => void
  onRowClick: (rowId: string) => void
}

function pluralizeServicios(n: number): string {
  return n === 1 ? '1 servicio' : `${n} servicios`
}

function commissionCaption(amountCents: number, serviceCount: number): string {
  if (amountCents === 0 && serviceCount === 0) {
    return '0 servicios · empezamos el día'
  }
  return pluralizeServicios(serviceCount)
}

export function HoyView({ vm, onCtaClick, onRowClick }: HoyViewProps) {
  const firstName = vm.staffName.split(' ')[0] ?? vm.staffName

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-3 pb-2">
        <p className="text-[13px] text-[var(--color-bone-muted)]">
          Hola, <strong className="font-bold text-[var(--color-bone)]">{firstName}</strong>.
        </p>
      </div>

      <div className="flex items-baseline gap-4 border-b border-[var(--color-leather-muted)]/40 px-5 pb-3">
        <span className="font-display text-[38px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[var(--color-bone)]">
          {vm.commission.loading ? '—' : formatMoney(vm.commission.amountCents)}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
            COMISIONES HOY
          </span>
          <span className="text-[11px] text-[var(--color-bone-muted)]">
            {commissionCaption(vm.commission.amountCents, vm.commission.serviceCount)}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {vm.rows.length === 0 ? (
          <div className="flex h-full items-center justify-center px-5 py-12 text-center">
            <p className="text-[13px] text-[var(--color-bone-muted)]">
              Hoy todavía no tienes movimiento
            </p>
          </div>
        ) : (
          vm.rows.map((row) => (
            <HoyRow
              key={row.id}
              {...row}
              onClick={() => onRowClick(row.id)}
            />
          ))
        )}
      </div>

      <ContextualCTABar
        metaLabel={vm.cta.metaLabel}
        actionLabel={vm.cta.actionLabel}
        variant={vm.cta.variant}
        onClick={onCtaClick}
      />
    </div>
  )
}
```

Run: `npm test -- HoyView.test`. Expected: 6/6 PASS.

- [ ] **Step 3: Verify + commit**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
git add src/features/home/presentation/HoyView.tsx src/features/home/presentation/HoyView.test.tsx
git commit -m "feat(home): add HoyView (presentational over HoyViewModel)"
```

Stay on `feat/pos-home-launcher`.

---

## Task 9: HoyPage orchestrator (TDD)

**Files:**
- Create: `src/features/home/presentation/HoyPage.tsx`
- Create: `src/features/home/presentation/HoyPage.test.tsx`

- [ ] **Step 1: Failing test**

Create `src/features/home/presentation/HoyPage.test.tsx`:

```tsx
import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HoyPage } from './HoyPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

describe('HoyPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('renders the greeting after data load', async () => {
    renderWithProviders(<HoyPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/hola/i)).toBeInTheDocument()
  })

  it('renders the contextual CTA', async () => {
    renderWithProviders(<HoyPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    // Empty day, caja open → "Nueva venta" fallback
    expect(await screen.findByRole('button', { name: /nueva venta|abrir caja/i })).toBeInTheDocument()
  })

  it('refetches on window focus', async () => {
    const repos = createMockRepositories()
    const getAppointments = vi.fn().mockResolvedValue([])
    repos.agenda.getAppointments = getAppointments
    renderWithProviders(<HoyPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await waitFor(() => expect(getAppointments).toHaveBeenCalled())
    const initial = getAppointments.mock.calls.length
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(getAppointments.mock.calls.length).toBeGreaterThan(initial))
  })
})
```

Run: FAIL.

- [ ] **Step 2: Implement**

Create `src/features/home/presentation/HoyPage.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { useNavigate } from 'react-router-dom'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { useLocation } from '@/core/location/useLocation'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { POS_HOME_COMMISSION, POS_HOME_CAJA_STATUS } from '../data/home.queries'
import { deriveHoyViewModel, type HoyViewModel } from './deriveHoyViewModel'
import { HoyView } from './HoyView'
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

export function HoyPage() {
  const apollo = useApolloClient()
  const { viewer } = usePosAuth()
  const { locationId } = useLocation()
  const { agenda, clock, walkins } = useRepositories()
  const navigate = useNavigate()

  const [vm, setVm] = useState<HoyViewModel | null>(null)

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

    const appts: Appointment[] = settled[0].status === 'fulfilled' ? settled[0].value : []
    const events: TimeClockEvent[] = settled[1].status === 'fulfilled' ? settled[1].value : []
    const wkins: WalkIn[] = settled[2].status === 'fulfilled' ? settled[2].value : []
    const commissionRes = settled[3].status === 'fulfilled' ? settled[3].value.data : null
    const cajaRes = settled[4].status === 'fulfilled' ? settled[4].value.data?.posCajaStatusHome : null

    // Approximate service count (same logic as previous version)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const serviceCount =
      appts.filter((a) => a.status === 'COMPLETED' && a.staffUser?.id === viewer.staff.id && new Date(a.startAt) >= todayStart).length +
      wkins.filter((w) => w.status === 'DONE' && w.assignedStaffUser?.id === viewer.staff.id && new Date(w.createdAt) >= todayStart).length

    setVm(
      deriveHoyViewModel({
        staffId: viewer.staff.id,
        staffName: viewer.staff.fullName,
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

  useEffect(() => {
    if (!viewer || !locationId) return
    void refetch()
  }, [viewer, locationId, refetch])

  useEffect(() => {
    const onFocus = () => { void refetch() }
    window.addEventListener('focus', onFocus)
    return () => { window.removeEventListener('focus', onFocus) }
  }, [refetch])

  const handleCtaClick = useCallback(() => {
    if (!vm) return
    switch (vm.cta.variant) {
      case 'abrir-caja':
        navigate('/caja') // sub-#3 placeholder; existing /register page until then
        break
      case 'cobrar':
      case 'atender':
      case 'nueva-venta':
        navigate('/checkout')
        break
    }
  }, [vm, navigate])

  const handleRowClick = useCallback((rowId: string) => {
    // Tap a row to override "next" — for now, just go to checkout
    // (Future: select that row's customer as the cart's first line)
    navigate('/checkout')
  }, [navigate])

  if (!vm) return null

  return <HoyView vm={vm} onCtaClick={handleCtaClick} onRowClick={handleRowClick} />
}
```

Run: `npm test -- HoyPage.test`. Expected: 3/3 PASS.

- [ ] **Step 3: Verify + commit**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
git add src/features/home/presentation/HoyPage.tsx src/features/home/presentation/HoyPage.test.tsx
git commit -m "feat(home): add HoyPage orchestrator with focus refetch + CTA navigation"
```

Stay on `feat/pos-home-launcher`.

---

## Task 10: PosShell upgrade + router rewiring

**Files:**
- Modify: `src/app/PosShell.tsx`
- Modify: `src/app/router.tsx`

- [ ] **Step 1: Rewrite PosShell**

Replace `src/app/PosShell.tsx` content:

```tsx
import { useState, useEffect } from 'react'
import { Navigate, Outlet, useLocation as useRouterLocation } from 'react-router-dom'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { useLocation } from '@/core/location/useLocation'
import {
  StopwatchIcon,
  GameCalendarIcon,
  TwoCoinsIcon,
  StrongboxIcon,
} from '@/shared/pos-ui/icons'
import { BottomTabNav } from '@/shared/pos-ui'
import { IdentityStripV2 } from './IdentityStripV2'

function useLiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function PosShell() {
  const { viewer, lock, isLocked, loading } = usePosAuth()
  const { locationId, locationName } = useLocation()
  const now = useLiveClock()
  const routerLoc = useRouterLocation()

  if (loading) return null
  if (!viewer || isLocked) return <Navigate to="/" replace />

  // Active tab: derive from current pathname
  const path = routerLoc.pathname
  let activeTo = '/hoy'
  if (path.startsWith('/reloj') || path.startsWith('/clock')) activeTo = '/reloj'
  else if (path.startsWith('/mis-ventas') || path.startsWith('/my-day')) activeTo = '/mis-ventas'
  else if (path.startsWith('/caja') || path.startsWith('/register')) activeTo = '/caja'
  else if (path.startsWith('/hoy') || path.startsWith('/home')) activeTo = '/hoy'

  const tabs = [
    { to: '/reloj', icon: StopwatchIcon, label: 'Reloj' },
    { to: '/hoy', icon: GameCalendarIcon, label: 'Hoy' },
    { to: '/mis-ventas', icon: TwoCoinsIcon, label: 'Mis ventas' },
    { to: '/caja', icon: StrongboxIcon, label: 'Caja' },
  ]

  return (
    <div className="flex h-full flex-col">
      <IdentityStripV2
        sucursalName={locationName ?? 'Sucursal'}
        isOnline
        now={now}
        staffName={viewer.staff.fullName}
        staffPhotoUrl={viewer.staff.photoUrl ?? null}
        onLock={lock}
      />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <BottomTabNav tabs={tabs} activeTo={activeTo} />
    </div>
  )
}
```

The active-tab logic supports both new (`/hoy`) and legacy (`/home`) paths so navigation works during the transition.

- [ ] **Step 2: Rewrite router**

Edit `src/app/router.tsx`. Add `HoyPage` import and the new `/hoy` route + redirect aliases:

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom'
// ...existing imports...
import { HoyPage } from '@/features/home/index.ts'  // re-export from index, see step 3
// (HomePage import is REMOVED)

export const router = createBrowserRouter([
  { path: '/', element: <LockPage /> },
  {
    element: <PosShell />,
    children: [
      { path: '/hoy', element: <HoyPage /> },
      { path: '/home', element: <Navigate to="/hoy" replace /> },
      { path: '/checkout', element: <CheckoutPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/caja', element: <Navigate to="/register" replace /> },
      { path: '/clock', element: <ClockPage /> },
      { path: '/reloj', element: <Navigate to="/clock" replace /> },
      { path: '/agenda', element: <AgendaPage /> },
      { path: '/walkins', element: <WalkInsPage /> },
      { path: '/my-day', element: <MyDayPage /> },
      { path: '/mis-ventas', element: <Navigate to="/my-day" replace /> },
    ],
  },
  { path: '/dev/hello-pos', element: <HelloPosPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
])
```

Note: redirects keep current implementations (RegisterPage, ClockPage, MyDayPage) reachable under their original paths; the user-facing tab path `/caja` redirects to `/register` etc. Sub-#3 / #9 will swap the destinations to v2 implementations.

If post-login navigation in LockPage routes to `/home`, update it to `/hoy`. Search:

```bash
grep -rn "navigate('/home'" src/
```

Update each hit to `'/hoy'`.

- [ ] **Step 3: Update home feature index barrel**

Open `src/features/home/index.ts`. Replace the export from `HomePage` with `HoyPage`:

```ts
export { HoyPage } from './presentation/HoyPage'
```

If anywhere else in the codebase imports `HomePage`, fix:

```bash
grep -rn "HomePage" src/
```

Should be only in router.tsx (which we're updating) and the home/index.ts (which we're updating).

- [ ] **Step 4: Delete the v1 grid components**

```bash
rm src/features/home/presentation/HomeView.tsx
rm src/features/home/presentation/HomeView.test.tsx
rm src/features/home/presentation/HomePage.tsx
rm src/features/home/presentation/HomePage.test.tsx
rm src/features/home/presentation/CommissionHero.tsx
rm src/features/home/presentation/CommissionHero.test.tsx
rm src/features/home/presentation/ActiveServiceStrip.tsx
rm src/features/home/presentation/ActiveServiceStrip.test.tsx
rm src/features/home/presentation/deriveHomeViewModel.ts
rm src/features/home/presentation/deriveHomeViewModel.test.ts
```

(After Task 0 reset, these files don't exist — they were dropped along with the v1 commits. So this step might be a no-op. Verify with `ls src/features/home/presentation/` first.)

- [ ] **Step 5: Verify**

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run build
```

Expected: clean. All tests pass.

If `LockPage` test fails because it expects navigation to `/home`, update the test to expect `/hoy`.

- [ ] **Step 6: Commit**

```bash
git add src/app/PosShell.tsx src/app/router.tsx src/features/home/index.ts
# add deletes if not already staged
git commit -m "refactor(pos-shell): wire IdentityStripV2 + BottomTabNav + /hoy route + redirects"
```

Stay on `feat/pos-home-launcher`.

---

## Task 11: Final verification + PR description update

**Files:** none

- [ ] **Step 1: Full gate**

```bash
cd /Users/insightcollective/Documents/Code/BienBravo/bienbravo-pos
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run build
```

Expected: lint clean (or pre-existing only), tsc clean, all tests pass, build clean.

Test count expectation: foundation primitives ~12 + new components ~25-30 = ~40 over baseline 81 = ~120 total.

- [ ] **Step 2: Manual smoke at iPad landscape (1180×820 in DevTools)**

```bash
npm run dev
```

Walk through:
1. Login via PIN → lands on `/hoy` (not `/home`)
2. Identity strip shows brand + sucursal name (real, from `useLocation`) + clock + your avatar + lock button
3. Greeting "Hola, <FirstName>." renders
4. Commission hero renders ($X · COMISIONES HOY · pluralized count)
5. List renders with mock data — at least the empty state
6. Contextual CTA renders at bottom (likely "Nueva venta" or "Abrir caja")
7. Bottom-tab nav: Reloj · Hoy (active) · Mis ventas · Caja
8. Tap each tab → navigates correctly. Hoy stays active when on `/hoy`. Caja → /register (the v1). Reloj → /clock. Mis ventas → /my-day.
9. Open admin and create an active walk-in for current barber → return to Hoy → ActiveServiceStrip data appears as kind=active with bravo treatment, CTA changes to "Cobrar a <name>".
10. Force-close API → reload Hoy → graceful fallback (rows might be empty, CTA falls to "Nueva venta", no crash).

Fix any regressions in a separate commit and re-verify.

- [ ] **Step 3: Update PR description**

```bash
gh pr edit 10 --body "$(cat <<'EOF'
## Summary

Sub-project #2 of the POS rework — Home as queue-list (D direction).

After smoke-testing the v1 grid-launcher direction and finding it felt cheap and didn't match how a barbero actually works, this PR pivots to a queue-list view: greeting + commission row + chronological list of citas+walk-ins (with active service highlighted and shared queue distinct) + contextual CTA bar (Cobrar/Atender/Abrir caja/Nueva venta) + bottom-tab navigation (Reloj · Hoy · Mis ventas · Caja).

Privacy: each barbero sees only their own citas + walk-ins assigned to them + the shared walk-in queue. No manager-only sections in POS — managers go to admin web app for analytics/reports.

## Cross-repo

API PR #11 (\`posCajaStatusHome\`) already merged to bienbravo-api main as \`75d3df5\`. No further API work needed.

## What changed (vs v1 attempt)

**Kept (foundation, untouched)**:
- \`<StatusBoard>\`, \`<FeatureTile>\`, \`<PlaceholderPage>\` foundation primitives (now available for sub-#3+ to consume)
- \`POS_HOME_COMMISSION\` + \`POS_HOME_CAJA_STATUS\` queries
- Schema sync

**New (D direction)**:
- 4 Game Icons React wrappers: \`StopwatchIcon\`, \`GameCalendarIcon\`, \`TwoCoinsIcon\`, \`StrongboxIcon\` (CC BY 3.0, attribution in \`src/shared/pos-ui/icons/LICENSE_GAME_ICONS.md\`)
- \`<BottomTabNav>\` foundation primitive
- \`<IdentityStripV2>\` PosShell upgrade
- \`<HoyRow>\`, \`<ContextualCTABar>\`, \`<HoyView>\`, \`<HoyPage>\`, \`deriveHoyViewModel\` Hoy-specific components
- \`useLocation()\` exposes \`locationName\`
- Routing: \`/hoy\` is the new home, redirects from \`/home\`. Tab paths \`/reloj\`, \`/mis-ventas\`, \`/caja\` redirect to existing v1 pages until sub-#3/9 redesign

**Deleted (v1 grid)**:
- \`HomeView\`, \`HomePage\`, \`CommissionHero\`, \`ActiveServiceStrip\`, \`deriveHomeViewModel\`

## Verification

- \`npx tsc --noEmit -p tsconfig.app.json\` — clean
- \`npx vitest run\` — ~120 tests pass
- \`npm run build\` — clean

## Test plan

- [ ] Manual smoke at iPad landscape (1180×820):
  1. Post-PIN lands on \`/hoy\`
  2. Identity strip + greeting + commission + list + CTA + tabs all render
  3. Tap each tab navigates correctly
  4. Active walk-in created in admin → ActiveServiceStrip appears with bravo, CTA = Cobrar
  5. Caja closed → CTA = Abrir caja (overrides everything)
  6. Network failure → graceful fallback, no crash
- [ ] Privacy: no other barbero's citas/sales appear in current barbero's Hoy
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Push branch**

```bash
git push origin feat/pos-home-launcher
```

(Not force-push at this point — branch was already force-pushed in Task 0; subsequent commits are normal.)

---

## Verification (per task)

Each task ships a passing commit before the next runs. Per task:
- [ ] `npm run lint` — 0 errors related to changed files
- [ ] `npx tsc --noEmit -p tsconfig.app.json` — clean
- [ ] `npm test` — all tests pass (existing + new)
- [ ] `npm run build` — clean

After Task 11:
- [ ] Manual smoke through 10 scenarios at iPad landscape
- [ ] PR description updated
- [ ] No regression in Sub-#1 lock screen / Sub-#0 foundation primitives

---

## Notes

- 11 task commits, 1 verification (no commit). Total 11 new commits on top of the 6 foundation/spec commits surviving Task 0.
- Force-push happens once in Task 0; subsequent pushes are normal.
- The 3 unused foundation primitives (StatusBoard / FeatureTile / PlaceholderPage) are not wasted — they'll be consumed by sub-#3 (Caja status header), sub-#6 (Walk-ins tile), etc.
- "Va para ~$1,400 al cierre" projection from the spec is left as `null` in the viewmodel for v1; HoyView shows just `serviceCount`. Future iteration adds projection logic.
- Photos for customers come from `customer.photoUrl` (existing API field on Customer type). If null, fallback to initials. WalkIns currently don't have customer photos in the type; v1 always shows initials for walk-ins.
- Per `feedback_pos_users` memory: bias to simplicity. The pivot embraces this — single primary view (queue), single primary action (CTA), familiar bottom-tab nav.
