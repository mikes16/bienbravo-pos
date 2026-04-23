# GraphQL Codegen in POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `graphql-codegen` in `bienbravo-pos` with `client-preset`, replacing every hand-written `gql` tag across 7 files with typed `graphql()` calls so Apollo hooks auto-infer data and variables. Also bootstraps minimal CI for this repo (currently has none).

**Architecture:** 7 files (6 repositories + 1 page component) switch from `import { gql } from '@apollo/client'` to `import { graphql } from '@/core/graphql/generated'`. The generated output lives under `src/core/graphql/generated/` — the `core` layer alongside `src/core/apollo/client.ts`, respecting the clean-architecture rule that features depend inward on core, never the reverse. Codegen reads a committed `schema.graphql` synced from sibling `../bienbravo-api`. A new `.github/workflows/ci.yml` is added since this repo has no existing CI. Spec: [`../../../../bienbravo-api/docs/superpowers/specs/2026-04-22-graphql-codegen-frontends-design.md`](../../../../bienbravo-api/docs/superpowers/specs/2026-04-22-graphql-codegen-frontends-design.md).

**Tech Stack:** Vite 7, React 19, TypeScript 5.9, Apollo Client 4.1.5, Vitest 3, `@graphql-codegen/cli` 5, `@graphql-codegen/client-preset` 4.

---

## File Structure

**Create:**
- `codegen.ts` — graphql-codegen config at repo root
- `schema.graphql` — committed copy of API schema (synced from sibling `bienbravo-api`)
- `src/core/graphql/generated/` — codegen output directory (committed)
- `scripts/sync-schema.mjs` — cross-platform copy script
- `.github/workflows/ci.yml` — **new** CI workflow (this repo has no CI yet)

**Modify:**
- `package.json` — add dev deps + three scripts
- `src/core/auth/auth.repository.ts` — swap `gql` for `graphql()`
- `src/features/agenda/data/agenda.repository.ts` — swap `gql` for `graphql()`
- `src/features/checkout/data/checkout.repository.ts` — swap `gql` for `graphql()`
- `src/features/clock/data/clock.repository.ts` — swap `gql` for `graphql()`
- `src/features/register/data/register.repository.ts` — swap `gql` for `graphql()`
- `src/features/walkins/data/walkins.repository.ts` — swap `gql` for `graphql()`
- `src/features/home/presentation/HomePage.tsx` — swap `gql` for `graphql()`
- `CLAUDE.md` — add "How to update types" section

**No changes to:**
- `src/core/apollo/client.ts` — `InMemoryCache` typePolicies work as-is with `TypedDocumentNode`
- `src/core/repositories/registry.ts` — imports Apollo types only, not `gql`

---

## Branch Setup

- [ ] **Step 0.1: Create branch**

Run from repo root:
```bash
git checkout main
git pull
git checkout -b feature/graphql-codegen
```

If the default branch is `master` (check with `git branch -a | head`), use `master` in the commands above.

- [ ] **Step 0.2: Verify sibling API has emitted schema**

Run:
```bash
ls ../bienbravo-api/src/graphql/schema.generated.graphql
```

Expected: file exists. If missing, sub-project 1 (API code-first migration) hasn't landed yet — stop and wait for it.

---

## Task 1: Install codegen dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1.1: Install dev dependencies**

Run:
```bash
npm install --save-dev @graphql-codegen/cli@^5.0.7 @graphql-codegen/client-preset@^4.5.1
```

Expected: both added to `devDependencies`. `package-lock.json` regenerated.

- [ ] **Step 1.2: Commit dependency installation**

```bash
git add package.json package-lock.json
git commit -m "chore(codegen): add graphql-codegen cli + client-preset"
```

---

## Task 2: Add sync-schema script

**Files:**
- Create: `scripts/sync-schema.mjs`

- [ ] **Step 2.1: Create sync script**

