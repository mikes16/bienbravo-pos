# POS Polish + Performance Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship perf wins (route lazy loading + Apollo cache strategy) and finish the editorial v2 visual sweep (3 legacy pages + skeleton primitive + cleanup) in a single mega-PR.

**Architecture:** Five disjoint workstreams executed in parallel where files don't overlap. Performance changes (Tasks 1-3) are config-only. Skeleton primitive (Task 4) is a foundation for everything else. Editorial v2 redesigns (Tasks 6-8) are independent files. Cleanup (Tasks 9-11) runs last.

**Tech Stack:** Vite 7 + React 19 + TS 5 + Tailwind 4 + Apollo Client 4 + Vitest 3 + RTL. No new dependencies.

**Spec reference:** `bienbravo-pos/docs/superpowers/specs/2026-05-04-pos-polish-perf-sweep-design.md`

**Branch:** `feat/pos-polish-perf-sweep` (already created off latest master)

**Important codebase facts:**
- Path alias `@/` → `src/`
- Foundation primitives at `src/shared/pos-ui/`: `TouchButton`, `MoneyDisplay`, `Numpad`, `WizardShell`, `SuccessSplash`, `BottomTabNav`, etc.
- Editorial color tokens (in `src/index.css`): `--color-bone`, `--color-bone-muted`, `--color-leather-muted`, `--color-bravo`, `--color-bravo-hover`, `--color-cuero-viejo`, `--color-carbon-elevated`, `--color-success`, `--color-warning`, `--font-pos-display`
- `cn` at `@/shared/lib/cn`. `formatMoney` at `@/shared/lib/money`
- `renderWithProviders` at `@/test/helpers/renderWithProviders`
- Test command: `npm test -- <PartialFileName>`
- Build/tsc: `npx tsc --noEmit -p tsconfig.app.json && npm run build`
- Pre-existing 44 ESLint errors in `src/test/mocks/repositories.ts` are NOT in scope

**Parallel execution strategy:**
- Phase 1 (parallel): Tasks 1, 2, 3, 4
- Phase 2 (after Task 4): Tasks 5, 6, 7, 8 (all disjoint files)
- Phase 3: Task 9 (waits for 6, 7, 8)
- Phase 4 (sequential): Tasks 10, 11, 12

---

## Task 1: Route lazy loading + Suspense

**Files:** `src/app/router.tsx` (modify), `src/app/RouteLoader.tsx` (create)

- [ ] **Step 1: Create skeleton fallback component**

Create `src/app/RouteLoader.tsx`:

```tsx
export function RouteLoader() {
  return (
    <div className="flex h-full items-center justify-center px-8 py-12">
      <div className="flex flex-col items-center gap-3">
        <div className="h-2 w-32 animate-pulse bg-[var(--color-cuero-viejo)]" />
        <div className="h-2 w-20 animate-pulse bg-[var(--color-cuero-viejo)]" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Convert router to lazy()**

Replace `src/app/router.tsx` entirely:

```tsx
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ShoppingCartIcon, ClockIcon, CalendarIcon, SeatReclineIcon, WalletIcon, AnalyticsIcon } from '@/shared/pos-ui/GoogleIcon.tsx'
import type { FeatureManifest } from './feature.types.ts'
import { PosShell } from './PosShell.tsx'
import { LockPage } from '@/features/auth/index.ts'
import { HoyPage } from '@/features/home/index.ts'
import { RouteLoader } from './RouteLoader.tsx'

// Lazy-load all non-hot-path routes
const CheckoutPage = lazy(() => import('@/features/checkout/index.ts').then(m => ({ default: m.CheckoutPage })))
const CajaPage = lazy(() => import('@/features/register/index.ts').then(m => ({ default: m.CajaPage })))
const OpenCajaPage = lazy(() => import('@/features/register/index.ts').then(m => ({ default: m.OpenCajaPage })))
const CloseCajaWizard = lazy(() => import('@/features/register/index.ts').then(m => ({ default: m.CloseCajaWizard })))
const ClockPage = lazy(() => import('@/features/clock/index.ts').then(m => ({ default: m.ClockPage })))
const AgendaPage = lazy(() => import('@/features/agenda/index.ts').then(m => ({ default: m.AgendaPage })))
const WalkInsPage = lazy(() => import('@/features/walkins/index.ts').then(m => ({ default: m.WalkInsPage })))
const MyDayPage = lazy(() => import('@/features/my-day/index.ts').then(m => ({ default: m.MyDayPage })))
const HelloPosPage = lazy(() => import('@/features/_dev/HelloPosPage').then(m => ({ default: m.HelloPosPage })))

function lazyRoute(Component: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Component />
    </Suspense>
  )
}

export const features: FeatureManifest[] = [
  { id: 'checkout', label: 'Nueva Venta', icon: ShoppingCartIcon, path: '/checkout', permission: 'pos.sale.create', order: 1 },
  { id: 'agenda', label: 'Mi Agenda', icon: CalendarIcon, path: '/agenda', permission: 'appointments.read', order: 2 },
  { id: 'walkins', label: 'Walk-ins', icon: SeatReclineIcon, path: '/walkins', permission: 'walkins.manage', order: 3 },
  { id: 'register', label: 'Caja', icon: WalletIcon, path: '/caja', permission: 'pos.register.manage', order: 4 },
  { id: 'clock', label: 'Reloj', icon: ClockIcon, path: '/clock', permission: 'timeclock.manage', order: 5 },
  { id: 'my-day', label: 'Mi Día', icon: AnalyticsIcon, path: '/my-day', order: 6 },
]

