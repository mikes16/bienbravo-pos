# POS Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace v1 POS checkout (~1300 LoC, full SaaS visual language) with a single-screen catalog+cart in editorial v2 language. Adds per-line barber attribution (consuming sub-#4a), customer-optional via "Mostrador" fallback, and a printable receipt screen.

**Architecture:** Single React route at `/checkout` renders catalog (60% left) + sticky cart (40% right) on iPad landscape. Cart is local `useReducer` state. Customer is optional; on submit, falls back to a tenant-level "Mostrador" Customer record via a new idempotent API mutation. Per-line barber attribution is sent via the `staffUserId` field on `POSSaleItemInput` (sub-#4a). Post-success shows a 2s splash, then a print-friendly receipt screen with `window.print()` (email button is disabled in sub-#4b — deferred to sub-#4c).

**Tech Stack:** Vite 7 + React 19 + TS 5 + Tailwind 4 + Apollo Client 4 + Vitest 3 + RTL. No new dependencies.

**Spec reference:** `bienbravo-pos/docs/superpowers/specs/2026-05-04-pos-checkout-design.md`

**Branches:**
- API: `feat/pos-checkout-api-helpers` (Task 1 only) on `bienbravo-api`
- POS: `feat/pos-checkout` on `bienbravo-pos` (already created off master)

**Hard preconditions:**

1. **Sub-#4a (PR #12) merged on `bienbravo-api/main`** before POS Tasks 2+. Without this, `staffUserId` field on `POSSaleItemInput` doesn't exist and POS code won't typecheck.
2. **API Task 1 (Mostrador mutation) merged on `bienbravo-api/main`** before POS Task 11 (integration). Tests for Tasks 2-10 use mocks, so Task 1 can run in parallel with POS tasks once started.

Plan execution order:
- Task 1 (API) starts FIRST (after sub-#4a merge confirmed)
- Tasks 2-10 (POS) run sequentially on `feat/pos-checkout` once Task 1's API branch is opened (mocks in tests don't need real API)
- Task 11 (integration) runs after API Task 1 has merged so codegen can pick up the new mutation
- Tasks 12-13 wrap up

**Important codebase facts:**

- POS path alias: `@/` → `src/`
- Foundation primitives at `src/shared/pos-ui/`: `TouchButton`, `TileGrid`, `TileButton`, `MoneyDisplay`, `MoneyInput`, `Numpad`, `WizardShell`, `SuccessSplash`, `EmptyStateV2`, `BottomTabNav`, plus Game Icons set
- `cn` utility at `@/shared/lib/cn`
- `formatMoney(cents)` at `@/shared/lib/money` — returns `$1,234` (whole) or `$1,234.50` (fractions)
- GraphQL queries written via `graphql()` from `@/core/graphql/generated` (NOT `gql` from `@apollo/client`). After schema changes: `npm run sync-schema && npm run codegen`
- Existing checkout queries reusable: `CATEGORIES_QUERY`, `SERVICES_QUERY`, `PRODUCTS_QUERY`, `POS_INVENTORY_LEVELS_QUERY`, `COMBOS_QUERY`, `SEARCH_CUSTOMERS_QUERY`, `FIND_OR_CREATE_CUSTOMER`, `CREATE_POS_SALE` (in `src/features/checkout/data/checkout.repository.ts`)
- `renderWithProviders` at `@/test/helpers/renderWithProviders` wraps with MemoryRouter + RepositoryProvider + LocationProvider + PosAuthProvider + ToastProvider + Apollo MockedProvider
- Test command: `npm test -- <PartialFileName>`
- Build/tsc commands: `npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm run build`
- Pre-existing 44 ESLint errors in `src/test/mocks/repositories.ts` are NOT in scope for this plan
- POS users are non-tech-savvy (memory): bias to clarity over efficiency
- Bottom sheets must always animate (memory): use Radix data-state or controlled translate-y

**Editorial color tokens** used in this plan: `--color-bone`, `--color-bone-muted`, `--color-leather-muted`, `--color-bravo`, `--color-bravo-hover`, `--color-cuero-viejo`, `--color-carbon-elevated`, `--color-success`, `--color-warning`, `--font-pos-display`. All defined in `src/index.css`.

---

## File Structure

**Created (POS):**

- `src/features/checkout/lib/cart.ts` — types + reducer + pure functions (~150 LoC)
- `src/features/checkout/lib/cart.test.ts` — pure function tests (~80 LoC)
- `src/features/checkout/presentation/CatalogChips.tsx` + `.test.tsx`
- `src/features/checkout/presentation/CatalogTile.tsx` + `.test.tsx`
- `src/features/checkout/presentation/CatalogGrid.tsx` (no separate test — covered by CheckoutPage integration)
- `src/features/checkout/presentation/AtendiendoHeader.tsx` + `.test.tsx`
- `src/features/checkout/presentation/BarberSelectorSheet.tsx` + `.test.tsx`
- `src/features/checkout/presentation/CustomerChip.tsx` + `.test.tsx`
- `src/features/checkout/presentation/CustomerLookupSheet.tsx` + `.test.tsx`
- `src/features/checkout/presentation/CartLineRow.tsx` + `.test.tsx`
- `src/features/checkout/presentation/BarberPickerInline.tsx` + `.test.tsx`
- `src/features/checkout/presentation/CartList.tsx` (covered by integration)
- `src/features/checkout/presentation/CartTotals.tsx` + `.test.tsx`
- `src/features/checkout/presentation/CobrarCTA.tsx` (~30 LoC, covered by integration)
- `src/features/checkout/presentation/PaymentSheet.tsx` + `.test.tsx`
- `src/features/checkout/presentation/CashChangeHelper.tsx` + `.test.tsx`
- `src/features/checkout/presentation/TipInput.tsx` + `.test.tsx`
- `src/features/checkout/presentation/ReceiptScreen.tsx` + `.test.tsx`
- `src/features/checkout/presentation/CheckoutPage.tsx` (NEW — replaces v1 same name)
- `src/features/checkout/presentation/CheckoutPage.test.tsx` (integration, ~6 long tests)
- `src/features/checkout/application/useCheckout.ts` (NEW — replaces v1 same name)

**Created (API):**

- `bienbravo-api/src/modules/auth/auth.resolver.ts` (modified): add `findOrCreateMostradorCustomer` mutation
- `bienbravo-api/test/e2e/mostrador-customer.e2e-spec.ts`: e2e test
- `bienbravo-api/schema.generated.graphql` (regenerated): adds the new mutation
- `bienbravo-api/test/schema.baseline.graphql` (regenerated)

**Modified (POS):**

- `src/features/checkout/data/checkout.repository.ts` — add new mutation `FIND_OR_CREATE_MOSTRADOR_CUSTOMER` (small wrapper)
- `src/app/router.tsx` — point `/checkout` to new `CheckoutPage` (no path change; just import)

**Deleted (POS, in Task 12):**

- `src/features/checkout/presentation/CartBar.tsx`
- `src/features/checkout/presentation/CatalogView.tsx`
- `src/features/checkout/presentation/CustomerLookup.tsx`
- `src/features/checkout/presentation/PaymentView.tsx`
- `src/features/checkout/presentation/SuccessView.tsx`
- `src/features/checkout/domain/cart.service.ts`
- `src/features/checkout/application/useCart.ts`
- `src/features/checkout/application/useCatalog.ts`
- `src/features/checkout/application/useActiveRegisterSession.ts`

`checkout.repository.ts` is **kept** — its queries are reused.

---

## Task 1: API — `findOrCreateMostradorCustomer` mutation (TDD)

**This task happens on `bienbravo-api`, NOT `bienbravo-pos`.**

**Working directory:** `/Users/insightcollective/Documents/Code/BienBravo/bienbravo-api`
**Branch:** new branch `feat/pos-checkout-api-helpers` off `main` (after sub-#4a's PR #12 has merged)

**Files:**
- Modify: `bienbravo-api/src/modules/auth/auth.resolver.ts`
- Modify: `bienbravo-api/src/modules/auth/types/customer.type.ts` (verify exports)
- Create: `bienbravo-api/test/e2e/mostrador-customer.e2e-spec.ts`
- Modify: `bienbravo-api/schema.generated.graphql` (regenerated)
- Modify: `bienbravo-api/test/schema.baseline.graphql` (regenerated)

- [ ] **Step 0: Verify sub-#4a is merged**

```bash
cd /Users/insightcollective/Documents/Code/BienBravo/bienbravo-api
git fetch origin main
git log --oneline origin/main | grep -i "sale.*item.*attribution\|saleitem.*staffuserid" | head -3
```

If grep finds nothing matching sub-#4a's merge commit, surface to controller and BLOCK. Sub-#4a must be on main first.

If found, proceed:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feat/pos-checkout-api-helpers
```

- [ ] **Step 1: Write the failing e2e test**

Create `test/e2e/mostrador-customer.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../utils/create-test-app';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('findOrCreateMostradorCustomer (e2e)', () => {
  let app: INestApplication;
  let fastify: any;
  let prisma: PrismaService;

  beforeAll(async () => {
    const { app: a, fastify: f } = await createTestApp();
    app = a;
    fastify = f;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function gql(query: string, variables?: Record<string, unknown>, cookies?: string) {
    const opts: any = {
      method: 'POST',
      url: '/graphql',
      payload: { query, variables },
      headers: { 'content-type': 'application/json' },
    };
    if (cookies) opts.headers.cookie = cookies;
    const res = await fastify.inject(opts);
    return { statusCode: res.statusCode, body: JSON.parse(res.payload), headers: res.headers };
  }

  it('returns the existing Mostrador customer if one exists, creates if not (idempotent)', async () => {
    const login = await gql(
      'mutation($email: String!, $password: String!) { staffLogin(email: $email, password: $password) { viewer { kind } } }',
      { email: 'admin@bienbravo.local', password: 'Admin123!' },
    );
    const setCookie = login.headers?.['set-cookie'];
    const cookieStr = setCookie ? (Array.isArray(setCookie) ? setCookie[0] : setCookie) : '';

    // First call: creates if not present
    const first = await gql(
      'mutation { findOrCreateMostradorCustomer { id fullName } }',
      undefined,
      cookieStr,
    );
    expect(first.statusCode).toBe(200);
    expect(first.body.errors).toBeUndefined();
    expect(first.body.data.findOrCreateMostradorCustomer.fullName).toBe('Mostrador');
    const firstId = first.body.data.findOrCreateMostradorCustomer.id;

    // Second call: returns same record
    const second = await gql(
      'mutation { findOrCreateMostradorCustomer { id fullName } }',
      undefined,
      cookieStr,
    );
    expect(second.body.data.findOrCreateMostradorCustomer.id).toBe(firstId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:e2e -- mostrador-customer
```

Expected: FAIL — mutation doesn't exist (`Cannot query field "findOrCreateMostradorCustomer"`).

- [ ] **Step 3: Find the right resolver to modify**

```bash
grep -rn "@Mutation\|class.*Resolver" src/modules/auth/auth.resolver.ts | head -10
```

Expect to see existing mutations like `staffLogin`, `staffLogout`, `findOrCreateCustomer`. The Mostrador mutation lives alongside these.

- [ ] **Step 4: Add the resolver method**

Open `src/modules/auth/auth.resolver.ts`. Add a new method:

```ts
@Mutation(() => Customer)
async findOrCreateMostradorCustomer(@Context() ctx: GraphQLContext): Promise<Customer> {
  const tenant = await this.auth.getTenant();
  const existing = await this.prisma.customer.findFirst({
    where: { tenantId: tenant.id, fullName: 'Mostrador' },
  });
  if (existing) return existing as unknown as Customer;
  return (await this.prisma.customer.create({
    data: {
      tenantId: tenant.id,
      fullName: 'Mostrador',
    },
  })) as unknown as Customer;
}
```

If `Customer` isn't already imported at the top of `auth.resolver.ts`, add the import:

```ts
import { Customer } from './types/customer.type';
```

If `getTenant()` doesn't exist on `this.auth`, find the right way to get tenant from context (search existing resolvers in the same file for the pattern). The pattern in `pos.resolver.ts` is `await this.auth.getTenant()`.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: clean.

- [ ] **Step 6: Regenerate schema**

```bash
npm run generate-schema
cp schema.generated.graphql test/schema.baseline.graphql
```

Inspect the diff:

```bash
git diff schema.generated.graphql | head -20
```

Expect to see a new line: `findOrCreateMostradorCustomer: Customer!` under the `Mutation` type.

- [ ] **Step 7: Run e2e to verify it passes**

```bash
npm run test:e2e -- mostrador-customer
```

Expected: 1/1 PASS.

- [ ] **Step 8: Run full unit + e2e to confirm no regressions**

```bash
npm run test
npm run test:e2e
```

Pre-existing failures (`holds.service.spec.ts` for unit, the 6 pre-existing failing e2e suites) are not your concern. Confirm no NEW failures.

- [ ] **Step 9: Commit + push + open PR**

```bash
git add src/modules/auth/auth.resolver.ts schema.generated.graphql test/schema.baseline.graphql test/e2e/mostrador-customer.e2e-spec.ts
git commit -m "feat(api): findOrCreateMostradorCustomer mutation for anonymous POS sales"
git push -u origin feat/pos-checkout-api-helpers
gh pr create --title "feat(api): findOrCreateMostradorCustomer mutation" --body "$(cat <<'EOF'
## Summary

Adds a tenant-scoped, idempotent mutation that returns the "Mostrador" Customer record (creating it if absent). Used by sub-#4b POS Checkout when an operator closes a sale without registering a real customer (privacy preference; some clients don't want to be registered).

## Behavior

- Tenant resolved from viewer auth (no args)
- Find by \`(tenantId, fullName: 'Mostrador')\` → return if found
- Otherwise create with the same fields → return

## Cross-repo

Required by \`bienbravo-pos\` sub-#4b POS Checkout (see PR following this one).

## Test plan

- [x] e2e: idempotent — two calls return the same record id
- [ ] CI green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If the PR opens successfully, report the URL. POS Tasks 2-10 can begin in parallel; POS Task 11 (integration tests) must wait until this API PR merges (so codegen can run on POS).

---

## Task 2: POS — cart lib (types + reducer + pure functions)

**Working directory:** `/Users/insightcollective/Documents/Code/BienBravo/bienbravo-pos`
**Branch:** `feat/pos-checkout` (already created off master)

**Files:**
- Create: `src/features/checkout/lib/cart.ts`
- Create: `src/features/checkout/lib/cart.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/checkout/lib/cart.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cartReducer, computeTotals, initialCart } from './cart'
import type { CartLine } from './cart'

const SERVICE_ITEM = {
  kind: 'service' as const,
  itemId: 'svc-1',
  name: 'Corte',
  unitPriceCents: 28000,
}
const PRODUCT_ITEM = {
  kind: 'product' as const,
  itemId: 'prod-1',
  name: 'Shampoo',
  unitPriceCents: 25000,
}

describe('cart reducer', () => {
  it('add appends a new line with qty=1 + default barber', () => {
    const state = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    expect(state.lines.length).toBe(1)
    expect(state.lines[0].qty).toBe(1)
    expect(state.lines[0].staffUserId).toBe('barber-1')
    expect(state.lines[0].itemId).toBe('svc-1')
  })

  it('add of same item creates a new line (multi-barber)', () => {
    const a = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    const b = cartReducer(a, { type: 'add', item: SERVICE_ITEM })
    expect(b.lines.length).toBe(2)
  })

  it('incQty bumps qty', () => {
    const a = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    const b = cartReducer(a, { type: 'incQty', lineId: a.lines[0].id })
    expect(b.lines[0].qty).toBe(2)
  })

  it('decQty decrements; reaches 0 removes line', () => {
    const a = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    const b = cartReducer(a, { type: 'decQty', lineId: a.lines[0].id })
    expect(b.lines.length).toBe(0)
  })

  it('removeLine removes specified line, keeps others', () => {
    let s = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'add', item: PRODUCT_ITEM })
    s = cartReducer(s, { type: 'removeLine', lineId: s.lines[0].id })
    expect(s.lines.length).toBe(1)
    expect(s.lines[0].itemId).toBe('prod-1')
  })

  it('setLineBarber updates barber on specified line only', () => {
    let s = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'setLineBarber', lineId: s.lines[1].id, staffUserId: 'barber-2' })
    expect(s.lines[0].staffUserId).toBe('barber-1')
    expect(s.lines[1].staffUserId).toBe('barber-2')
  })

  it('setDefaultBarber changes default for future adds, not existing lines', () => {
    let s = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'setDefaultBarber', staffUserId: 'barber-2' })
    expect(s.lines[0].staffUserId).toBe('barber-1') // unchanged
    s = cartReducer(s, { type: 'add', item: PRODUCT_ITEM })
    expect(s.lines[1].staffUserId).toBe('barber-2') // new line uses new default
  })

  it('setCustomer assigns', () => {
    const c = { id: 'c1', fullName: 'Carlos' } as any
    const s = cartReducer(initialCart('b'), { type: 'setCustomer', customer: c })
    expect(s.customer?.id).toBe('c1')
  })

  it('clear empties everything', () => {
    let s = cartReducer(initialCart('b'), { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'setCustomer', customer: { id: 'c1', fullName: 'X' } as any })
    s = cartReducer(s, { type: 'clear' })
    expect(s.lines.length).toBe(0)
    expect(s.customer).toBeNull()
    expect(s.defaultBarberId).toBe('b') // default barber preserved across clear
  })
})