Create `scripts/sync-schema.mjs`:
```js
#!/usr/bin/env node
// Copies the API's emitted schema into this repo's committed copy.
// Run before `npm run codegen` whenever the API schema changes.
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const src = resolve(process.cwd(), '..', 'bienbravo-api', 'src', 'graphql', 'schema.generated.graphql')
const dst = resolve(process.cwd(), 'schema.graphql')

if (!existsSync(src)) {
  console.error(`sync-schema: source not found at ${src}`)
  console.error('Is ../bienbravo-api checked out as a sibling?')
  process.exit(1)
}

copyFileSync(src, dst)
console.log(`sync-schema: ${src} → ${dst}`)
```

- [ ] **Step 2.2: Add `sync-schema` script to package.json**

Modify `package.json` `"scripts"` block to include:
```json
"sync-schema": "node scripts/sync-schema.mjs",
```

- [ ] **Step 2.3: Test it**

Run:
```bash
npm run sync-schema
```

Expected output: `sync-schema: .../bienbravo-api/src/graphql/schema.generated.graphql → .../bienbravo-pos/schema.graphql`. File `schema.graphql` now exists at repo root.

- [ ] **Step 2.4: Commit**

```bash
git add scripts/sync-schema.mjs package.json schema.graphql
git commit -m "chore(codegen): add sync-schema script and commit initial schema snapshot"
```

---

## Task 3: Add codegen config and run initial codegen

**Files:**
- Create: `codegen.ts`

- [ ] **Step 3.1: Create codegen config**

Create `codegen.ts` at repo root:
```ts
import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: 'schema.graphql',
  documents: ['src/**/*.{ts,tsx}'],
  generates: {
    'src/core/graphql/generated/': {
      preset: 'client',
      config: {
        useFragmentMasking: false,
      },
    },
  },
  ignoreNoDocuments: true,
}

export default config
```

Note: `ignoreNoDocuments: true` allows codegen to succeed even before any `graphql()` calls exist. Will be tightened after Task 4 migrates the first file.

- [ ] **Step 3.2: Add codegen scripts to package.json**

Modify `package.json` `"scripts"` block to include:
```json
"codegen": "graphql-codegen --config codegen.ts",
"codegen:watch": "graphql-codegen --config codegen.ts --watch",
```

- [ ] **Step 3.3: Run initial codegen**

Run:
```bash
npm run codegen
```

Expected: succeeds, creates `src/core/graphql/generated/` with at minimum `graphql.ts`, `gql.ts`, `fragment-masking.ts`, `index.ts`. With `ignoreNoDocuments: true` and no operations yet using `graphql()`, the generated artifacts will contain only base scaffolding — that's fine.

- [ ] **Step 3.4: Commit**

```bash
git add codegen.ts package.json src/core/graphql/generated/
git commit -m "feat(codegen): add codegen.ts and initial generated scaffold"
```

---

## Task 4: Migrate first file (walkins.repository.ts) — the template

**Files:**
- Modify: `src/features/walkins/data/walkins.repository.ts`

This task validates the pattern on one representative file (the largest in the repo, with 5 operations) before fanning out. If `client-preset` config needs tuning, surface it here and fix in Task 3 before proceeding.

- [ ] **Step 4.1: Rewrite walkins.repository.ts**

Modify `src/features/walkins/data/walkins.repository.ts`. Change only the import and the tag, keep all GraphQL string bodies byte-for-byte identical.

Before:
```ts
import { gql, type ApolloClient } from '@apollo/client'

const WALKINS_QUERY = gql`query PosWalkIns($locationId: ID!) { ... }`
```

After:
```ts
import { type ApolloClient } from '@apollo/client'
import { graphql } from '@/core/graphql/generated'

const WALKINS_QUERY = graphql(`query PosWalkIns($locationId: ID!) { ... }`)
```

- Remove `gql` from the `@apollo/client` named import (keep `type ApolloClient` and any other imports)
- Add `import { graphql } from '@/core/graphql/generated'` on the next line
- Every `gql\`…\`` becomes `graphql(\`…\`)` — note the parentheses
- The GraphQL string body inside is byte-for-byte identical