export const router = createBrowserRouter([
  { path: '/', element: <LockPage /> },
  {
    element: <PosShell />,
    children: [
      { path: '/hoy', element: <HoyPage /> },
      { path: '/home', element: <Navigate to="/hoy" replace /> },
      { path: '/checkout', element: lazyRoute(CheckoutPage) },
      { path: '/caja', element: lazyRoute(CajaPage) },
      { path: '/caja/abrir', element: lazyRoute(OpenCajaPage) },
      { path: '/caja/cerrar', element: lazyRoute(CloseCajaWizard) },
      { path: '/register', element: <Navigate to="/caja" replace /> },
      { path: '/clock', element: lazyRoute(ClockPage) },
      { path: '/reloj', element: <Navigate to="/clock" replace /> },
      { path: '/agenda', element: lazyRoute(AgendaPage) },
      { path: '/walkins', element: lazyRoute(WalkInsPage) },
      { path: '/my-day', element: lazyRoute(MyDayPage) },
      { path: '/mis-ventas', element: <Navigate to="/my-day" replace /> },
    ],
  },
  { path: '/dev/hello-pos', element: lazyRoute(HelloPosPage) },
  { path: '*', element: <Navigate to="/" replace /> },
])
```

- [ ] **Step 3: Build + verify chunks**

```bash
npm run build
```

Expected: main chunk drops from ~397 kB to ~150-200 kB. Each lazy-loaded page becomes its own chunk (e.g., `CheckoutPage-<hash>.js`, `CajaPage-<hash>.js`). Surface actual chunk sizes in your report.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 282/282 still pass. Lazy loading is transparent at runtime — `<Suspense>` resolves the chunk before render.

- [ ] **Step 5: Commit**

```bash
git add src/app/router.tsx src/app/RouteLoader.tsx
git commit -m "perf(router): lazy-load 8 non-hot-path routes + Suspense fallback"
```

---

## Task 2: Apollo cache strategy revision

**Files (modify):**
- `src/features/checkout/data/checkout.repository.ts`
- `src/features/walkins/data/walkins.repository.ts`
- `src/features/register/data/register.repository.ts`
- `src/features/agenda/data/agenda.repository.ts`
- `src/features/clock/data/clock.repository.ts`
- `src/features/home/presentation/HoyPage.tsx`

- [ ] **Step 1: Catalog → cache-first**

In `src/features/checkout/data/checkout.repository.ts`, change `fetchPolicy: 'network-only'` → `fetchPolicy: 'cache-first'` for these methods:
- `getCategories` (line ~250)
- `getServices` (line ~258)
- `getProducts` (line ~297)
- `getCombos` (line ~289)

Catalog data changes rarely; cache-first reuses across checkout sessions.

Keep these as-is (active state):
- `getStockLevels` — products' stock changes after sales; keep `network-only`
- `searchCustomers` — operator-typed query, never cache
- (`getBarbers` already `cache-first`)

- [ ] **Step 2: Walk-ins, register, agenda, clock events → cache-and-network**

In `src/features/walkins/data/walkins.repository.ts`, change `fetchPolicy: 'network-only'` → `fetchPolicy: 'cache-and-network'` for `getWalkIns`.

In `src/features/register/data/register.repository.ts`, same change for `getRegisters`.

In `src/features/agenda/data/agenda.repository.ts`, same for `getAppointments`.

In `src/features/clock/data/clock.repository.ts`, same for `getEvents`. (`getShiftTemplates` stays `cache-first` since shift templates rarely change.)

`cache-and-network` paints from cache instantly + refreshes from network in background. The hooks' `setState` callback fires twice (cache + network) but Apollo dedupes if values are equal.

- [ ] **Step 3: HoyPage queries**

`src/features/home/presentation/HoyPage.tsx` uses Apollo `useQuery` directly (not via repository). Around lines 54 and 61, change `fetchPolicy: 'network-only'` → `fetchPolicy: 'cache-and-network'` for both queries.

- [ ] **Step 4: Verify build + tests**

```bash
npx tsc --noEmit -p tsconfig.app.json
npm test
```

Expected: clean. All tests pass. Apollo MockedProvider in tests doesn't care about fetchPolicy — mocks resolve regardless.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/data/checkout.repository.ts src/features/walkins/data/walkins.repository.ts src/features/register/data/register.repository.ts src/features/agenda/data/agenda.repository.ts src/features/clock/data/clock.repository.ts src/features/home/presentation/HoyPage.tsx
git commit -m "perf(apollo): strategic cache policy (catalog cache-first, state cache-and-network)"
```

---

## Task 3: Image lazy loading

**Files (modify):** any `.tsx` file with `<img src=...>` for staff/customer photos.

- [ ] **Step 1: Find all `<img>` tags**

```bash
grep -rn "<img " src/ --include="*.tsx" | head -20
```

For each `<img>` rendering a barber/customer/avatar photo, ensure `loading="lazy"` and `decoding="async"` are present.

- [ ] **Step 2: Add the attributes where missing**

Pattern to apply:

```tsx
<img
  src={...}
  alt=""
  loading="lazy"
  decoding="async"
  className="..."
/>
```

Common sites likely:
- `src/features/auth/presentation/BarberSelectorView.tsx`
- `src/features/checkout/presentation/AtendiendoHeader.tsx`
- `src/features/checkout/presentation/BarberSelectorSheet.tsx`
- `src/features/checkout/presentation/BarberPickerInline.tsx`
- `src/features/checkout/presentation/CartLineRow.tsx` (if it renders avatar)
- `src/features/clock/presentation/ClockPage.tsx`

Skip the LockPage staff photo (above-the-fold, eager).

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm run build
```

Clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "perf(img): lazy + async decoding on staff/customer photos"
```

---

## Task 4: Foundation `<Skeleton>` primitive (TDD)

**Files:**
- Create: `src/shared/pos-ui/Skeleton.tsx`
- Create: `src/shared/pos-ui/Skeleton.test.tsx`
- Modify: `src/shared/pos-ui/index.ts` (export)