describe('computeTotals', () => {
  it('returns 0 for empty cart', () => {
    expect(computeTotals([]).subtotalCents).toBe(0)
  })

  it('sums lines correctly', () => {
    const lines: CartLine[] = [
      { id: '1', kind: 'service', itemId: 'a', name: 'A', qty: 2, unitPriceCents: 28000, staffUserId: null },
      { id: '2', kind: 'product', itemId: 'b', name: 'B', qty: 1, unitPriceCents: 25000, staffUserId: null },
    ]
    expect(computeTotals(lines).subtotalCents).toBe(81000) // 2*28000 + 25000
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- cart.test
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

Create `src/features/checkout/lib/cart.ts`:

```ts
import type { Customer } from '../domain/checkout.types'

export type CartLineKind = 'service' | 'product' | 'combo'

export interface CartLineItem {
  kind: CartLineKind
  itemId: string
  name: string
  unitPriceCents: number
}

export interface CartLine extends CartLineItem {
  id: string
  qty: number
  staffUserId: string | null
}

export interface CartState {
  customer: Customer | null
  defaultBarberId: string
  lines: CartLine[]
}

export type CartAction =
  | { type: 'add'; item: CartLineItem }
  | { type: 'incQty'; lineId: string }
  | { type: 'decQty'; lineId: string }
  | { type: 'removeLine'; lineId: string }
  | { type: 'setLineBarber'; lineId: string; staffUserId: string }
  | { type: 'setDefaultBarber'; staffUserId: string }
  | { type: 'setCustomer'; customer: Customer | null }
  | { type: 'clear' }

let nextId = 0
function uid(): string {
  return `line-${++nextId}`
}

export function initialCart(defaultBarberId: string): CartState {
  return { customer: null, defaultBarberId, lines: [] }
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const line: CartLine = {
        id: uid(),
        kind: action.item.kind,
        itemId: action.item.itemId,
        name: action.item.name,
        qty: 1,
        unitPriceCents: action.item.unitPriceCents,
        staffUserId: state.defaultBarberId,
      }
      return { ...state, lines: [...state.lines, line] }
    }
    case 'incQty':
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.id === action.lineId ? { ...l, qty: l.qty + 1 } : l,
        ),
      }
    case 'decQty':
      return {
        ...state,
        lines: state.lines
          .map((l) => (l.id === action.lineId ? { ...l, qty: l.qty - 1 } : l))
          .filter((l) => l.qty > 0),
      }
    case 'removeLine':
      return { ...state, lines: state.lines.filter((l) => l.id !== action.lineId) }
    case 'setLineBarber':
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.id === action.lineId ? { ...l, staffUserId: action.staffUserId } : l,
        ),
      }
    case 'setDefaultBarber':
      return { ...state, defaultBarberId: action.staffUserId }
    case 'setCustomer':
      return { ...state, customer: action.customer }
    case 'clear':
      return { ...state, customer: null, lines: [] }
  }
}

export interface CartTotals {
  subtotalCents: number
}

export function computeTotals(lines: CartLine[]): CartTotals {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0)
  return { subtotalCents }
}
```

If `Customer` type doesn't exist at `../domain/checkout.types`, check the actual path:

```bash
grep -n "interface Customer\|type Customer" src/features/checkout/domain/checkout.types.ts
```

If not found there, use the Apollo codegen Customer type instead (`@/core/graphql/generated`). Choose whichever matches the v1 import pattern in `checkout.repository.ts`.

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- cart.test
```

Expected: 11/11 PASS.

- [ ] **Step 5: Verify build**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm run build
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/checkout/lib/cart.ts src/features/checkout/lib/cart.test.ts
git commit -m "feat(checkout): cart reducer + pure functions for sub-#4b"
```

Stay on `feat/pos-checkout`.

---

## Task 3: CatalogChips + CatalogTile + CatalogGrid (TDD)

**Files:**
- Create: `src/features/checkout/presentation/CatalogChips.tsx` + `.test.tsx`
- Create: `src/features/checkout/presentation/CatalogTile.tsx` + `.test.tsx`
- Create: `src/features/checkout/presentation/CatalogGrid.tsx`

### Subtask 3a: CatalogChips

- [ ] **Step 1: Write the failing test**

Create `src/features/checkout/presentation/CatalogChips.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CatalogChips } from './CatalogChips'

const CATEGORIES = [
  { id: 'cat-1', name: 'Cortes', sortOrder: 1 },
  { id: 'cat-2', name: 'Color', sortOrder: 2 },
  { id: 'cat-3', name: 'Productos', sortOrder: 3 },
]

describe('CatalogChips', () => {
  it('renders all categories', () => {
    render(<CatalogChips categories={CATEGORIES} selectedCategoryId={null} onSelect={() => {}} searchQuery="" onSearchChange={() => {}} />)
    expect(screen.getByText('Cortes')).toBeInTheDocument()
    expect(screen.getByText('Color')).toBeInTheDocument()
    expect(screen.getByText('Productos')).toBeInTheDocument()
  })

  it('renders "Todo" chip + selected by default when no category selected', () => {
    render(<CatalogChips categories={CATEGORIES} selectedCategoryId={null} onSelect={() => {}} searchQuery="" onSearchChange={() => {}} />)
    expect(screen.getByText('Todo')).toBeInTheDocument()
  })

  it('clicking a chip fires onSelect with id', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<CatalogChips categories={CATEGORIES} selectedCategoryId={null} onSelect={onSelect} searchQuery="" onSearchChange={() => {}} />)
    await user.click(screen.getByText('Cortes'))
    expect(onSelect).toHaveBeenCalledWith('cat-1')
  })

  it('search input fires onSearchChange', async () => {
    const onSearchChange = vi.fn()
    const user = userEvent.setup()
    render(<CatalogChips categories={CATEGORIES} selectedCategoryId={null} onSelect={() => {}} searchQuery="" onSearchChange={onSearchChange} />)
    const input = screen.getByPlaceholderText(/buscar/i)
    await user.type(input, 'corte')
    expect(onSearchChange).toHaveBeenLastCalledWith('corte')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npm test -- CatalogChips.test` → FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checkout/presentation/CatalogChips.tsx`:

```tsx
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { cn } from '@/shared/lib/cn'

interface Category {
  id: string
  name: string
  sortOrder: number
}

interface CatalogChipsProps {
  categories: Category[]
  selectedCategoryId: string | null
  onSelect: (id: string | null) => void
  searchQuery: string
  onSearchChange: (q: string) => void
}

export function CatalogChips({ categories, selectedCategoryId, onSelect, searchQuery, onSearchChange }: CatalogChipsProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-leather-muted)]/40 px-5 py-4">
      <div className="flex items-center gap-2 border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2">
        <span className="text-[var(--color-bone-muted)]" aria-hidden>🔎</span>
        <input
          type="text"
          placeholder="Buscar servicio o producto"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Buscar"
          className="flex-1 bg-transparent text-[14px] text-[var(--color-bone)] outline-none placeholder:text-[var(--color-bone-muted)]"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <TouchButton
          variant="secondary"
          size="min"
          onClick={() => onSelect(null)}
          className={cn(
            'shrink-0',
            selectedCategoryId === null && 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
          )}
        >
          Todo
        </TouchButton>
        {categories.map((c) => (
          <TouchButton
            key={c.id}
            variant="secondary"
            size="min"
            onClick={() => onSelect(c.id)}
            className={cn(
              'shrink-0',
              selectedCategoryId === c.id && 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
            )}
          >
            {c.name}
          </TouchButton>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests + verify build**

```bash
npm test -- CatalogChips.test
npx tsc --noEmit -p tsconfig.app.json
```

Expected: 4/4 tests pass; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/presentation/CatalogChips.tsx src/features/checkout/presentation/CatalogChips.test.tsx
git commit -m "feat(checkout): CatalogChips with search + category filter"
```

### Subtask 3b: CatalogTile

- [ ] **Step 1: Write the failing test**

Create `src/features/checkout/presentation/CatalogTile.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CatalogTile } from './CatalogTile'

describe('CatalogTile', () => {
  it('renders service tile with name + price', () => {
    render(<CatalogTile kind="service" name="Corte" priceCents={28000} onAdd={() => {}} />)
    expect(screen.getByText('Corte')).toBeInTheDocument()
    expect(screen.getByText('$280')).toBeInTheDocument()
  })

  it('renders product tile with stock badge if low', () => {
    render(<CatalogTile kind="product" name="Shampoo" priceCents={25000} stockQty={2} onAdd={() => {}} />)
    expect(screen.getByText(/2 left|stock/i)).toBeInTheDocument()
  })

  it('clicking calls onAdd', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<CatalogTile kind="service" name="Corte" priceCents={28000} onAdd={onAdd} />)
    await user.click(screen.getByRole('button'))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('disabled when stockQty is 0', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<CatalogTile kind="product" name="Shampoo" priceCents={25000} stockQty={0} onAdd={onAdd} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    await user.click(btn)
    expect(onAdd).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npm test -- CatalogTile.test` → FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checkout/presentation/CatalogTile.tsx`:

```tsx
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'

interface CatalogTileProps {
  kind: 'service' | 'product' | 'combo'
  name: string
  priceCents: number
  stockQty?: number
  onAdd: () => void
}

const LOW_STOCK_THRESHOLD = 5

export function CatalogTile({ kind, name, priceCents, stockQty, onAdd }: CatalogTileProps) {
  const isOutOfStock = kind === 'product' && stockQty === 0
  const isLowStock = kind === 'product' && typeof stockQty === 'number' && stockQty > 0 && stockQty <= LOW_STOCK_THRESHOLD

  return (
    <button
      type="button"
      disabled={isOutOfStock}
      onClick={onAdd}
      className={cn(
        'flex flex-col items-start justify-between border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] p-3 text-left transition-colors',
        isOutOfStock
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:border-[var(--color-bravo)] hover:bg-[var(--color-cuero-viejo)]',
      )}
      style={{ aspectRatio: '1 / 1' }}
    >
      <div className="flex flex-col gap-1">
        {kind === 'combo' && (
          <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">COMBO</span>
        )}
        <span className="text-[14px] font-bold leading-tight text-[var(--color-bone)]">{name}</span>
      </div>
      <div className="flex w-full items-end justify-between">
        <span className="text-[18px] font-extrabold tabular-nums text-[var(--color-bone)]">
          {formatMoney(priceCents)}
        </span>
        {isLowStock && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--color-warning)]">
            {stockQty} left
          </span>
        )}
        {isOutOfStock && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--color-bravo)]">
            agotado
          </span>
        )}
      </div>
    </button>
  )
}
```

- [ ] **Step 4: Run tests + verify**

```bash
npm test -- CatalogTile.test
npx tsc --noEmit -p tsconfig.app.json
```

Expected: 4/4 pass; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/presentation/CatalogTile.tsx src/features/checkout/presentation/CatalogTile.test.tsx
git commit -m "feat(checkout): CatalogTile with stock badge"
```

### Subtask 3c: CatalogGrid

No dedicated test — covered by CheckoutPage integration tests in Task 11.

- [ ] **Step 1: Implement**

Create `src/features/checkout/presentation/CatalogGrid.tsx`:

```tsx
import { CatalogTile } from './CatalogTile'

interface CatalogItem {
  id: string
  kind: 'service' | 'product' | 'combo'
  name: string
  priceCents: number
  stockQty?: number
  categoryId: string | null
}

interface CatalogGridProps {
  items: CatalogItem[]
  selectedCategoryId: string | null
  searchQuery: string
  onAdd: (item: CatalogItem) => void
}

export function CatalogGrid({ items, selectedCategoryId, searchQuery, onAdd }: CatalogGridProps) {
  const filtered = items.filter((i) => {
    if (selectedCategoryId && i.categoryId !== selectedCategoryId) return false
    if (searchQuery && !i.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  if (filtered.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-12 text-center">
        <p className="text-[14px] text-[var(--color-bone-muted)]">
          Sin resultados. Cambia de categoría o busca otro nombre.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3 overflow-y-auto p-5">
      {filtered.map((item) => (
        <CatalogTile
          key={item.id}
          kind={item.kind}
          name={item.name}
          priceCents={item.priceCents}
          stockQty={item.stockQty}
          onAdd={() => onAdd(item)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit -p tsconfig.app.json && npm run build
```

Clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/checkout/presentation/CatalogGrid.tsx
git commit -m "feat(checkout): CatalogGrid with category + search filter"
```

---

## Task 4: AtendiendoHeader + BarberSelectorSheet (TDD)

**Files:**
- Create: `src/features/checkout/presentation/AtendiendoHeader.tsx` + `.test.tsx`
- Create: `src/features/checkout/presentation/BarberSelectorSheet.tsx` + `.test.tsx`

### Subtask 4a: AtendiendoHeader

- [ ] **Step 1: Failing test**

Create `src/features/checkout/presentation/AtendiendoHeader.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AtendiendoHeader } from './AtendiendoHeader'

const ANTONIO = { id: 'b1', fullName: 'Antonio Pérez', photoUrl: null }

describe('AtendiendoHeader', () => {
  it('renders atendiendo eyebrow + barber name', () => {
    render(<AtendiendoHeader barber={ANTONIO} onTap={() => {}} />)
    expect(screen.getByText(/atendiendo/i)).toBeInTheDocument()
    expect(screen.getByText(/antonio/i)).toBeInTheDocument()
  })

  it('clicking calls onTap', async () => {
    const onTap = vi.fn()
    const user = userEvent.setup()
    render(<AtendiendoHeader barber={ANTONIO} onTap={onTap} />)
    await user.click(screen.getByRole('button'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('renders avatar fallback initial when no photoUrl', () => {
    render(<AtendiendoHeader barber={ANTONIO} onTap={() => {}} />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npm test -- AtendiendoHeader.test` → FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checkout/presentation/AtendiendoHeader.tsx`:

```tsx
interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
}

interface AtendiendoHeaderProps {
  barber: Barber
  onTap: () => void
}

export function AtendiendoHeader({ barber, onTap }: AtendiendoHeaderProps) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="flex w-full cursor-pointer items-center justify-between border border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.06] px-4 py-3 transition-colors hover:bg-[var(--color-bravo)]/[0.12]"
    >
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
          Atendiendo
        </span>
        <span className="text-[16px] font-extrabold leading-none text-[var(--color-bone)]">
          {barber.fullName}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {barber.photoUrl ? (
          <img src={barber.photoUrl} alt="" className="h-10 w-10 border border-[var(--color-leather-muted)] object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[18px] font-extrabold text-[var(--color-bone)]">
            {barber.fullName[0]}
          </div>
        )}
        <span className="font-mono text-[12px] text-[var(--color-bone-muted)]">↓</span>
      </div>
    </button>
  )
}
```

- [ ] **Step 4: Run + verify**

```bash
npm test -- AtendiendoHeader.test
npx tsc --noEmit -p tsconfig.app.json
```

3/3 pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/presentation/AtendiendoHeader.tsx src/features/checkout/presentation/AtendiendoHeader.test.tsx
git commit -m "feat(checkout): AtendiendoHeader (default-barber selector trigger)"
```

### Subtask 4b: BarberSelectorSheet

- [ ] **Step 1: Failing test**

Create `src/features/checkout/presentation/BarberSelectorSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BarberSelectorSheet } from './BarberSelectorSheet'

const BARBERS = [
  { id: 'b1', fullName: 'Antonio', photoUrl: null },
  { id: 'b2', fullName: 'Beto', photoUrl: null },
  { id: 'b3', fullName: 'Carlos', photoUrl: null },
]

describe('BarberSelectorSheet', () => {
  it('renders all barbers when open', () => {
    render(<BarberSelectorSheet open barbers={BARBERS} currentBarberId="b1" onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Antonio')).toBeInTheDocument()
    expect(screen.getByText('Beto')).toBeInTheDocument()
    expect(screen.getByText('Carlos')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<BarberSelectorSheet open={false} barbers={BARBERS} currentBarberId="b1" onSelect={() => {}} onClose={() => {}} />)
    expect(screen.queryByText('Antonio')).not.toBeInTheDocument()
  })

  it('clicking barber calls onSelect + onClose', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<BarberSelectorSheet open barbers={BARBERS} currentBarberId="b1" onSelect={onSelect} onClose={onClose} />)
    await user.click(screen.getByText('Beto'))
    expect(onSelect).toHaveBeenCalledWith('b2')
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npm test -- BarberSelectorSheet.test` → FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checkout/presentation/BarberSelectorSheet.tsx`:

```tsx
import { cn } from '@/shared/lib/cn'

interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
}

interface BarberSelectorSheetProps {
  open: boolean
  barbers: Barber[]
  currentBarberId: string
  onSelect: (id: string) => void
  onClose: () => void
}

export function BarberSelectorSheet({ open, barbers, currentBarberId, onSelect, onClose }: BarberSelectorSheetProps) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label="Seleccionar barbero"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl border-t border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-6 py-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 font-[var(--font-pos-display)] text-[20px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
          ¿Quién atiende?
        </p>
        <div className="grid grid-cols-3 gap-3">
          {barbers.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                onSelect(b.id)
                onClose()
              }}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-2 border p-3 transition-colors',
                b.id === currentBarberId
                  ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.06]'
                  : 'border-[var(--color-leather-muted)]/40 hover:bg-[var(--color-cuero-viejo)]',
              )}
            >
              {b.photoUrl ? (
                <img src={b.photoUrl} alt="" className="h-14 w-14 border border-[var(--color-leather-muted)] object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[24px] font-extrabold text-[var(--color-bone)]">
                  {b.fullName[0]}
                </div>
              )}
              <span className="text-center text-[12px] text-[var(--color-bone)]">{b.fullName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run + verify**

```bash
npm test -- BarberSelectorSheet.test
npx tsc --noEmit -p tsconfig.app.json
```

3/3 pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/presentation/BarberSelectorSheet.tsx src/features/checkout/presentation/BarberSelectorSheet.test.tsx
git commit -m "feat(checkout): BarberSelectorSheet for default-barber swap"
```

---

## Task 5: CustomerChip + CustomerLookupSheet (TDD)

**Files:**
- Create: `src/features/checkout/presentation/CustomerChip.tsx` + `.test.tsx`
- Create: `src/features/checkout/presentation/CustomerLookupSheet.tsx` + `.test.tsx`

### Subtask 5a: CustomerChip

- [ ] **Step 1: Failing test**

Create `src/features/checkout/presentation/CustomerChip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CustomerChip } from './CustomerChip'

describe('CustomerChip', () => {
  it('renders empty CTA when no customer', () => {
    render(<CustomerChip customer={null} onTap={() => {}} onClear={() => {}} />)
    expect(screen.getByText(/cliente/i)).toBeInTheDocument()
    expect(screen.getByText(/opcional/i)).toBeInTheDocument()
  })

  it('renders customer name + clear × when selected', () => {
    render(<CustomerChip customer={{ id: 'c1', fullName: 'Carlos Méndez' }} onTap={() => {}} onClear={() => {}} />)
    expect(screen.getByText(/carlos méndez/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /quitar cliente/i })).toBeInTheDocument()
  })

  it('clicking the chip body fires onTap', async () => {
    const onTap = vi.fn()
    const user = userEvent.setup()
    render(<CustomerChip customer={null} onTap={onTap} onClear={() => {}} />)
    await user.click(screen.getByRole('button', { name: /\+ cliente/i }))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('clicking × fires onClear (does not fire onTap)', async () => {
    const onTap = vi.fn()
    const onClear = vi.fn()
    const user = userEvent.setup()
    render(<CustomerChip customer={{ id: 'c1', fullName: 'Carlos' }} onTap={onTap} onClear={onClear} />)
    await user.click(screen.getByRole('button', { name: /quitar cliente/i }))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onTap).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npm test -- CustomerChip.test` → FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checkout/presentation/CustomerChip.tsx`:

```tsx
interface CustomerLite {
  id: string
  fullName: string
}

interface CustomerChipProps {
  customer: CustomerLite | null
  onTap: () => void
  onClear: () => void
}

export function CustomerChip({ customer, onTap, onClear }: CustomerChipProps) {
  if (customer === null) {
    return (
      <button
        type="button"
        onClick={onTap}
        aria-label="+ Cliente (opcional)"
        className="flex w-full cursor-pointer items-center gap-2 border border-dashed border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 py-2 text-[13px] text-[var(--color-bone-muted)] transition-colors hover:bg-[var(--color-cuero-viejo)]"
      >
        <span className="font-mono text-[14px]">+</span>
        <span>Cliente <span className="text-[10px] uppercase tracking-[0.18em]">opcional</span></span>
      </button>
    )
  }
  return (
    <div className="flex w-full items-center gap-2 border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 py-2">
      <button
        type="button"
        onClick={onTap}
        className="flex-1 cursor-pointer text-left text-[13px] text-[var(--color-bone)]"
      >
        {customer.fullName}
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label="Quitar cliente"
        className="cursor-pointer font-mono text-[14px] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
      >
        ×
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run + verify**

```bash
npm test -- CustomerChip.test
npx tsc --noEmit -p tsconfig.app.json
```

4/4 pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/presentation/CustomerChip.tsx src/features/checkout/presentation/CustomerChip.test.tsx
git commit -m "feat(checkout): CustomerChip with empty/selected states"
```

### Subtask 5b: CustomerLookupSheet

- [ ] **Step 1: Failing test**

Create `src/features/checkout/presentation/CustomerLookupSheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CustomerLookupSheet } from './CustomerLookupSheet'

const RESULTS = [
  { id: 'c1', fullName: 'Carlos Méndez', email: 'carlos@test.com', phone: null },
  { id: 'c2', fullName: 'Carla Soto', email: null, phone: '+528111234567' },
]

describe('CustomerLookupSheet', () => {
  it('renders search input when open', () => {
    render(<CustomerLookupSheet open results={[]} onSearchChange={() => {}} onSelect={() => {}} onCreate={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('textbox', { name: /buscar/i })).toBeInTheDocument()
  })

  it('renders results when search returns matches', () => {
    render(<CustomerLookupSheet open results={RESULTS} onSearchChange={() => {}} onSelect={() => {}} onCreate={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Carlos Méndez')).toBeInTheDocument()
    expect(screen.getByText('Carla Soto')).toBeInTheDocument()
  })

  it('renders empty-state CTA "Crear nuevo" when results empty', () => {
    render(<CustomerLookupSheet open results={[]} onSearchChange={() => {}} onSelect={() => {}} onCreate={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /crear/i })).toBeInTheDocument()
  })

  it('clicking a result fires onSelect with the customer', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<CustomerLookupSheet open results={RESULTS} onSearchChange={() => {}} onSelect={onSelect} onCreate={() => {}} onClose={() => {}} />)
    await user.click(screen.getByText('Carlos Méndez'))
    expect(onSelect).toHaveBeenCalledWith(RESULTS[0])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npm test -- CustomerLookupSheet.test` → FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checkout/presentation/CustomerLookupSheet.tsx`:

```tsx
import { useState } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'

interface CustomerLite {
  id: string
  fullName: string
  email: string | null
  phone: string | null
}

interface CustomerLookupSheetProps {
  open: boolean
  results: CustomerLite[]
  onSearchChange: (q: string) => void
  onSelect: (customer: CustomerLite) => void
  onCreate: (input: { fullName: string; phone?: string; email?: string }) => void
  onClose: () => void
}

export function CustomerLookupSheet({ open, results, onSearchChange, onSelect, onCreate, onClose }: CustomerLookupSheetProps) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  if (!open) return null

  return (
    <div role="dialog" aria-label="Buscar cliente" className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div className="w-full max-w-2xl border-t border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-6 py-5" onClick={(e) => e.stopPropagation()}>
        {!creating ? (
          <>
            <input
              type="text"
              role="textbox"
              aria-label="Buscar cliente"
              placeholder="Nombre, teléfono o email"
              onChange={(e) => onSearchChange(e.target.value)}
              className="mb-4 w-full border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2 text-[14px] text-[var(--color-bone)] outline-none placeholder:text-[var(--color-bone-muted)]"
            />
            <div className="max-h-64 overflow-y-auto">
              {results.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <p className="text-[13px] text-[var(--color-bone-muted)]">Sin resultados</p>
                  <TouchButton variant="primary" size="min" onClick={() => setCreating(true)} className="rounded-none">
                    Crear nuevo
                  </TouchButton>
                </div>
              ) : (
                results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelect(c)}
                    className="flex w-full cursor-pointer flex-col items-start gap-1 border-b border-[var(--color-leather-muted)]/30 px-3 py-2 text-left transition-colors hover:bg-[var(--color-cuero-viejo)]"
                  >
                    <span className="text-[14px] text-[var(--color-bone)]">{c.fullName}</span>
                    {(c.email || c.phone) && (
                      <span className="font-mono text-[10px] text-[var(--color-bone-muted)]">
                        {c.email ?? c.phone}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="font-[var(--font-pos-display)] text-[18px] font-extrabold text-[var(--color-bone)]">Crear cliente</p>
            <input type="text" placeholder="Nombre completo (requerido)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre" className="border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2 text-[14px] text-[var(--color-bone)] outline-none placeholder:text-[var(--color-bone-muted)]" />
            <input type="tel" placeholder="Teléfono (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Teléfono" className="border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2 text-[14px] text-[var(--color-bone)] outline-none placeholder:text-[var(--color-bone-muted)]" />
            <input type="email" placeholder="Email (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" className="border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2 text-[14px] text-[var(--color-bone)] outline-none placeholder:text-[var(--color-bone-muted)]" />
            <TouchButton
              variant="primary"
              size="primary"
              disabled={!name.trim()}
              onClick={() => onCreate({ fullName: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined })}
              className="rounded-none"
            >
              Crear cliente
            </TouchButton>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run + verify**

```bash
npm test -- CustomerLookupSheet.test
npx tsc --noEmit -p tsconfig.app.json
```

4/4 pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/presentation/CustomerLookupSheet.tsx src/features/checkout/presentation/CustomerLookupSheet.test.tsx
git commit -m "feat(checkout): CustomerLookupSheet with search + create"
```

---

## Task 6: CartLineRow + BarberPickerInline (TDD)

**Files:**
- Create: `src/features/checkout/presentation/CartLineRow.tsx` + `.test.tsx`
- Create: `src/features/checkout/presentation/BarberPickerInline.tsx` + `.test.tsx`

### Subtask 6a: BarberPickerInline

- [ ] **Step 1: Failing test**

Create `src/features/checkout/presentation/BarberPickerInline.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BarberPickerInline } from './BarberPickerInline'

const BARBERS = [
  { id: 'b1', fullName: 'Antonio', photoUrl: null },
  { id: 'b2', fullName: 'Beto', photoUrl: null },
  { id: 'b3', fullName: 'Carlos', photoUrl: null },
]

describe('BarberPickerInline', () => {
  it('renders all barbers as horizontal row', () => {
    render(<BarberPickerInline barbers={BARBERS} currentBarberId="b1" onSelect={() => {}} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('current barber has selected styling', () => {
    const { container } = render(<BarberPickerInline barbers={BARBERS} currentBarberId="b2" onSelect={() => {}} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons[1].className).toMatch(/bravo/)
  })

  it('clicking a different barber fires onSelect', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<BarberPickerInline barbers={BARBERS} currentBarberId="b1" onSelect={onSelect} />)
    await user.click(screen.getByLabelText('Beto'))
    expect(onSelect).toHaveBeenCalledWith('b2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npm test -- BarberPickerInline.test` → FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checkout/presentation/BarberPickerInline.tsx`:

```tsx
import { cn } from '@/shared/lib/cn'

interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
}

interface BarberPickerInlineProps {
  barbers: Barber[]
  currentBarberId: string | null
  onSelect: (id: string) => void
}

export function BarberPickerInline({ barbers, currentBarberId, onSelect }: BarberPickerInlineProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-1 py-2">
      {barbers.map((b) => (
        <button
          key={b.id}
          type="button"
          aria-label={b.fullName}
          onClick={() => onSelect(b.id)}
          className={cn(
            'flex shrink-0 cursor-pointer flex-col items-center gap-1 border p-2 transition-colors',
            b.id === currentBarberId
              ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08]'
              : 'border-[var(--color-leather-muted)]/40 hover:bg-[var(--color-cuero-viejo)]',
          )}
        >
          {b.photoUrl ? (
            <img src={b.photoUrl} alt="" className="h-10 w-10 border border-[var(--color-leather-muted)] object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[16px] font-extrabold text-[var(--color-bone)]">
              {b.fullName[0]}
            </div>
          )}
          <span className="text-[10px] text-[var(--color-bone)]">{b.fullName.split(' ')[0]}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run + verify**

```bash
npm test -- BarberPickerInline.test
npx tsc --noEmit -p tsconfig.app.json
```

3/3 pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/presentation/BarberPickerInline.tsx src/features/checkout/presentation/BarberPickerInline.test.tsx
git commit -m "feat(checkout): BarberPickerInline with horizontal avatar scroll"
```

### Subtask 6b: CartLineRow

- [ ] **Step 1: Failing test**

Create `src/features/checkout/presentation/CartLineRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CartLineRow } from './CartLineRow'

const BARBERS = [
  { id: 'b1', fullName: 'Antonio', photoUrl: null },
  { id: 'b2', fullName: 'Beto', photoUrl: null },
]

const LINE = {
  id: 'l1',
  kind: 'service' as const,
  itemId: 'svc-1',
  name: 'Corte',
  qty: 2,
  unitPriceCents: 28000,
  staffUserId: 'b1',
}

describe('CartLineRow', () => {
  it('renders name, qty, line total', () => {
    render(<CartLineRow line={LINE} barbers={BARBERS} onIncQty={() => {}} onDecQty={() => {}} onSetBarber={() => {}} onRemove={() => {}} />)
    expect(screen.getByText('Corte')).toBeInTheDocument()
    expect(screen.getByText('$560')).toBeInTheDocument() // 2 * 280
  })

  it('renders barber chip with current barber name', () => {
    render(<CartLineRow line={LINE} barbers={BARBERS} onIncQty={() => {}} onDecQty={() => {}} onSetBarber={() => {}} onRemove={() => {}} />)
    expect(screen.getByText(/antonio/i)).toBeInTheDocument()
  })

  it('+ button fires onIncQty', async () => {
    const onIncQty = vi.fn()
    const user = userEvent.setup()
    render(<CartLineRow line={LINE} barbers={BARBERS} onIncQty={onIncQty} onDecQty={() => {}} onSetBarber={() => {}} onRemove={() => {}} />)
    await user.click(screen.getByRole('button', { name: /aumentar/i }))
    expect(onIncQty).toHaveBeenCalledWith('l1')
  })

  it('− button fires onDecQty', async () => {
    const onDecQty = vi.fn()
    const user = userEvent.setup()
    render(<CartLineRow line={LINE} barbers={BARBERS} onIncQty={() => {}} onDecQty={onDecQty} onSetBarber={() => {}} onRemove={() => {}} />)
    await user.click(screen.getByRole('button', { name: /disminuir/i }))
    expect(onDecQty).toHaveBeenCalledWith('l1')
  })

  it('tap barber chip expands BarberPickerInline', async () => {
    const user = userEvent.setup()
    render(<CartLineRow line={LINE} barbers={BARBERS} onIncQty={() => {}} onDecQty={() => {}} onSetBarber={() => {}} onRemove={() => {}} />)
    await user.click(screen.getByRole('button', { name: /antonio/i }))
    expect(screen.getByLabelText('Beto')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npm test -- CartLineRow.test` → FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checkout/presentation/CartLineRow.tsx`:

```tsx
import { useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'
import { BarberPickerInline } from './BarberPickerInline'
import type { CartLine } from '../lib/cart'

interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
}

interface CartLineRowProps {
  line: CartLine
  barbers: Barber[]
  onIncQty: (lineId: string) => void
  onDecQty: (lineId: string) => void
  onSetBarber: (lineId: string, barberId: string) => void
  onRemove: (lineId: string) => void
}

export function CartLineRow({ line, barbers, onIncQty, onDecQty, onSetBarber, onRemove }: CartLineRowProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const currentBarber = barbers.find((b) => b.id === line.staffUserId)
  const lineTotalCents = line.unitPriceCents * line.qty

  return (
    <div className="flex flex-col gap-2 border-b border-[var(--color-leather-muted)]/30 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-bold text-[var(--color-bone)]">{line.name}</span>
        <span className="text-[14px] font-extrabold tabular-nums text-[var(--color-bone)]">{formatMoney(lineTotalCents)}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Disminuir cantidad"
            onClick={() => onDecQty(line.id)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[16px] font-bold text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)]"
          >
            −
          </button>
          <span className="w-8 text-center text-[16px] font-extrabold tabular-nums text-[var(--color-bone)]">{line.qty}</span>
          <button
            type="button"
            aria-label="Aumentar cantidad"
            onClick={() => onIncQty(line.id)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[16px] font-bold text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)]"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className={cn(
            'cursor-pointer border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em]',
            pickerOpen
              ? 'border-[var(--color-bravo)] text-[var(--color-bone)]'
              : 'border-[var(--color-leather-muted)] text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)]',
          )}
        >
          {currentBarber?.fullName.split(' ')[0] ?? '— Barbero'} ↓
        </button>
        <button
          type="button"
          aria-label="Quitar línea"
          onClick={() => onRemove(line.id)}
          className="cursor-pointer font-mono text-[14px] text-[var(--color-bone-muted)] hover:text-[var(--color-bravo)]"
        >
          ×
        </button>
      </div>
      {pickerOpen && (
        <BarberPickerInline
          barbers={barbers}
          currentBarberId={line.staffUserId}
          onSelect={(id) => {
            onSetBarber(line.id, id)
            setPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run + verify**

```bash
npm test -- CartLineRow.test
npx tsc --noEmit -p tsconfig.app.json
```

5/5 pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/presentation/CartLineRow.tsx src/features/checkout/presentation/CartLineRow.test.tsx
git commit -m "feat(checkout): CartLineRow with qty stepper + per-line barber picker"
```

---

## Task 7: CartList + CartTotals + CobrarCTA

No dedicated test for CartList / CobrarCTA (covered by integration). CartTotals gets a small unit test.

**Files:**
- Create: `src/features/checkout/presentation/CartTotals.tsx` + `.test.tsx`
- Create: `src/features/checkout/presentation/CartList.tsx`
- Create: `src/features/checkout/presentation/CobrarCTA.tsx`

### Subtask 7a: CartTotals

- [ ] **Step 1: Failing test**

Create `src/features/checkout/presentation/CartTotals.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CartTotals } from './CartTotals'

describe('CartTotals', () => {
  it('renders subtotal label + amount', () => {
    render(<CartTotals subtotalCents={81000} />)
    expect(screen.getByText(/total/i)).toBeInTheDocument()
    expect(screen.getByText('$810')).toBeInTheDocument()
  })

  it('renders zero state with $0', () => {
    render(<CartTotals subtotalCents={0} />)
    expect(screen.getByText('$0')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npm test -- CartTotals.test` → FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checkout/presentation/CartTotals.tsx`:

```tsx
import { formatMoney } from '@/shared/lib/money'

interface CartTotalsProps {
  subtotalCents: number
}

export function CartTotals({ subtotalCents }: CartTotalsProps) {
  return (
    <div className="flex items-baseline justify-between border-t border-[var(--color-leather-muted)]/40 px-4 py-3">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
        Total
      </span>
      <span className="font-[var(--font-pos-display)] text-[28px] font-extrabold tabular-nums leading-none text-[var(--color-bone)]">
        {formatMoney(subtotalCents)}
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Run + verify**

```bash
npm test -- CartTotals.test
```

2/2 pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/presentation/CartTotals.tsx src/features/checkout/presentation/CartTotals.test.tsx
git commit -m "feat(checkout): CartTotals"
```

### Subtask 7b: CartList

- [ ] **Step 1: Implement**

Create `src/features/checkout/presentation/CartList.tsx`:

```tsx
import { CartLineRow } from './CartLineRow'
import type { CartLine } from '../lib/cart'

interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
}

interface CartListProps {
  lines: CartLine[]
  barbers: Barber[]
  onIncQty: (lineId: string) => void
  onDecQty: (lineId: string) => void
  onSetBarber: (lineId: string, barberId: string) => void
  onRemove: (lineId: string) => void
}

export function CartList({ lines, barbers, onIncQty, onDecQty, onSetBarber, onRemove }: CartListProps) {
  if (lines.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12 text-center">
        <p className="text-[13px] text-[var(--color-bone-muted)]">
          Toca un servicio o producto para empezar.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {lines.map((line) => (
        <CartLineRow
          key={line.id}
          line={line}
          barbers={barbers}
          onIncQty={onIncQty}
          onDecQty={onDecQty}
          onSetBarber={onSetBarber}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/checkout/presentation/CartList.tsx
git commit -m "feat(checkout): CartList with empty state"
```

### Subtask 7c: CobrarCTA

- [ ] **Step 1: Implement**

Create `src/features/checkout/presentation/CobrarCTA.tsx`:

```tsx
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { formatMoney } from '@/shared/lib/money'

interface CobrarCTAProps {
  totalCents: number
  disabled: boolean
  onTap: () => void
}

export function CobrarCTA({ totalCents, disabled, onTap }: CobrarCTAProps) {
  return (
    <TouchButton
      variant="primary"
      size="primary"
      disabled={disabled}
      onClick={onTap}
      className="rounded-none uppercase tracking-[0.06em]"
    >
      {totalCents === 0 ? 'Cobrar →' : `Cobrar · ${formatMoney(totalCents)} →`}
    </TouchButton>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/checkout/presentation/CobrarCTA.tsx
git commit -m "feat(checkout): CobrarCTA"
```

---

## Task 8: PaymentSheet + CashChangeHelper + TipInput (TDD)

**Files:**
- Create: `src/features/checkout/presentation/CashChangeHelper.tsx` + `.test.tsx`
- Create: `src/features/checkout/presentation/TipInput.tsx` + `.test.tsx`
- Create: `src/features/checkout/presentation/PaymentSheet.tsx` + `.test.tsx`

### Subtask 8a: CashChangeHelper

- [ ] **Step 1: Failing test**

Create `src/features/checkout/presentation/CashChangeHelper.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CashChangeHelper } from './CashChangeHelper'

describe('CashChangeHelper', () => {
  it('renders 0 change when received < total', () => {
    render(<CashChangeHelper totalCents={81000} receivedPesos={500} onReceivedChange={() => {}} />)
    expect(screen.getByText(/cambio.*\$0/i)).toBeInTheDocument()
  })

  it('renders correct change when received > total', () => {
    render(<CashChangeHelper totalCents={81000} receivedPesos={1000} onReceivedChange={() => {}} />)
    expect(screen.getByText(/cambio.*\$190/i)).toBeInTheDocument()
  })

  it('input fires onReceivedChange', async () => {
    const onReceivedChange = vi.fn()
    const user = userEvent.setup()
    render(<CashChangeHelper totalCents={81000} receivedPesos={0} onReceivedChange={onReceivedChange} />)
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '1000')
    expect(onReceivedChange).toHaveBeenLastCalledWith(1000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npm test -- CashChangeHelper.test` → FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checkout/presentation/CashChangeHelper.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { formatMoney } from '@/shared/lib/money'

interface CashChangeHelperProps {
  totalCents: number
  receivedPesos: number
  onReceivedChange: (pesos: number) => void
}

export function CashChangeHelper({ totalCents, receivedPesos, onReceivedChange }: CashChangeHelperProps) {
  const [display, setDisplay] = useState(receivedPesos)

  useEffect(() => {
    setDisplay(receivedPesos)
  }, [receivedPesos])

  const receivedCents = display * 100
  const changeCents = Math.max(0, receivedCents - totalCents)

  return (
    <div className="flex flex-col gap-3 border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Recibido
        </span>
        <div className="flex items-center gap-2 border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2">
          <span className="text-[var(--color-bone-muted)]">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={display}
            onChange={(e) => {
              const raw = e.target.value
              const pesos = raw === '' ? 0 : Math.max(0, Number(raw) || 0)
              setDisplay(pesos)
              if (raw !== '') onReceivedChange(pesos)
            }}
            aria-label="Monto recibido"
            className="w-24 bg-transparent text-right text-[18px] font-bold tabular-nums text-[var(--color-bone)] outline-none"
          />
        </div>
      </div>
      <div className="flex items-baseline justify-between border-t border-[var(--color-leather-muted)]/40 pt-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Cambio
        </span>
        <span className="text-[20px] font-extrabold tabular-nums text-[var(--color-success)]">
          {formatMoney(changeCents)}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run + verify**

```bash
npm test -- CashChangeHelper.test
npx tsc --noEmit -p tsconfig.app.json
```

3/3 pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/presentation/CashChangeHelper.tsx src/features/checkout/presentation/CashChangeHelper.test.tsx
git commit -m "feat(checkout): CashChangeHelper for cash receive + change calc"
```

### Subtask 8b: TipInput

- [ ] **Step 1: Failing test**

Create `src/features/checkout/presentation/TipInput.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TipInput } from './TipInput'

describe('TipInput', () => {
  it('renders preset chips', () => {
    render(<TipInput totalCents={100000} tipCents={0} onChange={() => {}} />)
    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.getByText('15%')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
    expect(screen.getByText(/otro/i)).toBeInTheDocument()
  })

  it('clicking 15% sets tip to 15% of total', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TipInput totalCents={100000} tipCents={0} onChange={onChange} />)
    await user.click(screen.getByText('15%'))
    expect(onChange).toHaveBeenCalledWith(15000)  // 15% of 100000
  })

  it('clicking Otro reveals input', async () => {
    const user = userEvent.setup()
    render(<TipInput totalCents={100000} tipCents={0} onChange={() => {}} />)
    await user.click(screen.getByText(/otro/i))
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npm test -- TipInput.test` → FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checkout/presentation/TipInput.tsx`:

```tsx
import { useState } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { cn } from '@/shared/lib/cn'

interface TipInputProps {
  totalCents: number
  tipCents: number
  onChange: (cents: number) => void
}

const PRESETS = [10, 15, 20]

export function TipInput({ totalCents, tipCents, onChange }: TipInputProps) {
  const [otroOpen, setOtroOpen] = useState(false)
  const [otroPesos, setOtroPesos] = useState(0)

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
        Propina (opcional)
      </span>
      <div className="flex gap-2">
        {PRESETS.map((p) => {
          const cents = Math.round((totalCents * p) / 100)
          const isSelected = tipCents === cents && !otroOpen
          return (
            <TouchButton
              key={p}
              variant="secondary"
              size="min"
              onClick={() => {
                setOtroOpen(false)
                onChange(cents)
              }}
              className={cn(
                'flex-1 tabular-nums',
                isSelected && 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
              )}
            >
              {p}%
            </TouchButton>
          )
        })}
        <TouchButton
          variant="secondary"
          size="min"
          onClick={() => setOtroOpen((v) => !v)}
          className={cn(
            'flex-1',
            otroOpen && 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
          )}
        >
          Otro
        </TouchButton>
      </div>
      {otroOpen && (
        <div className="flex items-center gap-2 border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2">
          <span className="text-[var(--color-bone-muted)]">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={otroPesos}
            onChange={(e) => {
              const raw = e.target.value
              const pesos = raw === '' ? 0 : Math.max(0, Number(raw) || 0)
              setOtroPesos(pesos)
              if (raw !== '') onChange(pesos * 100)
            }}
            aria-label="Otro monto"
            className="w-24 bg-transparent text-right text-[16px] font-bold tabular-nums text-[var(--color-bone)] outline-none"
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run + verify**

```bash
npm test -- TipInput.test
npx tsc --noEmit -p tsconfig.app.json
```

3/3 pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/presentation/TipInput.tsx src/features/checkout/presentation/TipInput.test.tsx
git commit -m "feat(checkout): TipInput with preset chips + custom amount"
```

### Subtask 8c: PaymentSheet

- [ ] **Step 1: Failing test**

Create `src/features/checkout/presentation/PaymentSheet.test.tsx`:

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

  it('selecting CASH shows CashChangeHelper', async () => {
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={() => {}} />)
    await user.click(screen.getByRole('button', { name: /efectivo/i }))
    expect(screen.getByLabelText(/recibido/i)).toBeInTheDocument()
  })

  it('selecting TARJETA shows TipInput', async () => {
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={() => {}} />)
    await user.click(screen.getByRole('button', { name: /tarjeta/i }))
    expect(screen.getByText(/propina/i)).toBeInTheDocument()
  })

  it('Confirmar fires onConfirm with method + tip', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /tarjeta/i }))
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(onConfirm).toHaveBeenCalledWith({ method: 'CARD', tipCents: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npm test -- PaymentSheet.test` → FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checkout/presentation/PaymentSheet.tsx`:

```tsx
import { useState } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'
import { CashChangeHelper } from './CashChangeHelper'
import { TipInput } from './TipInput'

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER'

interface PaymentInput {
  method: PaymentMethod
  tipCents: number
}

interface PaymentSheetProps {
  open: boolean
  totalCents: number
  onClose: () => void
  onConfirm: (input: PaymentInput) => void
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
}

export function PaymentSheet({ open, totalCents, onClose, onConfirm }: PaymentSheetProps) {
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [receivedPesos, setReceivedPesos] = useState(0)
  const [tipCents, setTipCents] = useState(0)

  if (!open) return null

  const canConfirm = method !== null

  return (
    <div role="dialog" aria-label="Pago" className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={onClose}>
      <div className="w-full max-w-2xl border-t border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-6 py-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-baseline justify-between">
          <p className="font-[var(--font-pos-display)] text-[20px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
            Pago
          </p>
          <p className="text-[18px] font-extrabold tabular-nums text-[var(--color-bone)]">
            {formatMoney(totalCents)}
          </p>
        </div>

        <div className="mb-3 flex gap-2">
          {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
            <TouchButton
              key={m}
              variant="secondary"
              size="secondary"
              onClick={() => setMethod(m)}
              className={cn(
                'flex-1',
                method === m && 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
              )}
            >
              {METHOD_LABELS[m]}
            </TouchButton>
          ))}
        </div>

        {method === 'CASH' && (
          <CashChangeHelper
            totalCents={totalCents}
            receivedPesos={receivedPesos}
            onReceivedChange={setReceivedPesos}
          />
        )}

        {(method === 'CARD' || method === 'TRANSFER') && (
          <TipInput totalCents={totalCents} tipCents={tipCents} onChange={setTipCents} />
        )}

        <div className="mt-4">
          <TouchButton
            variant="primary"
            size="primary"
            disabled={!canConfirm}
            onClick={() => method && onConfirm({ method, tipCents: method === 'CASH' ? 0 : tipCents })}
            className="rounded-none uppercase tracking-[0.06em]"
          >
            Confirmar pago
          </TouchButton>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run + verify**

```bash
npm test -- PaymentSheet.test
npx tsc --noEmit -p tsconfig.app.json
```

5/5 pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/presentation/PaymentSheet.tsx src/features/checkout/presentation/PaymentSheet.test.tsx
git commit -m "feat(checkout): PaymentSheet with method picker + cash/tip helpers"
```

---

## Task 9: ReceiptScreen (TDD)

**Files:**
- Create: `src/features/checkout/presentation/ReceiptScreen.tsx` + `.test.tsx`

- [ ] **Step 1: Failing test**

Create `src/features/checkout/presentation/ReceiptScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ReceiptScreen } from './ReceiptScreen'

const SALE = {
  id: 'sale-1',
  totalCents: 81000,
  paymentMethod: 'CASH' as const,
  createdAt: '2026-05-04T16:18:00.000Z',
  customer: { id: 'c1', fullName: 'Carlos Méndez', email: 'carlos@test.com' },
  items: [
    { id: 'i1', name: 'Corte', qty: 2, unitPriceCents: 28000, totalCents: 56000, staffUser: { id: 'b1', fullName: 'Antonio' } },
    { id: 'i2', name: 'Shampoo', qty: 1, unitPriceCents: 25000, totalCents: 25000, staffUser: null },
  ],
}

describe('ReceiptScreen', () => {
  it('renders sale items + totals + customer', () => {
    render(<ReceiptScreen sale={SALE} onListo={() => {}} />)
    expect(screen.getByText('Corte')).toBeInTheDocument()
    expect(screen.getByText('Shampoo')).toBeInTheDocument()
    expect(screen.getByText('$810')).toBeInTheDocument()
    expect(screen.getByText(/carlos méndez/i)).toBeInTheDocument()
    expect(screen.getByText(/antonio/i)).toBeInTheDocument()
  })

  it('Imprimir CTA calls window.print', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<ReceiptScreen sale={SALE} onListo={() => {}} />)
    await user.click(screen.getByRole('button', { name: /imprimir/i }))
    expect(printSpy).toHaveBeenCalled()
    printSpy.mockRestore()
  })

  it('Listo CTA fires onListo', async () => {
    const onListo = vi.fn()
    const user = userEvent.setup()
    render(<ReceiptScreen sale={SALE} onListo={onListo} />)
    await user.click(screen.getByRole('button', { name: /listo/i }))
    expect(onListo).toHaveBeenCalled()
  })

  it('Enviar por correo button is disabled (deferred to sub-#4c)', () => {
    render(<ReceiptScreen sale={SALE} onListo={() => {}} />)
    const emailBtn = screen.getByRole('button', { name: /correo/i })
    expect(emailBtn).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

`npm test -- ReceiptScreen.test` → FAIL.

- [ ] **Step 3: Implement**

Create `src/features/checkout/presentation/ReceiptScreen.tsx`:

```tsx
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { formatMoney } from '@/shared/lib/money'

interface SaleItem {
  id: string
  name: string
  qty: number
  unitPriceCents: number
  totalCents: number
  staffUser: { id: string; fullName: string } | null
}

interface CustomerLite {
  id: string
  fullName: string
  email: string | null
}

interface SaleData {
  id: string
  totalCents: number
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER'
  createdAt: string
  customer: CustomerLite | null
  items: SaleItem[]
}

interface ReceiptScreenProps {
  sale: SaleData
  onListo: () => void
}

const METHOD_LABEL: Record<SaleData['paymentMethod'], string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
}

function formatTimeMx(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/Monterrey',
  })
}

export function ReceiptScreen({ sale, onListo }: ReceiptScreenProps) {
  return (
    <div className="flex h-full flex-col bg-[var(--color-carbon-elevated)] print:bg-white print:text-black">
      {/* Action bar — hidden on print */}
      <div className="flex items-center justify-end gap-2 border-b border-[var(--color-leather-muted)]/40 px-6 py-3 print:hidden">
        <TouchButton variant="secondary" size="min" onClick={() => window.print()} className="rounded-none">
          Imprimir
        </TouchButton>
        <TouchButton variant="secondary" size="min" disabled title="Próximamente (sub-#4c)" className="rounded-none">
          Enviar por correo
        </TouchButton>
        <TouchButton variant="primary" size="min" onClick={onListo} className="rounded-none">
          Listo
        </TouchButton>
      </div>

      {/* Receipt body */}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 py-6 print:max-w-full">
        <div className="text-center">
          <p className="font-[var(--font-pos-display)] text-[20px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)] print:text-black">
            BienBravo
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)] print:text-gray-700">
            {formatTimeMx(sale.createdAt)}
          </p>
        </div>

        <div className="border-y border-[var(--color-leather-muted)]/40 py-3 print:border-gray-300">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)] print:text-gray-700">Cliente</p>
          <p className="text-[14px] text-[var(--color-bone)] print:text-black">{sale.customer?.fullName ?? 'Mostrador'}</p>
        </div>

        <div className="flex flex-col gap-2">
          {sale.items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
              <span className="text-[14px] text-[var(--color-bone)] print:text-black">{item.qty} × {item.name}</span>
              <span className="text-right tabular-nums text-[14px] font-bold text-[var(--color-bone)] print:text-black">
                {formatMoney(item.totalCents)}
              </span>
              {item.staffUser && (
                <span className="col-start-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)] print:text-gray-700">
                  {item.staffUser.fullName}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-baseline justify-between border-t border-[var(--color-leather-muted)]/40 pt-3 print:border-gray-300">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)] print:text-gray-700">Total</span>
          <span className="font-[var(--font-pos-display)] text-[24px] font-extrabold tabular-nums leading-none text-[var(--color-bone)] print:text-black">
            {formatMoney(sale.totalCents)}
          </span>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)] print:text-gray-700">
          Pagado con {METHOD_LABEL[sale.paymentMethod]}
        </p>

        <p className="mt-auto text-center font-mono text-[10px] text-[var(--color-bone-muted)] print:text-gray-700">
          ¡Gracias por tu visita!
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run + verify**

```bash
npm test -- ReceiptScreen.test
npx tsc --noEmit -p tsconfig.app.json
```

4/4 pass; clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/checkout/presentation/ReceiptScreen.tsx src/features/checkout/presentation/ReceiptScreen.test.tsx
git commit -m "feat(checkout): ReceiptScreen with print-friendly view"
```

---

## Task 10: useCheckout hook + repository updates

**Files:**
- Create: `src/features/checkout/application/useCheckout.ts` (NEW — replaces v1 file with same name in Task 12)
- Modify: `src/features/checkout/data/checkout.repository.ts` — add `FIND_OR_CREATE_MOSTRADOR_CUSTOMER` mutation wrapper

- [ ] **Step 1: Add Mostrador mutation to repository**

Open `src/features/checkout/data/checkout.repository.ts`. Find the section with other mutations and add:

```ts
const FIND_OR_CREATE_MOSTRADOR_CUSTOMER = graphql(`
  mutation PosFindOrCreateMostradorCustomer {
    findOrCreateMostradorCustomer {
      id
      fullName
    }
  }
`)
```

Then in the repository class, expose:

```ts
async findOrCreateMostradorCustomer(): Promise<{ id: string; fullName: string }> {
  const result = await this.client.mutate({ mutation: FIND_OR_CREATE_MOSTRADOR_CUSTOMER })
  if (!result.data?.findOrCreateMostradorCustomer) throw new Error('No data')
  return result.data.findOrCreateMostradorCustomer
}
```

(Adapt to whatever the existing repository pattern is — search for an existing mutation method like `searchCustomers` or `findOrCreateCustomer` and follow the same shape.)

- [ ] **Step 2: Regenerate codegen** (only valid after API Task 1 has merged on `bienbravo-api/main`)

```bash
cd /Users/insightcollective/Documents/Code/BienBravo/bienbravo-pos
npm run sync-schema
npm run codegen
```

Expected: `src/core/graphql/generated/` updated with the new mutation. If `sync-schema` fails because the schema doesn't have `findOrCreateMostradorCustomer`, the API Task 1 hasn't merged yet — BLOCK and surface to controller.

If it succeeds, proceed.

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Clean.

- [ ] **Step 4: Implement useCheckout hook**

Create `src/features/checkout/application/useCheckout.ts`:

```ts
import { useEffect, useReducer, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { useLocation } from '@/core/location/useLocation'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { cartReducer, initialCart } from '../lib/cart'
import type { CartState, CartAction } from '../lib/cart'

interface Customer { id: string; fullName: string; email: string | null; phone: string | null }
interface Barber { id: string; fullName: string; photoUrl: string | null }
interface CatalogItem { id: string; kind: 'service' | 'product' | 'combo'; name: string; priceCents: number; stockQty?: number; categoryId: string | null }

type CheckoutContext =
  | { kind: 'free' }
  | { kind: 'preselected-customer'; customerId: string }
  | { kind: 'walk-in'; walkInId: string }

interface SaleResult {
  id: string
  totalCents: number
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER'
  createdAt: string
  customer: Customer | null
  items: Array<{ id: string; name: string; qty: number; unitPriceCents: number; totalCents: number; staffUser: { id: string; fullName: string } | null }>
}

export function useCheckout() {
  const [params] = useSearchParams()
  const { checkout, register } = useRepositories()
  const { locationId } = useLocation()
  const { viewer } = usePosAuth()

  // Catalog data
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string; sortOrder: number }>>([])
  const [barbers, setBarbers] = useState<Barber[]>([])

  // Context resolution
  const [context, setContext] = useState<CheckoutContext | null>(null)
  const completeWalkInId = params.get('completeWalkInId')
  const customerIdParam = params.get('customerId')

  // Cart state
  const [cartState, dispatch] = useReducer(cartReducer, initialCart(viewer?.staff?.id ?? ''))

  // UI state
  const [registerSessionId, setRegisterSessionId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successSale, setSuccessSale] = useState<SaleResult | null>(null)

  // Customer search state
  const [customerResults, setCustomerResults] = useState<Customer[]>([])

  // Load context (run on mount)
  useEffect(() => {
    if (completeWalkInId) {
      setContext({ kind: 'walk-in', walkInId: completeWalkInId })
    } else if (customerIdParam) {
      setContext({ kind: 'preselected-customer', customerId: customerIdParam })
    } else {
      setContext({ kind: 'free' })
    }
  }, [completeWalkInId, customerIdParam])

  // Load catalog + register session
  useEffect(() => {
    if (!locationId) return
    let cancelled = false
    Promise.all([
      checkout.getServices(locationId, viewer?.staff?.id ?? null),
      checkout.getProducts(locationId),
      checkout.getCombos(),
      checkout.getCategories(),
      checkout.getBarbers(locationId),
      register.getActiveSession(locationId),
    ]).then(([services, products, combos, cats, brbs, session]) => {
      if (cancelled) return
      const items: CatalogItem[] = [
        ...services.map((s: any) => ({ id: s.id, kind: 'service' as const, name: s.name, priceCents: s.priceCents, categoryId: s.categoryId })),
        ...products.map((p: any) => ({ id: p.id, kind: 'product' as const, name: p.name, priceCents: p.priceCents, stockQty: p.stockQty, categoryId: p.categoryId })),
        ...combos.map((c: any) => ({ id: c.id, kind: 'combo' as const, name: c.name, priceCents: c.priceCents, categoryId: c.effectiveCategoryIds?.[0] ?? null })),
      ]
      setCatalogItems(items)
      setCategories(cats)
      setBarbers(brbs)
      setRegisterSessionId(session?.id ?? null)
    })
    return () => { cancelled = true }
  }, [locationId, viewer?.staff?.id, checkout, register])

  // Pre-fill from context
  useEffect(() => {
    if (!context) return
    if (context.kind === 'walk-in') {
      checkout.getWalkIn(context.walkInId).then((w: any) => {
        if (w?.customer) dispatch({ type: 'setCustomer', customer: w.customer })
        if (w?.assignedStaffUserId) dispatch({ type: 'setDefaultBarber', staffUserId: w.assignedStaffUserId })
      })
    } else if (context.kind === 'preselected-customer') {
      checkout.getCustomer(context.customerId).then((c: any) => {
        if (c) dispatch({ type: 'setCustomer', customer: c })
      })
    }
  }, [context, checkout])

  // Customer search
  const searchCustomers = async (query: string) => {
    if (!query.trim()) { setCustomerResults([]); return }
    const results = await checkout.searchCustomers(query)
    setCustomerResults(results)
  }

  const createCustomer = async (input: { fullName: string; phone?: string; email?: string }) => {
    return await checkout.findOrCreateCustomer(input)
  }

  // Submit
  const submit = async (payment: { method: 'CASH' | 'CARD' | 'TRANSFER'; tipCents: number }): Promise<SaleResult | null> => {
    if (!locationId || cartState.lines.length === 0 || submitting) return null
    if (!registerSessionId) {
      setError('No hay caja abierta. Abre caja primero.')
      return null
    }
    setSubmitting(true)
    setError(null)
    try {
      const customerId = cartState.customer?.id ?? (await checkout.findOrCreateMostradorCustomer()).id
      const result = await checkout.createPOSSale({
        locationId,
        registerSessionId,
        customerId,
        staffUserId: cartState.defaultBarberId,
        completeWalkInId: context?.kind === 'walk-in' ? context.walkInId : undefined,
        items: cartState.lines.map((l) => ({
          serviceId: l.kind === 'service' ? l.itemId : null,
          productId: l.kind === 'product' ? l.itemId : null,
          catalogComboId: l.kind === 'combo' ? l.itemId : null,
          qty: l.qty,
          unitPriceCents: l.unitPriceCents,
          staffUserId: l.staffUserId,
        })),
        tipCents: payment.tipCents,
        paymentMethod: payment.method,
      })
      setSuccessSale(result as SaleResult)
      dispatch({ type: 'clear' })
      return result as SaleResult
    } catch (e) {
      setError((e as { message?: string }).message ?? 'No se pudo cobrar.')
      return null
    } finally {
      setSubmitting(false)
    }
  }

  return {
    context,
    catalogItems,
    categories,
    barbers,
    cartState,
    dispatch,
    customerResults,
    searchCustomers,
    createCustomer,
    submit,
    submitting,
    error,
    successSale,
    setSuccessSale,
    registerSessionId,
  }
}
```

This hook depends on the repository exposing `getServices`, `getProducts`, `getCombos`, `getCategories`, `getBarbers`, `getWalkIn`, `getCustomer`, `searchCustomers`, `findOrCreateCustomer`, `findOrCreateMostradorCustomer`, `createPOSSale`. If any of those don't exist on the v1 repository, surface — they likely do but may need wiring. Verify before implementing the page in Task 11.

`register.getActiveSession(locationId)` is part of the existing `useActiveRegisterSession` v1 hook — check if it's exposed on the register repository directly. If not, add a thin wrapper.

- [ ] **Step 5: Verify build**

```bash
npx tsc --noEmit -p tsconfig.app.json
```

If `repository` methods are missing, surface and add minimal wrappers. Do NOT skip — the integration in Task 11 needs them.

- [ ] **Step 6: Commit**

```bash
git add src/features/checkout/application/useCheckout.ts src/features/checkout/data/checkout.repository.ts
git commit -m "feat(checkout): useCheckout hook + Mostrador repository wrapper"
```

Stay on `feat/pos-checkout`.

---

## Task 11: CheckoutPage orchestrator + integration tests (TDD)

**Files:**
- Create: `src/features/checkout/presentation/CheckoutPage.tsx` (NEW — replaces v1 file with same name in Task 12)
- Create: `src/features/checkout/presentation/CheckoutPage.test.tsx`

This task DEPENDS on API Task 1 having merged so the codegen reflects `findOrCreateMostradorCustomer`. If not, BLOCK.

- [ ] **Step 1: Verify API merge**

```bash
cd /Users/insightcollective/Documents/Code/BienBravo/bienbravo-pos
grep "findOrCreateMostradorCustomer" src/core/graphql/generated/graphql.ts
```

If grep returns nothing, the codegen hasn't picked up the API change. Run `npm run sync-schema && npm run codegen` and try again. If still missing, the API PR hasn't merged. BLOCK and surface.

- [ ] **Step 2: Write the failing tests** (long integration tests using MockedProvider)

This step is LONG — 6 tests. Create `src/features/checkout/presentation/CheckoutPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CheckoutPage } from './CheckoutPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() { return MOCK_VIEWER }
}

const SVC_CORTE = { id: 'svc-corte', name: 'Corte', priceCents: 28000, isActive: true, isAddOn: false, imageUrl: null, categoryId: 'cat-cortes' }
const PROD_SHAMPOO = { id: 'prod-shampoo', name: 'Shampoo', priceCents: 25000, sku: null, imageUrl: null, categoryId: 'cat-prod', stockQty: 10 }
const BARBERS = [
  { id: 'b1', fullName: 'Antonio', photoUrl: null },
  { id: 'b2', fullName: 'Beto', photoUrl: null },
  { id: 'b3', fullName: 'Carlos', photoUrl: null },
]
const SESSION = { id: 'sess-1', status: 'OPEN' }
const MOSTRADOR = { id: 'cust-mostrador', fullName: 'Mostrador' }

function makeRepos() {
  const repos = createMockRepositories()
  repos.checkout.getServices = vi.fn().mockResolvedValue([SVC_CORTE])
  repos.checkout.getProducts = vi.fn().mockResolvedValue([PROD_SHAMPOO])
  repos.checkout.getCombos = vi.fn().mockResolvedValue([])
  repos.checkout.getCategories = vi.fn().mockResolvedValue([
    { id: 'cat-cortes', name: 'Cortes', sortOrder: 1 },
    { id: 'cat-prod', name: 'Productos', sortOrder: 2 },
  ])
  repos.checkout.getBarbers = vi.fn().mockResolvedValue(BARBERS)
  repos.checkout.searchCustomers = vi.fn().mockResolvedValue([])
  repos.checkout.findOrCreateCustomer = vi.fn().mockResolvedValue({ id: 'c-new', fullName: 'New' })
  repos.checkout.findOrCreateMostradorCustomer = vi.fn().mockResolvedValue(MOSTRADOR)
  repos.checkout.createPOSSale = vi.fn().mockResolvedValue({
    id: 'sale-1', totalCents: 28000, paymentMethod: 'CASH',
    createdAt: '2026-05-04T16:00:00Z', customer: MOSTRADOR,
    items: [{ id: 'i1', name: 'Corte', qty: 1, unitPriceCents: 28000, totalCents: 28000, staffUser: BARBERS[0] }],
  })
  repos.register.getActiveSession = vi.fn().mockResolvedValue(SESSION)
  return repos
}

describe('CheckoutPage (integration)', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('free sale happy path: catalog → cart → CASH → success → receipt', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findByText('Corte')
    await user.click(screen.getByText('Corte'))
    expect(screen.getByText(/cobrar/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cobrar.*\$280/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => {
      expect(repos.checkout.createPOSSale).toHaveBeenCalled()
      expect(repos.checkout.findOrCreateMostradorCustomer).toHaveBeenCalled()
    })
  })

  it('walk-in completion: pre-fills customer + barber from WalkIn', async () => {
    const repos = makeRepos()
    repos.checkout.getWalkIn = vi.fn().mockResolvedValue({
      id: 'w1',
      customer: { id: 'c-papa', fullName: 'Papá Test', email: null, phone: null },
      assignedStaffUserId: 'b2',
    })
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeWalkInId=w1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/papá test/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/beto/i)).toBeInTheDocument())
  })

  it('multi-barber split sale: 3 cortes + per-line barber → mutation has 3 distinct staffUserIds', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findByText('Corte')
    await user.click(screen.getByText('Corte'))
    await user.click(screen.getByText('Corte'))
    await user.click(screen.getByText('Corte'))
    // Now 3 lines exist. Tap line 2 + 3 to swap barber.
    const lineBarberButtons = screen.getAllByRole('button', { name: /antonio.*↓/i })
    await user.click(lineBarberButtons[1])
    await user.click(screen.getByLabelText('Beto'))
    const remainingButtons = screen.getAllByRole('button', { name: /antonio.*↓|beto.*↓/i })
    await user.click(remainingButtons[remainingButtons.length - 1])
    await user.click(screen.getByLabelText('Carlos'))
    // Cobrar
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => {
      const call = (repos.checkout.createPOSSale as any).mock.calls[0][0]
      const staffUserIds = call.items.map((i: any) => i.staffUserId)
      expect(new Set(staffUserIds).size).toBe(3)
    })
  })

  it('customer skip → Mostrador fallback used at submit', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findByText('Corte')
    await user.click(screen.getByText('Corte'))
    // Don't touch customer chip
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => {
      expect(repos.checkout.findOrCreateMostradorCustomer).toHaveBeenCalled()
      const call = (repos.checkout.createPOSSale as any).mock.calls[0][0]
      expect(call.customerId).toBe(MOSTRADOR.id)
    })
  })

  it('stock insufficient error: shows toast + does not navigate away', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.checkout.createPOSSale = vi.fn().mockRejectedValue(new Error('Stock insuficiente: Shampoo'))
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findByText('Shampoo')
    await user.click(screen.getByText('Shampoo'))
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => expect(screen.getByText(/stock insuficiente/i)).toBeInTheDocument())
  })

  it('no open register session: shows error + suggests opening caja', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.register.getActiveSession = vi.fn().mockResolvedValue(null)
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findByText('Corte')
    await user.click(screen.getByText('Corte'))
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => expect(screen.getByText(/no hay caja abierta/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

`npm test -- CheckoutPage.test` → FAIL (CheckoutPage doesn't exist yet).

- [ ] **Step 4: Implement CheckoutPage**

Create `src/features/checkout/presentation/CheckoutPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SuccessSplash } from '@/shared/pos-ui/SuccessSplash'
import { useCheckout } from '../application/useCheckout'
import { computeTotals } from '../lib/cart'
import { CatalogChips } from './CatalogChips'
import { CatalogGrid } from './CatalogGrid'
import { AtendiendoHeader } from './AtendiendoHeader'
import { BarberSelectorSheet } from './BarberSelectorSheet'
import { CustomerChip } from './CustomerChip'
import { CustomerLookupSheet } from './CustomerLookupSheet'
import { CartList } from './CartList'
import { CartTotals } from './CartTotals'
import { CobrarCTA } from './CobrarCTA'
import { PaymentSheet } from './PaymentSheet'
import { ReceiptScreen } from './ReceiptScreen'

export function CheckoutPage() {
  const navigate = useNavigate()
  const ck = useCheckout()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [barberSheetOpen, setBarberSheetOpen] = useState(false)
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false)
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false)
  const [splashOpen, setSplashOpen] = useState(false)

  // After success, splash for 2s then receipt screen
  useEffect(() => {
    if (ck.successSale && !splashOpen) {
      setSplashOpen(true)
      const t = setTimeout(() => setSplashOpen(false), 2000)
      return () => clearTimeout(t)
    }
  }, [ck.successSale, splashOpen])

  const totals = computeTotals(ck.cartState.lines)
  const defaultBarber = ck.barbers.find((b) => b.id === ck.cartState.defaultBarberId) ?? ck.barbers[0]

  if (splashOpen && ck.successSale) {
    return <SuccessSplash open onComplete={() => setSplashOpen(false)} />
  }

  if (ck.successSale) {
    return (
      <ReceiptScreen
        sale={ck.successSale}
        onListo={() => {
          ck.setSuccessSale(null)
          navigate('/hoy')
        }}
      />
    )
  }

  if (!defaultBarber) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <p className="text-[14px] text-[var(--color-bone-muted)]">Cargando catálogo…</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Catalog (left, 60%) */}
      <div className="flex flex-1 flex-col">
        <CatalogChips
          categories={ck.categories}
          selectedCategoryId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <CatalogGrid
          items={ck.catalogItems}
          selectedCategoryId={selectedCategoryId}
          searchQuery={searchQuery}
          onAdd={(item) => ck.dispatch({ type: 'add', item: { kind: item.kind, itemId: item.id, name: item.name, unitPriceCents: item.priceCents } })}
        />
      </div>

      {/* Cart (right, ~40%) */}
      <div className="flex w-[40%] min-w-[360px] flex-col border-l border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)]">
        <div className="flex flex-col gap-3 p-4">
          <AtendiendoHeader barber={defaultBarber} onTap={() => setBarberSheetOpen(true)} />
          <CustomerChip
            customer={ck.cartState.customer}
            onTap={() => setCustomerSheetOpen(true)}
            onClear={() => ck.dispatch({ type: 'setCustomer', customer: null })}
          />
        </div>
        <CartList
          lines={ck.cartState.lines}
          barbers={ck.barbers}
          onIncQty={(lineId) => ck.dispatch({ type: 'incQty', lineId })}
          onDecQty={(lineId) => ck.dispatch({ type: 'decQty', lineId })}
          onSetBarber={(lineId, barberId) => ck.dispatch({ type: 'setLineBarber', lineId, staffUserId: barberId })}
          onRemove={(lineId) => ck.dispatch({ type: 'removeLine', lineId })}
        />
        <CartTotals subtotalCents={totals.subtotalCents} />
        {ck.error && (
          <div role="alert" className="px-4 py-2">
            <p className="text-[12px] text-[var(--color-bravo)]">{ck.error}</p>
          </div>
        )}
        <CobrarCTA
          totalCents={totals.subtotalCents}
          disabled={ck.cartState.lines.length === 0 || ck.submitting}
          onTap={() => setPaymentSheetOpen(true)}
        />
      </div>

      {/* Sheets */}
      <BarberSelectorSheet
        open={barberSheetOpen}
        barbers={ck.barbers}
        currentBarberId={ck.cartState.defaultBarberId}
        onSelect={(id) => ck.dispatch({ type: 'setDefaultBarber', staffUserId: id })}
        onClose={() => setBarberSheetOpen(false)}
      />
      <CustomerLookupSheet
        open={customerSheetOpen}
        results={ck.customerResults}
        onSearchChange={ck.searchCustomers}
        onSelect={(c) => {
          ck.dispatch({ type: 'setCustomer', customer: c })
          setCustomerSheetOpen(false)
        }}
        onCreate={async (input) => {
          const created = await ck.createCustomer(input)
          ck.dispatch({ type: 'setCustomer', customer: created })
          setCustomerSheetOpen(false)
        }}
        onClose={() => setCustomerSheetOpen(false)}
      />
      <PaymentSheet
        open={paymentSheetOpen}
        totalCents={totals.subtotalCents}
        onClose={() => setPaymentSheetOpen(false)}
        onConfirm={async (input) => {
          const result = await ck.submit(input)
          if (result) setPaymentSheetOpen(false)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 5: Run integration tests**

```bash
npm test -- CheckoutPage.test
```

Expected: 6/6 PASS. If any fail, surface the failure and debug.

Common issues:
- Mock repository methods missing — add them in the mock factory
- `searchCustomers` mock returns empty — that's fine if test doesn't search
- Race conditions on `await screen.findByText` — increase the timeout via `findByText('X', {}, { timeout: 3000 })` if necessary

- [ ] **Step 6: Commit**

```bash
git add src/features/checkout/presentation/CheckoutPage.tsx src/features/checkout/presentation/CheckoutPage.test.tsx
git commit -m "feat(checkout): CheckoutPage orchestrator + 6 integration tests"
```

Stay on `feat/pos-checkout`.

---

## Task 12: Router rewiring + delete v1 files

**Files:**
- Modify: `src/app/router.tsx` (verify import path)
- Modify: `src/features/checkout/index.ts` (barrel export update)
- Delete: 9 v1 files (listed below)

- [ ] **Step 1: Update barrel export**

Open `src/features/checkout/index.ts`. Replace:

```ts
export { CheckoutPage } from './presentation/CheckoutPage'
```

(Drop any other exports if they reference deleted files.)

- [ ] **Step 2: Verify router still uses `@/features/checkout` path**

```bash
grep -n "checkout\|CheckoutPage" src/app/router.tsx
```

The route `{ path: '/checkout', element: <CheckoutPage /> }` should already point at the barrel. No change needed unless it imports from a deeper path.

- [ ] **Step 3: Delete v1 files**

```bash
rm src/features/checkout/presentation/CartBar.tsx
rm src/features/checkout/presentation/CatalogView.tsx
rm src/features/checkout/presentation/CustomerLookup.tsx
rm src/features/checkout/presentation/PaymentView.tsx
rm src/features/checkout/presentation/SuccessView.tsx
rm src/features/checkout/domain/cart.service.ts
rm src/features/checkout/application/useCart.ts
rm src/features/checkout/application/useCatalog.ts
rm src/features/checkout/application/useActiveRegisterSession.ts
```

- [ ] **Step 4: Verify no stale references**

```bash
grep -rn "CartBar\|CatalogView\|CustomerLookup\|PaymentView\|SuccessView\|cart\.service\|useCart\|useCatalog\|useActiveRegisterSession" src/ --include="*.tsx" --include="*.ts" | grep -v "test/"
```

Should return ZERO matches. If any code still imports the deleted modules, fix before continuing.

- [ ] **Step 5: Verify build + full test**

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run build
npm test
```

All clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/checkout/index.ts src/app/router.tsx
git rm src/features/checkout/presentation/CartBar.tsx
git rm src/features/checkout/presentation/CatalogView.tsx
git rm src/features/checkout/presentation/CustomerLookup.tsx
git rm src/features/checkout/presentation/PaymentView.tsx
git rm src/features/checkout/presentation/SuccessView.tsx
git rm src/features/checkout/domain/cart.service.ts
git rm src/features/checkout/application/useCart.ts
git rm src/features/checkout/application/useCatalog.ts
git rm src/features/checkout/application/useActiveRegisterSession.ts
git status
git commit -m "refactor(checkout): drop v1 files; v2 CheckoutPage is the canonical /checkout"
```

Stay on `feat/pos-checkout`.

---

## Task 13: Final verification + push + PR

**Files:** none

- [ ] **Step 1: Confirm commit history**

```bash
git log --oneline master..HEAD | head -25
```

Expected: ~16-20 commits (1 spec + 1 plan + Tasks 2-12 + any review fixups).

- [ ] **Step 2: Full gate**

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run build
npm test
```

Expected: tsc clean, build clean, all tests pass (~205 + ~50 new = ~255).

- [ ] **Step 3: Manual smoke (iPad landscape 1180×820)**

Run `npm run dev`. Walk through 10 scenarios from the spec's testing section: free sale, walk-in, customer search, multi-barber, cash change, card+tip, receipt print, error scenarios.

If any regression, fix in a separate commit.

- [ ] **Step 4: Push branch**

```bash
git push -u origin feat/pos-checkout
```

If push fails, surface — DO NOT force.

- [ ] **Step 5: Open PR**

```bash
gh pr create --title "feat(pos): Checkout sub-#4b" --body "$(cat <<'EOF'
## Summary

Sub-project #4b — replaces v1 POS checkout with single-screen catalog+cart in editorial v2 language. Per-line barber attribution (consuming sub-#4a). Customer optional via "Mostrador" tenant-level fallback. Receipt screen with print (email deferred to sub-#4c).

## Cross-repo

Depends on:
- bienbravo-api PR #12 (sub-#4a per-line attribution) — MUST be merged
- bienbravo-api findOrCreateMostradorCustomer mutation — MUST be merged

## What's new

**Catalog (left panel)**:
- \`<CatalogChips>\` — search bar + category chips
- \`<CatalogTile>\` — service/product/combo tile with stock badges
- \`<CatalogGrid>\` — grid with category + search filtering

**Cart (right panel, sticky)**:
- \`<AtendiendoHeader>\` — default barbero selector
- \`<CustomerChip>\` — optional chip with × to clear
- \`<CartList>\` + \`<CartLineRow>\` — line with qty stepper + per-line barber chip
- \`<BarberPickerInline>\` — horizontal avatar picker that expands inline
- \`<CartTotals>\` + \`<CobrarCTA>\`

**Sheets**:
- \`<BarberSelectorSheet>\` — full barber grid
- \`<CustomerLookupSheet>\` — search + create flow
- \`<PaymentSheet>\` — method picker + cash change helper + tip

**Receipt**:
- \`<ReceiptScreen>\` — print-friendly with @media print CSS
- "Enviar por correo" button disabled (sub-#4c)

**Domain/lib**:
- \`cart.ts\` — types + reducer + pure functions

**Hook**:
- \`useCheckout\` — orchestrates catalog fetching, context resolution, cart state, submit

**Routing**:
- \`/checkout\` flips from v1 to v2 (path unchanged)

**Deleted**:
- 9 v1 files (~1300 LoC)

## Verification

- \`npx tsc --noEmit -p tsconfig.app.json\` — clean
- \`npx vitest run\` — ~50 new tests
- \`npm run build\` — clean

## Known v1 limitations (follow-ups)

- Email receipts deferred to sub-#4c (button disabled with tooltip)
- Appointment completion route deferred (pre-paid model — no operational need)
- Split payments (multi-method) deferred

## Test plan

- [ ] Manual smoke: free sale + walk-in + customer search + multi-barber + cash change + card+tip + receipt print
- [ ] CI green
- [ ] No regression in /caja, /hoy, agenda, etc.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If the PR opens successfully, report the URL.

- [ ] **Step 6: Final report**

Report:
- Commit count + brief log
- Test counts (passing/total, new vs existing)
- Build/tsc status
- PR URL
- Any concerns

---

## Verification (per-task gate)

Each task ends in a passing commit. Per task:
- `npm run lint` — 0 NEW errors in changed files
- `npx tsc --noEmit -p tsconfig.app.json` — clean
- `npm test` — all tests pass
- `npm run build` — clean

After Task 13:
- 10-step manual smoke completes successfully
- PR opened
- No regression in sub-#3, sub-#2 D, sub-#1 features

---

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| Sub-#4a not merged when POS Task 11 starts | Task 11 Step 1 guards via grep on the codegen file. BLOCKS if missing. |
| `findOrCreateMostradorCustomer` mutation not merged when codegen runs | Task 10 guards via grep. BLOCKS if missing. |
| Repository method names don't match existing patterns | Task 10 step 5 has a spot-check. Use existing v1 patterns (`searchCustomers`, etc.) as reference. |
| Per-line barber picker UX feels slow on real iPad | Inline expand with no popup is the lightest possible. Memoize avatar rendering if needed. |
| Cart state lost on accidental nav | Acceptable for v1 (matches v1 behavior). Follow-up if real complaints. |
| Integration tests time out due to many awaits | Use `findByText` with explicit timeout (3000ms) per assertion. Mock all repository methods. |

---

## Decisions captured (in spec)

- Single-screen + sticky right rail cart with "Atendiendo:" header
- Category chips + single mixed grid + search
- Customer optional with Mostrador fallback (tenant-level Customer record)
- Per-line barber picker via inline expand with horizontal avatars
- Payment sheet with cash-change helper + tip on card/transfer only
- Receipt screen with `window.print()` (email deferred)
- Sub-#4a is a hard prerequisite

---

## Self-review notes (for the controller)

After drafting, re-checked these spec requirements:

- ✅ 3 entry contexts (free / preselected-customer / walk-in) → useCheckout (Task 10)
- ✅ Catalog chips + grid → Tasks 3
- ✅ Atendiendo + customer chip → Tasks 4-5
- ✅ Cart list + per-line barber → Tasks 6-7
- ✅ Payment sheet + cash + tip → Task 8
- ✅ Receipt print → Task 9 (email deferred per spec scope decision)
- ✅ Mostrador fallback → API Task 1 + repository wrapper Task 10
- ✅ 6 integration tests + ~50 unit tests → Task 11
- ✅ Cleanup of v1 files → Task 12
- ✅ Final verify + PR → Task 13

No placeholders, no TBDs. Every code block is complete.