- [ ] **Step 4.2: Regenerate types**

Run:
```bash
npm run codegen
```

Expected: `src/core/graphql/generated/graphql.ts` now contains types for the 5 operations declared in `walkins.repository.ts` (e.g. `PosWalkInsQuery`, `PosWalkInsQueryVariables`, etc.).

- [ ] **Step 4.3: Build (typecheck + bundle)**

Run:
```bash
npm run build
```

Expected: passes. This repo's `build` script runs `tsc -b && vite build`, so it catches typecheck regressions too. If any consumer of `WALKINS_QUERY` breaks, it likely indicates a real pre-existing mismatch now that types are tighter. Fix the consumer before proceeding.

- [ ] **Step 4.4: Run unit tests**

Run:
```bash
npm test
```

Expected: all existing vitest suites pass. If any test imports `WALKINS_QUERY`, it should keep working — `TypedDocumentNode` is structurally compatible with `DocumentNode`.

- [ ] **Step 4.5: Commit**

```bash
git add src/features/walkins/data/walkins.repository.ts src/core/graphql/generated/
git commit -m "feat(codegen): migrate walkins.repository to typed graphql() tag"
```

---

## Task 5: Migrate agenda.repository.ts + checkout.repository.ts

**Files:**
- Modify: `src/features/agenda/data/agenda.repository.ts`
- Modify: `src/features/checkout/data/checkout.repository.ts`

Same mechanical transform as Task 4.

- [ ] **Step 5.1: Rewrite agenda.repository.ts** (pattern from Task 4)
- [ ] **Step 5.2: Rewrite checkout.repository.ts** (pattern from Task 4)

- [ ] **Step 5.3: Regenerate, build, test**

```bash
npm run codegen
npm run build
npm test
```

Expected: all three pass.

- [ ] **Step 5.4: Commit**

```bash
git add src/features/agenda/data/agenda.repository.ts src/features/checkout/data/checkout.repository.ts src/core/graphql/generated/
git commit -m "feat(codegen): migrate agenda/checkout repositories to typed graphql()"
```

---

## Task 6: Migrate clock.repository.ts + register.repository.ts + auth.repository.ts

**Files:**
- Modify: `src/features/clock/data/clock.repository.ts`
- Modify: `src/features/register/data/register.repository.ts`
- Modify: `src/core/auth/auth.repository.ts`

- [ ] **Step 6.1: Rewrite clock.repository.ts** (pattern from Task 4)
- [ ] **Step 6.2: Rewrite register.repository.ts** (pattern from Task 4)
- [ ] **Step 6.3: Rewrite auth.repository.ts** (pattern from Task 4)

- [ ] **Step 6.4: Regenerate, build, test**

```bash
npm run codegen
npm run build
npm test
```

Expected: all three pass.

- [ ] **Step 6.5: Commit**

```bash
git add src/features/clock/data/clock.repository.ts src/features/register/data/register.repository.ts src/core/auth/auth.repository.ts src/core/graphql/generated/
git commit -m "feat(codegen): migrate clock/register/auth repositories to typed graphql()"
```

---

## Task 7: Migrate HomePage.tsx (inline operations in a component)

**Files:**
- Modify: `src/features/home/presentation/HomePage.tsx`

This file is unique — it defines `STAFF_METRICS_TODAY_QUERY` and `SALES_ACTIVITY_QUERY` inline in a React component. Same mechanical transform: swap the `gql` import for `graphql` from `@/core/graphql/generated`, and `gql\`...\`` → `graphql(\`...\`)`.

- [ ] **Step 7.1: Rewrite HomePage.tsx**

Change the top-of-file imports:

Before:
```tsx
import { useState, useEffect } from 'react'
import { gql } from '@apollo/client'
import { useApolloClient } from '@apollo/client/react'
```

After:
```tsx
import { useState, useEffect } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { graphql } from '@/core/graphql/generated'
```

Then change each `gql\`...\`` to `graphql(\`...\`)` with the body unchanged.

- [ ] **Step 7.2: Regenerate, build, test**