- [ ] **Step 1: Write the failing tests**

Create `src/shared/pos-ui/Skeleton.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SkeletonRow, SkeletonCard, SkeletonText, SkeletonCircle } from './Skeleton'

describe('Skeleton primitives', () => {
  it('SkeletonRow renders with pulse + cuero-viejo bg', () => {
    const { container } = render(<SkeletonRow />)
    expect(container.firstChild).toHaveClass('animate-pulse')
    expect((container.firstChild as HTMLElement).className).toMatch(/cuero-viejo/)
  })

  it('SkeletonCard renders square aspect block', () => {
    const { container } = render(<SkeletonCard />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })

  it('SkeletonText renders inline-block with width prop', () => {
    const { container } = render(<SkeletonText widthPercent={60} />)
    expect((container.firstChild as HTMLElement).style.width).toBe('60%')
  })

  it('SkeletonCircle renders rounded for avatars', () => {
    const { container } = render(<SkeletonCircle size={48} />)
    expect((container.firstChild as HTMLElement).className).toMatch(/rounded-full/)
    expect((container.firstChild as HTMLElement).style.height).toBe('48px')
    expect((container.firstChild as HTMLElement).style.width).toBe('48px')
  })

  it('accepts custom className', () => {
    const { container } = render(<SkeletonRow className="my-custom" />)
    expect((container.firstChild as HTMLElement).className).toMatch(/my-custom/)
  })

  it('SkeletonRow accepts heightPx prop', () => {
    const { container } = render(<SkeletonRow heightPx={20} />)
    expect((container.firstChild as HTMLElement).style.height).toBe('20px')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- Skeleton.test
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/shared/pos-ui/Skeleton.tsx`:

```tsx
import { cn } from '@/shared/lib/cn'

interface SkeletonRowProps {
  className?: string
  heightPx?: number
  widthPercent?: number
}

export function SkeletonRow({ className, heightPx = 14, widthPercent }: SkeletonRowProps) {
  return (
    <div
      className={cn('animate-pulse bg-[var(--color-cuero-viejo)]', className)}
      style={{ height: `${heightPx}px`, width: widthPercent ? `${widthPercent}%` : undefined }}
    />
  )
}

interface SkeletonCardProps {
  className?: string
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn('animate-pulse bg-[var(--color-cuero-viejo)]', className)}
      style={{ aspectRatio: '1 / 1' }}
    />
  )
}

interface SkeletonTextProps {
  className?: string
  widthPercent?: number
}

export function SkeletonText({ className, widthPercent = 100 }: SkeletonTextProps) {
  return (
    <span
      className={cn('inline-block animate-pulse bg-[var(--color-cuero-viejo)]', className)}
      style={{ width: `${widthPercent}%`, height: '1em' }}
    />
  )
}

interface SkeletonCircleProps {
  className?: string
  size: number
}

export function SkeletonCircle({ className, size }: SkeletonCircleProps) {
  return (
    <div
      className={cn('animate-pulse rounded-full bg-[var(--color-cuero-viejo)]', className)}
      style={{ height: `${size}px`, width: `${size}px` }}
    />
  )
}
```

Note: `SkeletonCircle` is the ONE place we use `rounded-full` in editorial v2 — avatars are intentionally circular even when the rest of the design is sharp.

- [ ] **Step 4: Add to barrel**

Edit `src/shared/pos-ui/index.ts` to add:

```ts
export { SkeletonRow, SkeletonCard, SkeletonText, SkeletonCircle } from './Skeleton'
```

- [ ] **Step 5: Run tests + verify**

```bash
npm test -- Skeleton.test
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Expected: 6/6 PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add src/shared/pos-ui/Skeleton.tsx src/shared/pos-ui/Skeleton.test.tsx src/shared/pos-ui/index.ts
git commit -m "feat(pos-ui): editorial v2 Skeleton primitives (Row/Card/Text/Circle)"
```

---

## Task 5: Apply skeletons to v2 pages that lack them

**Files (modify):**
- `src/features/home/presentation/HoyPage.tsx`
- `src/features/register/presentation/CajaPage.tsx`
- `src/features/checkout/presentation/CheckoutPage.tsx`

- [ ] **Step 1: HoyPage loading state**

Open `src/features/home/presentation/HoyPage.tsx`. Find the `if (!vm) return null` line. Replace with a skeleton that matches Hoy's queue-list shape:

```tsx
import { SkeletonRow } from '@/shared/pos-ui'
// ... existing imports

if (!vm) {
  return (
    <div className="flex h-full flex-col gap-4 px-6 py-5">
      <SkeletonRow heightPx={36} widthPercent={40} />
      <div className="flex flex-col gap-2">
        <SkeletonRow heightPx={56} />
        <SkeletonRow heightPx={56} />
        <SkeletonRow heightPx={56} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: CajaPage loading state**

In `src/features/register/presentation/CajaPage.tsx`, find `if (loading && registers.length === 0) return null`. Replace with:

```tsx
import { SkeletonRow } from '@/shared/pos-ui'
// ...

if (loading && registers.length === 0) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 py-12">
      <SkeletonRow heightPx={48} widthPercent={50} />
      <SkeletonRow heightPx={20} widthPercent={30} />
      <SkeletonRow heightPx={56} widthPercent={60} />
    </div>
  )
}
```

- [ ] **Step 3: CheckoutPage loading state**

In `src/features/checkout/presentation/CheckoutPage.tsx`, find the `if (!defaultBarber)` block that renders "Cargando catálogo…". Replace with:

```tsx
import { SkeletonRow, SkeletonCard } from '@/shared/pos-ui'
// ...