```bash
npm run codegen
npm run build
npm test
```

Expected: all three pass.

- [ ] **Step 7.3: Commit**

```bash
git add src/features/home/presentation/HomePage.tsx src/core/graphql/generated/
git commit -m "feat(codegen): migrate HomePage inline queries to typed graphql()"
```

---

## Task 8: Verify no leftover `gql` usage and tighten config

**Files:**
- Verify: entire `src/` tree
- Modify: `codegen.ts`

- [ ] **Step 8.1: Search for leftover `gql` imports**

Run:
```bash
grep -rn "import { gql" src/ || echo "clean"
grep -rn "gql," src/ | grep "@apollo/client" || echo "clean"
```

Expected: both print `clean`. If any remain, swap them to `graphql()` from `@/core/graphql/generated`, rerun codegen + build + test.

- [ ] **Step 8.2: Tighten codegen config**

Modify `codegen.ts` — change `ignoreNoDocuments: true` to `ignoreNoDocuments: false` so future PRs that accidentally drop every operation fail loudly.

```ts
ignoreNoDocuments: false,
```

- [ ] **Step 8.3: Full verification pass**

Run in order:
```bash
npm run codegen   # should produce no diff
npm run lint      # should pass
npm run build     # should pass (includes typecheck via tsc -b)
npm test          # should pass
```

All four must succeed.

- [ ] **Step 8.4: Commit**

```bash
git add codegen.ts
git commit -m "chore(codegen): enforce ignoreNoDocuments=false after migration"
```

---

## Task 9: Bootstrap CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

This repo has no `.github/` directory yet. We create a minimal workflow that runs lint, build, tests, **and** the codegen-drift check. Structure mirrors `bienbravo-admin/.github/workflows/ci.yml` plus the new codegen step.

- [ ] **Step 9.1: Create the workflow file**

Create `.github/workflows/ci.yml`:
```yaml
name: POS CI

on:
  pull_request:
  push:
    branches: [main, master]

jobs:
  build-lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Verify GraphQL codegen is up to date
        run: |
          npm run codegen
          git diff --exit-code schema.graphql src/core/graphql/generated/
      - run: npm run lint
      - run: npm run build
      - run: npm test
```

Note: the codegen step does **not** run `sync-schema` first — it reads the committed `schema.graphql`. Schema-sync discipline is a PR-review convention per the design spec, not a CI enforcement.

- [ ] **Step 9.2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add workflow with lint/build/test and codegen-drift check"
```

---

## Task 10: Document the sync-then-codegen workflow

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 10.1: Add "GraphQL types" section to CLAUDE.md**

Append to `CLAUDE.md` (or insert near top-level sections):
```markdown
## GraphQL types

Types for every query/mutation are generated from the API schema by `graphql-codegen`. They live in `src/core/graphql/generated/` and are committed.

**When the API schema changes:**

1. Make sure `../bienbravo-api` is checked out and has the updated `schema.generated.graphql` committed
2. From this repo:
   ```bash
   npm run sync-schema   # copies API schema → ./schema.graphql
   npm run codegen       # regenerates src/core/graphql/generated/
   ```
3. Commit both the updated `schema.graphql` and the regenerated `src/core/graphql/generated/` files together

**When authoring a new query/mutation:**

Use the `graphql()` function from `@/core/graphql/generated`, not `gql` from `@apollo/client`:

```ts
import { graphql } from '@/core/graphql/generated'

export const MY_QUERY = graphql(`
  query MyQuery($id: ID!) { ... }
`)
```

`useQuery(MY_QUERY)` will auto-infer `data` and `variables` types. Run `npm run codegen:watch` during dev to regenerate on save.

**CI enforcement:** CI runs `npm run codegen` and fails if the committed `src/core/graphql/generated/` differs from what codegen produces. If the CI "codegen drift" check fails on your PR, run `npm run codegen` locally and commit the result.
```

- [ ] **Step 10.2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(codegen): document sync-schema + codegen workflow"
```

---

## Task 11: Smoke-test against a running API

**Files:**
- No code changes; manual verification

- [ ] **Step 11.1: Boot the API locally**

In a separate terminal, from `../bienbravo-api`:
```bash
npm run build && node dist/src/main.js
```

Expected: API comes up at `http://127.0.0.1:3001/graphql`.

- [ ] **Step 11.2: Boot POS**

```bash
npm run dev
```

Expected: Vite dev server comes up. Open the URL.

- [ ] **Step 11.3: Exercise the main flows**

Log in with a staff user that has POS access, then:
- Open the home screen (exercises `STAFF_METRICS_TODAY_QUERY`, `SALES_ACTIVITY_QUERY`)
- Open the agenda (exercises `agenda.repository` queries)
- Create a walk-in (exercises `walkins.repository` mutations)
- Open the register (exercises `register.repository` queries)
- Clock in / out (exercises `clock.repository` mutations)

Each screen should load without console errors. In the editor, hover any Apollo-sourced value and confirm TypeScript sees the generated type, not `any`.

- [ ] **Step 11.4: Take a checkout flow end-to-end**

From an open walk-in, run through checkout (exercises `checkout.repository` mutations). Confirm the sale completes and payment status transitions correctly.

- [ ] **Step 11.5: No commit — smoke test only**

---

## Task 12: Open PR

- [ ] **Step 12.1: Push branch**

```bash
git push -u origin feature/graphql-codegen
```

- [ ] **Step 12.2: Open PR**

Title: `feat(graphql): add graphql-codegen with typed client-preset`

Body:
```markdown
## Summary

Introduces `@graphql-codegen/client-preset` in `bienbravo-pos`. All 7 files that declared GraphQL operations now use the typed `graphql()` function instead of `gql` from `@apollo/client`. Apollo hooks auto-infer data and variables with zero imports at the call site. Also bootstraps CI for this repo (previously had none).

## Verification

- `npm run codegen` succeeds, producing no diff vs committed output
- `npm run build` (which runs `tsc -b && vite build`) passes
- `npm run lint` passes
- `npm test` passes — existing vitest suites unchanged
- New CI workflow runs lint/build/test + codegen-drift check
- Smoke-tested against a locally running `bienbravo-api`: home, agenda, walk-ins, register, clock, checkout all flow through typed data

## Files touched

- `codegen.ts` (new), `scripts/sync-schema.mjs` (new), `schema.graphql` (new, committed)
- `src/core/auth/auth.repository.ts`, `src/core/...` and 5 feature repositories (`gql` → `graphql()`)
- `src/features/home/presentation/HomePage.tsx` (inline operations migrated)
- `src/core/graphql/generated/` (new, committed)
- `.github/workflows/ci.yml` (new — first CI for this repo)
- `CLAUDE.md` (add "GraphQL types" section)

## Test plan

- [ ] Reviewer: pull the branch, `npm ci`, `npm run codegen` — no diff
- [ ] Reviewer: `npm run build` + `npm test` pass
- [ ] Reviewer: boot API + POS locally, take one walk-in from creation to checkout, confirm typed data flows
```

---

## Self-review completed before this plan was handed off

- **Spec coverage:** every acceptance criterion from the spec is covered — sync script (Task 2), committed schema (Task 2), codegen config (Task 3), all 7 call-sites migrated (Tasks 4–7), `gql` imports removed (Task 8), CI check (Task 9 — created fresh since no CI existed), CLAUDE.md update (Task 10), smoke test (Task 11)
- **Rollout ordering:** Task 4 migrates the file with the most operations first as a validation; subsequent tasks fan out
- **No placeholders:** every step has exact commands, exact paths, exact code
- **Type consistency:** `graphql()` function name and `@/core/graphql/generated` import path are identical across every migration task. Using the `@/` alias matches existing imports in the repo (e.g. `@/core/auth/usePosAuth.ts`)
- **CI bootstrap:** this repo had no `.github/workflows/` — Task 9 creates one from scratch rather than extending a non-existent file