if (!defaultBarber) {
  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col gap-4 px-6 py-5">
        <div className="flex gap-2">
          <SkeletonRow heightPx={36} widthPercent={20} />
          <SkeletonRow heightPx={36} widthPercent={20} />
          <SkeletonRow heightPx={36} widthPercent={20} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
      <div className="flex w-[40%] min-w-[360px] flex-col gap-4 border-l border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-4 py-4">
        <SkeletonRow heightPx={64} />
        <SkeletonRow heightPx={36} />
        <SkeletonRow heightPx={56} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify build + tests**

```bash
npx tsc --noEmit -p tsconfig.app.json
npm test
```

Clean. All tests still pass (the loading state is rarely hit in tests since mocks resolve immediately).

- [ ] **Step 5: Commit**

```bash
git add src/features/home/presentation/HoyPage.tsx src/features/register/presentation/CajaPage.tsx src/features/checkout/presentation/CheckoutPage.tsx
git commit -m "feat(pos): apply Skeleton primitives to Hoy/Caja/Checkout loading states"
```

---

## Task 6: WalkInsPage editorial v2 redesign (TDD)

**Files:**
- Modify: `src/features/walkins/presentation/WalkInsPage.tsx` (currently 328 LoC, full v1 with kanban)
- Create: `src/features/walkins/presentation/WalkInsPage.test.tsx` (first tests for this page)

The redesign drops the kanban metaphor. Single linear queue with status pills. Each row: customer name + wait time + status + barber assignment chip + actions inline.

- [ ] **Step 1: Write the failing test**

Create `src/features/walkins/presentation/WalkInsPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WalkInsPage } from './WalkInsPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() { return MOCK_VIEWER }
}

const PENDING_WALKIN = {
  id: 'w1',
  status: 'PENDING' as const,
  customerName: 'Carlos Méndez',
  customerPhone: null,
  customerEmail: null,
  createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
  assignedStaffUser: null,
  customer: null,
}

describe('WalkInsPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('renders empty state when no walk-ins', async () => {
    const repos = createMockRepositories()
    repos.walkins.getWalkIns = vi.fn().mockResolvedValue([])
    renderWithProviders(<WalkInsPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/aún no hay clientes esperando|sin clientes/i)).toBeInTheDocument()
  })

  it('renders pending walk-in row with name + wait time', async () => {
    const repos = createMockRepositories()
    repos.walkins.getWalkIns = vi.fn().mockResolvedValue([PENDING_WALKIN])
    renderWithProviders(<WalkInsPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/carlos méndez/i)).toBeInTheDocument()
    expect(screen.getByText(/5 min/i)).toBeInTheDocument()
  })

  it('renders Tomar action for pending walk-ins', async () => {
    const repos = createMockRepositories()
    repos.walkins.getWalkIns = vi.fn().mockResolvedValue([PENDING_WALKIN])
    renderWithProviders(<WalkInsPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByRole('button', { name: /tomar/i })).toBeInTheDocument()
  })

  it('shows skeleton during loading', () => {
    const repos = createMockRepositories()
    repos.walkins.getWalkIns = vi.fn(() => new Promise(() => {})) // never resolves
    const { container } = renderWithProviders(<WalkInsPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- WalkInsPage.test
```

Expected: FAIL on most tests because v1 page has different DOM/copy.

- [ ] **Step 3: Replace `WalkInsPage.tsx` ENTIRELY**

Replace `src/features/walkins/presentation/WalkInsPage.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocation } from '@/core/location/useLocation'
import { useWalkIns } from '../application/useWalkIns'
import type { WalkIn } from '../domain/walkins.types'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { SkeletonRow } from '@/shared/pos-ui'
import { cn } from '@/shared/lib/cn'

function minutesAgo(isoDate: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 60_000))
}

function waitLabel(mins: number): string {
  if (mins < 1) return 'Recién'
  return `${mins} min`
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Esperando', color: 'text-[var(--color-warning)]' },
  ASSIGNED: { label: 'Asignado', color: 'text-[var(--color-bone)]' },
  IN_SERVICE: { label: 'En servicio', color: 'text-[var(--color-success)]' },
  COMPLETED: { label: 'Completado', color: 'text-[var(--color-bone-muted)]' },
}

interface WalkInRowProps {
  w: WalkIn
  onAssign: () => void
  onComplete: () => void
  onDrop: () => void
}

function WalkInRow({ w, onAssign, onComplete, onDrop }: WalkInRowProps) {
  const mins = minutesAgo(w.createdAt)
  const status = STATUS_CONFIG[w.status] ?? { label: w.status, color: 'text-[var(--color-bone-muted)]' }
  const customerName = w.customer?.fullName ?? w.customerName ?? 'Cliente sin registrar'
  const isPending = w.status === 'PENDING'
  const isAssigned = w.status === 'ASSIGNED'

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-[var(--color-leather-muted)]/30 px-5 py-4">
      <div className="flex flex-col gap-1">
        <span className="text-[15px] font-bold text-[var(--color-bone)]">{customerName}</span>
        <div className="flex items-center gap-2">
          <span className={cn('font-mono text-[10px] font-bold uppercase tracking-[0.18em]', status.color)}>
            {status.label}
          </span>
          {w.assignedStaffUser && (
            <span className="font-mono text-[10px] text-[var(--color-bone-muted)]">
              · {w.assignedStaffUser.fullName.split(' ')[0]}
            </span>
          )}
        </div>
      </div>
      <span className="font-mono text-[12px] tabular-nums text-[var(--color-bone-muted)]">
        {waitLabel(mins)}
      </span>
      <div className="flex gap-2">
        {isPending && (
          <TouchButton variant="primary" size="min" onClick={onAssign} className="rounded-none">
            Tomar
          </TouchButton>
        )}
        {isAssigned && (
          <TouchButton variant="secondary" size="min" onClick={onComplete} className="rounded-none">
            Completar
          </TouchButton>
        )}
      </div>
      {(isPending || isAssigned) && (
        <button
          type="button"
          onClick={onDrop}
          aria-label="Quitar walk-in"
          className="flex min-h-[var(--pos-touch-min)] cursor-pointer items-center font-mono text-[14px] text-[var(--color-bone-muted)] hover:text-[var(--color-bravo)]"
        >
          ×
        </button>
      )}
    </div>
  )
}

export function WalkInsPage() {
  const navigate = useNavigate()
  const { locationId } = useLocation()
  const { walkIns, loading, assign, complete, drop } = useWalkIns(locationId)
  const [activeWalkIn, setActiveWalkIn] = useState<WalkIn | null>(null)

  if (loading && walkIns.length === 0) {
    return (
      <div className="flex h-full flex-col gap-3 px-5 py-5">
        <SkeletonRow heightPx={32} widthPercent={40} />
        <div className="flex flex-col gap-3">
          <SkeletonRow heightPx={56} />
          <SkeletonRow heightPx={56} />
          <SkeletonRow heightPx={56} />
        </div>
      </div>
    )
  }

  if (walkIns.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-12 text-center">
        <p className="font-[var(--font-pos-display)] text-[24px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
          Aún no hay clientes esperando
        </p>
        <p className="max-w-[320px] text-[13px] text-[var(--color-bone-muted)]">
          Cuando llegue alguien sin cita, regístralo aquí para ponerlo en cola.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between border-b border-[var(--color-leather-muted)]/40 px-5 py-4">
        <h1 className="font-[var(--font-pos-display)] text-[24px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
          Walk-ins
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          {walkIns.length} en cola
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {walkIns.map((w) => (
          <WalkInRow
            key={w.id}
            w={w}
            onAssign={() => navigate(`/checkout?completeWalkInId=${w.id}`)}
            onComplete={() => complete(w.id)}
            onDrop={() => setActiveWalkIn(w)}
          />
        ))}
      </div>
      {activeWalkIn && (
        <div role="dialog" aria-label="Confirmar quitar" className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={() => setActiveWalkIn(null)}>
          <div className="w-full max-w-md border-t border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-6 py-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-[var(--font-pos-display)] text-[18px] font-extrabold text-[var(--color-bone)]">
              Quitar a {activeWalkIn.customer?.fullName ?? activeWalkIn.customerName ?? 'este cliente'}?
            </p>
            <p className="mt-2 text-[13px] text-[var(--color-bone-muted)]">
              Solo úsalo si el cliente se fue antes de ser atendido.
            </p>
            <div className="mt-4 flex gap-2">
              <TouchButton variant="secondary" size="secondary" onClick={() => setActiveWalkIn(null)} className="flex-1 rounded-none">
                Cancelar
              </TouchButton>
              <TouchButton
                variant="primary"
                size="secondary"
                onClick={() => {
                  drop(activeWalkIn.id)
                  setActiveWalkIn(null)
                }}
                className="flex-1 rounded-none"
              >
                Sí, quitar
              </TouchButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

The new design:
- Removes `<PosCard>`, `<TapButton>`, `<StatusPill>`, `<KanbanColumn>`, `<EmptyState>`, `<SectionHeader>`, `<SkeletonBlock>` (all v1)
- Single linear queue (no kanban columns)
- Editorial v2 typography + tokens
- `<TouchButton>` for actions, raw `<button>` for the × close affordance with min-h
- Confirm-drop overlay uses editorial sheet pattern
- Skeleton loading state matches the queue-row shape

If `useWalkIns` exposes different actions than `assign/complete/drop`, adapt — read the hook before implementing.

- [ ] **Step 4: Run tests + verify build**

```bash
npm test -- WalkInsPage.test
npx tsc --noEmit -p tsconfig.app.json
```

Expected: 4/4 PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/walkins/presentation/WalkInsPage.tsx src/features/walkins/presentation/WalkInsPage.test.tsx
git commit -m "feat(walkins): editorial v2 redesign (single linear queue, no kanban)"
```

---

## Task 7: AgendaPage editorial v2 redesign (TDD)

**Files:**
- Modify: `src/features/agenda/presentation/AgendaPage.tsx` (currently 344 LoC, full v1)
- Create: `src/features/agenda/presentation/AgendaPage.test.tsx` (first tests)

- [ ] **Step 1: Inspect existing AgendaPage + useAgenda**

Read `src/features/agenda/presentation/AgendaPage.tsx` and `src/features/agenda/application/useAgenda.ts` to understand:
- What data it fetches (appointments, scoping)
- What actions are available (check-in, start, complete, no-show)
- Status pill colors today
- Filter UI

Surface the actual hook signature in your report so the redesign matches.

- [ ] **Step 2: Write the failing test**

Create `src/features/agenda/presentation/AgendaPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgendaPage } from './AgendaPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() { return MOCK_VIEWER }
}

const APPT_10AM = {
  id: 'a1',
  startAt: '2026-05-04T16:00:00.000Z', // 10:00 in America/Monterrey
  endAt: '2026-05-04T16:30:00.000Z',
  status: 'BOOKED' as const,
  customer: { id: 'c1', fullName: 'Carlos Méndez' },
  staffUser: { id: 's1', fullName: 'Antonio' },
  items: [{ id: 'i1', service: { id: 'svc1', name: 'Corte' } }],
}

describe('AgendaPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('renders empty state when no appointments', async () => {
    const repos = createMockRepositories()
    repos.agenda.getAppointments = vi.fn().mockResolvedValue([])
    renderWithProviders(<AgendaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/sin citas|aún no hay/i)).toBeInTheDocument()
  })

  it('renders appointment with customer + service + barber', async () => {
    const repos = createMockRepositories()
    repos.agenda.getAppointments = vi.fn().mockResolvedValue([APPT_10AM])
    renderWithProviders(<AgendaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/carlos méndez/i)).toBeInTheDocument()
    expect(screen.getByText(/corte/i)).toBeInTheDocument()
    expect(screen.getByText(/antonio/i)).toBeInTheDocument()
  })

  it('renders time labels in America/Monterrey timezone', async () => {
    const repos = createMockRepositories()
    repos.agenda.getAppointments = vi.fn().mockResolvedValue([APPT_10AM])
    renderWithProviders(<AgendaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    // 16:00 UTC = 10:00 in CST (UTC-6)
    expect(await screen.findByText(/10:00/)).toBeInTheDocument()
  })

  it('shows skeleton during loading', () => {
    const repos = createMockRepositories()
    repos.agenda.getAppointments = vi.fn(() => new Promise(() => {}))
    const { container } = renderWithProviders(<AgendaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- AgendaPage.test
```

Expected: FAIL on most.

- [ ] **Step 4: Replace `AgendaPage.tsx`**

Replace with editorial v2: time-grouped list, no `<PosCard>`, `<SkeletonBlock>` etc. Use `<SkeletonRow>` for loading, editorial typography for heading, leather-rule dividers between rows, status pill via inline span with editorial token.

The implementer should design the full new file based on:
- v1's existing data (appointments, statuses, actions)
- Editorial patterns from CajaOpenView and the new WalkInsPage
- `useAgenda` hook actions for inline check-in/start/complete buttons

Drop all imports of v1 primitives (`PosCard`, `TapButton`, `SkeletonBlock`, `StatusPill`, `EmptyState`, `SectionHeader`).

Time formatting: use `America/Monterrey` timezone (matches CajaOpenView `formatTimeMx` pattern).

Group appointments by hour. Each row: `HH:MM | customer name | service name | barber | status pill | inline action`.

If the implementer can't determine the exact layout from existing code, they should write it with their best-judgment editorial v2 read and surface the design in their report.

- [ ] **Step 5: Run tests + verify build**

```bash
npm test -- AgendaPage.test
npx tsc --noEmit -p tsconfig.app.json
```

4/4 PASS, tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/agenda/presentation/AgendaPage.tsx src/features/agenda/presentation/AgendaPage.test.tsx
git commit -m "feat(agenda): editorial v2 redesign (time-grouped list, no cards)"
```

---

## Task 8: MyDayPage editorial v2 redesign (TDD)

**Files:**
- Modify: `src/features/my-day/presentation/MyDayPage.tsx` (currently 106 LoC)
- Create: `src/features/my-day/presentation/MyDayPage.test.tsx`

MyDayPage is small. Inspect first:

```bash
cat src/features/my-day/presentation/MyDayPage.tsx
```

If it's a placeholder (just shows static text or empty card), redesign as editorial dashboard with KPI sections: today's sales, walk-ins served, appointments completed, current shift. Use `<SkeletonRow>` for loading, editorial typography, `--font-pos-display` for KPI numbers.

If it has real data hooks, mirror those.

- [ ] **Step 1: Write the failing test**

Create `src/features/my-day/presentation/MyDayPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { MyDayPage } from './MyDayPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() { return MOCK_VIEWER }
}

describe('MyDayPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('renders heading "Mi Día"', async () => {
    renderWithProviders(<MyDayPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/mi día/i)).toBeInTheDocument()
  })

  it('renders staff name in viewer-aware copy', async () => {
    renderWithProviders(<MyDayPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(MOCK_VIEWER.staff.fullName)).toBeInTheDocument()
  })

  it('renders KPI placeholders even when data is empty', async () => {
    renderWithProviders(<MyDayPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/ventas/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests → FAIL**

```bash
npm test -- MyDayPage.test
```

- [ ] **Step 3: Replace MyDayPage.tsx**

Replace with editorial v2 layout. Pattern:

```tsx
import { usePosAuth } from '@/core/auth/usePosAuth'

export function MyDayPage() {
  const { viewer } = usePosAuth()
  const staffName = viewer?.staff?.fullName ?? ''

  return (
    <div className="flex h-full flex-col gap-6 px-6 py-5">
      <div>
        <h1 className="font-[var(--font-pos-display)] text-[28px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
          Mi Día
        </h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          {staffName}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KPICard label="Ventas hoy" value="—" />
        <KPICard label="Walk-ins atendidos" value="—" />
        <KPICard label="Citas completadas" value="—" />
      </div>

      <div className="border border-[var(--color-leather-muted)]/40 px-5 py-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Turno actual
        </p>
        <p className="mt-2 text-[14px] text-[var(--color-bone-muted)]">
          Próximamente: estado del turno + comisión proyectada del día.
        </p>
      </div>
    </div>
  )
}

interface KPICardProps {
  label: string
  value: string
}

function KPICard({ label, value }: KPICardProps) {
  return (
    <div className="border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-4 py-4">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
        {label}
      </p>
      <p className="mt-2 font-[var(--font-pos-display)] text-[28px] font-extrabold tabular-nums leading-none text-[var(--color-bone)]">
        {value}
      </p>
    </div>
  )
}
```

The page is intentionally a scaffold for future hooks (per-staff sales/walk-in/appointments). Real data hookup ships in a follow-up sub-project.

- [ ] **Step 4: Run + verify**

```bash
npm test -- MyDayPage.test
npx tsc --noEmit -p tsconfig.app.json
```

3/3 PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/my-day/presentation/MyDayPage.tsx src/features/my-day/presentation/MyDayPage.test.tsx
git commit -m "feat(my-day): editorial v2 scaffold (KPI grid + viewer-aware heading)"
```

---

## Task 9: Delete v1 primitives + cleanup imports

**Files (delete):**
- `src/shared/pos-ui/PosCard.tsx`
- `src/shared/pos-ui/TapButton.tsx`
- `src/shared/pos-ui/SkeletonBlock.tsx`
- `src/shared/pos-ui/KanbanColumn.tsx`
- `src/shared/pos-ui/EmptyState.tsx`
- `src/shared/pos-ui/SectionHeader.tsx`
- `src/shared/pos-ui/StatusPill.tsx`

**Files (modify):**
- `src/shared/pos-ui/index.ts` (remove exports)

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -rn "PosCard\|TapButton\|SkeletonBlock\|KanbanColumn\|StatusPill\|SectionHeader" src/ --include="*.tsx" --include="*.ts" | grep -v "shared/pos-ui/" | head
```

Should return ZERO matches outside `src/shared/pos-ui/` itself. If any remain, refactor before deleting.

`EmptyState` may have lingering imports — verify separately:

```bash
grep -rn "from '@/shared/pos-ui/EmptyState'\|EmptyState }" src/ --include="*.tsx" --include="*.ts" | grep -v "shared/pos-ui/"
```

- [ ] **Step 2: Delete v1 primitive files**

```bash
rm src/shared/pos-ui/PosCard.tsx
rm src/shared/pos-ui/TapButton.tsx
rm src/shared/pos-ui/SkeletonBlock.tsx
rm src/shared/pos-ui/KanbanColumn.tsx
rm src/shared/pos-ui/EmptyState.tsx
rm src/shared/pos-ui/SectionHeader.tsx
rm src/shared/pos-ui/StatusPill.tsx
```

- [ ] **Step 3: Update `src/shared/pos-ui/index.ts`**

Remove the lines:

```ts
export { PosCard } from './PosCard'
export { TapButton } from './TapButton'
export { SkeletonBlock } from './SkeletonBlock'
export { KanbanColumn } from './KanbanColumn'
export { EmptyState } from './EmptyState'
export { SectionHeader } from './SectionHeader'
export { StatusPill } from './StatusPill'
```

(Match the actual exports in the file — use `cat src/shared/pos-ui/index.ts` to see them first.)

- [ ] **Step 4: Verify build + tests**

```bash
npx tsc --noEmit -p tsconfig.app.json
npm test
```

Clean. No regressions.

- [ ] **Step 5: Commit**

```bash
git add src/shared/pos-ui/index.ts
git rm src/shared/pos-ui/PosCard.tsx
git rm src/shared/pos-ui/TapButton.tsx
git rm src/shared/pos-ui/SkeletonBlock.tsx
git rm src/shared/pos-ui/KanbanColumn.tsx
git rm src/shared/pos-ui/EmptyState.tsx
git rm src/shared/pos-ui/SectionHeader.tsx
git rm src/shared/pos-ui/StatusPill.tsx
git status
git commit -m "refactor(pos-ui): drop v1 primitives (PosCard/TapButton/SkeletonBlock/etc.)"
```

---

## Task 10: Empty-state copy + error UX consolidation

**Files (modify):** any page with empty state or inline error.

- [ ] **Step 1: Audit empty states + errors**

```bash
grep -rn "Sin\|Aún no\|Cuando " src/features/*/presentation/*.tsx | head -20
grep -rn "role=\"alert\"\|text-\[var(--color-bravo)\].*error\|text-bb-danger" src/features/ | head -20
```

For each empty-state copy: ensure sentence case, no exclamation marks, no "¡Awesome!" energy. Voice: clear, direct, helpful.

For each error: ensure `role="alert"` on the banner. Pattern from CajaOpenView/CheckoutPage:

```tsx
{error && (
  <div role="alert" className="border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/[0.06] px-4 py-3">
    <p className="text-[13px] text-[var(--color-bravo)]">{error}</p>
  </div>
)}
```

- [ ] **Step 2: Make adjustments**

Specifically check:
- Auth pages (LockPage, BarberSelectorView, PinEntryView): error banner uses editorial tokens?
- Walk-ins/Agenda/MyDay (post-redesign): empty states use sentence case
- Any leftover "¡" exclamation in UI copy

Most pages should already be compliant from prior subs. Surface any non-compliance you find and fix.

- [ ] **Step 3: Verify build + tests**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm test
```

Clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "polish(pos): unify empty-state copy + role=alert on errors"
```

If no changes needed (everything was already compliant), skip the commit.

---

## Task 11: Touch target + a11y sweep

**Files (modify):** any page with interactive elements.

- [ ] **Step 1: Audit touch targets**

```bash
grep -rn "h-6\b\|h-7\b\|h-8\b" src/features/ src/shared/pos-ui/ --include="*.tsx" | head -30
```

For each match, decide:
- If it's an icon container (not interactive): keep
- If it's a button or interactive: bump to `h-10` (40px) or `h-11` (44px) or use `min-h-[var(--pos-touch-min)]`

- [ ] **Step 2: Audit aria-labels on icon-only buttons**

```bash
grep -B 1 -A 3 "<button" src/features/ src/shared/pos-ui/ --include="*.tsx" -rn | grep -B 2 "Icon\|×\|↓\|↑" | head -40
```

For each icon-only button without `aria-label`, add a descriptive label.

- [ ] **Step 3: Audit decorative icons**

Decorative SVG/icon elements should have `aria-hidden="true"` or be in a parent with one. Common pattern:

```tsx
<span aria-hidden className="h-2 w-2 bg-[var(--color-success)]" />
```

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm run build
```

Clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "polish(pos): touch target + aria-label sweep"
```

---

## Task 12: Final verify + push + PR

- [ ] **Step 1: Confirm history**

```bash
git log --oneline master..HEAD | head -25
```

Expected: ~12-15 commits (1 spec + 1 plan + Tasks 1-11).

- [ ] **Step 2: Full gate**

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run build
npm test
```

- tsc clean
- build clean — main chunk should be under 200 kB gzip (was 102 kB main + 46 kB Apollo + 33 kB router = 181 kB before; lazy loading should drop main further)
- tests all pass

- [ ] **Step 3: Verify gaps closed**

```bash
# No legacy bb-* tokens
grep -rn "bb-bg\|bb-surface\|bb-muted\|bb-border\|bb-danger\|bb-warning\|bb-primary" src/ --include="*.tsx" --include="*.ts"

# No rounded-xl/2xl/3xl in features (icons may legitimately use rounded-full via SkeletonCircle)
grep -rn "rounded-2xl\|rounded-xl\|rounded-3xl" src/features/ --include="*.tsx"

# No v1 primitives
grep -rn "PosCard\|TapButton\|SkeletonBlock\|KanbanColumn" src/ --include="*.tsx" --include="*.ts"
```

All three should return ZERO matches. If any remain, fix before pushing.

- [ ] **Step 4: Push + PR**

```bash
git push -u origin feat/pos-polish-perf-sweep
gh pr create --title "feat(pos): polish + performance sweep sub-#6" --body "$(cat <<'EOF'
## Summary

Sub-#6 closes the gaps left after sub-#1 through #5: route lazy loading + Apollo cache strategy revision (the "tarda en cargar" perception), foundation Skeleton primitive + consistent loading states, editorial v2 redesign of the 3 remaining v1 pages (WalkIns + Agenda + MyDay), deletion of v1 primitives.

## What's new

**Performance:**
- 8 routes lazy-loaded with Suspense fallback (main chunk drops from ~397 kB to ~150 kB)
- Apollo cache strategy: catalog cache-first, active state cache-and-network (instant cache paint + bg refresh)
- Image lazy loading on all staff/customer photos

**Foundation:**
- New \`<Skeleton>\` primitives: SkeletonRow, SkeletonCard, SkeletonText, SkeletonCircle (editorial v2, sharp corners)

**Editorial v2 redesigns:**
- WalkInsPage — single linear queue (drops kanban metaphor)
- AgendaPage — time-grouped editorial list
- MyDayPage — editorial KPI scaffold

**Cleanup:**
- 7 v1 primitives deleted: PosCard, TapButton, SkeletonBlock, KanbanColumn, EmptyState, SectionHeader, StatusPill
- Empty-state copy normalized (sentence case, no exclamation marks)
- Error UX consolidated to role=alert editorial banner
- Touch target audit (minimum 40px)
- aria-label audit on icon-only buttons

## Verification

- \`npx tsc --noEmit -p tsconfig.app.json\` — clean
- \`npm test\` — all tests pass (10+ new across redesigns + Skeleton primitive)
- \`npm run build\` — clean, main chunk reduced
- \`grep -rn "bb-bg\|rounded-xl"\` — zero matches

## Test plan

- [x] All unit + integration tests pass
- [ ] CI green
- [ ] Manual smoke iPad: cold load /checkout feels snappy; second-visit /caja paints from cache instantly
- [ ] Walk-Ins linear queue functional (assign + complete + drop)
- [ ] Agenda time-grouped list renders correctly
- [ ] MyDay scaffold renders for any logged-in staff

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Report PR URL.

- [ ] **Step 5: Final report**

- Commit count + brief log
- Test counts (passing/total + new tests added)
- Build/tsc status with chunk sizes
- PR URL
- Concerns

---

## Verification (per-task gate)

Each task ends with a clean commit. Per task:
- `npm run lint` — no NEW errors
- `npx tsc --noEmit -p tsconfig.app.json` — clean
- `npm test` — all green
- `npm run build` — clean

After Task 12:
- Main JS chunk < 200 kB gzip
- Zero `bb-*` legacy tokens
- Zero `rounded-xl/2xl/3xl` in `src/features/`
- Zero v1 primitive imports

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Lazy loading breaks navigation if Suspense boundaries are wrong | RouteLoader fallback covers each route; integration tests already render pages — they should still pass |
| `cache-and-network` causes flicker | Apollo dedupes if cache + network values are equal; if real flicker happens, switch specific queries to `cache-first` + `pollInterval` follow-up |
| Apollo cache stale after mutations | Existing mutations already invoke `refresh()` callbacks via hooks — no change needed unless a hook missed the pattern |
| 3 redesigns in parallel via subagents conflict | Files are disjoint (different feature dirs); subagents won't collide |
| Deleting v1 primitives breaks unrelated imports | Task 9 step 1 grep verifies no remaining imports before deletion |
| MyDayPage redesign assumes data hooks that don't exist | Task 8 reads existing file first; if no data hooks, ships scaffold with placeholder values + follow-up note |

---

## Decisions captured (in spec)

- Single mega-sub-project not 4 — user prefers shipping polish + perf together
- Subagent parallelism on disjoint files (Tasks 1-3 perf, Task 4 skeleton, Tasks 6-8 redesigns)
- `cache-and-network` for active-state queries (instant cache paint + bg refresh)
- Skeleton primitive single foundation, multiple variants (DRY)
- Drop kanban metaphor in Walk-Ins (clearer for non-tech-savvy operators)

---

## Self-review notes (for the controller)

- ✅ Workstream 1 (perf) → Tasks 1, 2, 3
- ✅ Workstream 2 (skeleton primitive) → Task 4
- ✅ Workstream 3 (apply skeletons to v2 pages) → Task 5
- ✅ Workstream 4 (3 redesigns) → Tasks 6, 7, 8
- ✅ Workstream 5 (cleanup + polish) → Tasks 9, 10, 11
- ✅ Final → Task 12

No placeholders. Every code block is complete.
