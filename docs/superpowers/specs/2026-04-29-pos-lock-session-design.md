# POS Lock Screen + Sesión — Design

**Status:** Approved (2026-04-29)
**Author:** mlopez@insightcoll.com (with Claude)
**Sub-project:** #1 of the POS rework. Builds on sub-#0 (Visual Language) — consumes foundation tokens + `<PinKeypad>` + `<TouchButton>` + `<TileGrid>` + `<TileButton>` + `<EmptyStateV2>`.

## Goal

Migrate POS lock screen + session lifecycle off v1 visual language to v2, plus operational refinements: pair the device once (kiosk model), remember last barber for fast unlock, soft lockout after 8 wrong PINs with admin override, manager-required PIN setup for new barberos. Cero fricción operacional para cajeros no power-user, sin sacrificar seguridad real.

## Decisiones (post-brainstorm)

| # | Decisión |
|---|---|
| Q1 | **Kiosk model** — sucursal fija al device, paireada UNA sola vez en setup. Lock screen subsequent solo pide barbero + PIN. |
| Q2 | **PIN: 4 dígitos + soft lockout 8 fallas → 60s. Counter server-side. Admin override** vía `resetPosPinAttempts` mutation. |
| Q3 | **Pairing: localStorage + location password.** El password de sucursal del admin es el gate; verificado UNA vez en pairing, después solo barbero+PIN. Cero cambios cross-repo necesarios SOLO para el pairing. |
| Q4 | **Idle timeout: 5 min hardcoded.** El existing `useAutoLock` se mantiene. |
| Q5 | **Hybrid unlock — last barber's PIN screen by default.** localStorage[bb-pos-last-barber-id] tracking. "Otro barbero" link para switch. Logout fuerza barber selector. |
| Q6 | **Barbero sin PIN: manager-required message.** Lock screen shows "PIN no configurado. Pide a tu manager que lo establezca." Defer al admin set_pin flow existente. |

## Out of scope (intencional)

- Modo offline / sync — el iPad necesita conexión
- Hardware-bound device pairing (PosDevice entity con deviceToken JWT) — defer al Sub-Sub-proyecto si security needs grow
- PIN setup self-serve por el barbero — nunca, evita robo de cuenta
- PIN length configurable per location — 4 dígitos hardcoded
- Idle timeout configurable per location — 5 min hardcoded
- Notificación admin cuando lockout dispara — defer hasta tener infra de notifications
- E2E tests con Playwright — defer hasta setup de test infra mayor

## Cross-repo dependency (BLOCKING)

Este sub-proyecto NO puede mergearse a master del POS hasta que un PR del API ship. Detalles abajo en sección "API changes". Order of operations:
1. **API PR** (bienbravo-api): `pinAttempts`/`pinLockedUntil` fields + behavior changes en `staffPinLogin` + `posPinLockoutStatus` query + `resetPosPinAttempts` mutation. Tests.
2. **POS PR** (este sub-#1): consume los nuevos fields/queries. Plan check explícito que el schema del API tiene los fields antes de empezar.
3. **Admin PR** (opcional, paralelo): button "Resetear intentos fallidos" en la pantalla de detalle de staff. Hasta que ship esto, manager puede usar el `set_pin` existente como workaround (cambiar PIN automáticamente clera el counter).

---

## A. Architecture

### State machine del LockPage

```
INITIAL_LOAD
  ├ no viewer + no localStorage[bb-pos-location-id] → PAIRING
  ├ no viewer + locationId guardado → UNLOCK
  ├ viewer + isLocked → UNLOCK
  └ viewer + !isLocked → redirect /home

PAIRING (one-time setup per device)
  ├ Select sucursal de TileGrid → enter location password
  └ verifyLocationAccess(locationId, password) → store in localStorage → UNLOCK

UNLOCK (entry decision based on last-barber-id)
  ├ localStorage[bb-pos-last-barber-id] valid → PIN_ENTRY del último barbero
  └ no last-barber → BARBER_SELECTOR

BARBER_SELECTOR
  ├ Tap barbero hasPosPin → PIN_ENTRY
  ├ Tap barbero !hasPosPin → NO_PIN_MESSAGE
  └ "Cambiar sucursal" link → clear localStorage[bb-pos-location-id] → PAIRING

PIN_ENTRY (per-barbero)
  ├ <PinKeypad length={4} onComplete> → staffPinLogin(email, pin)
  │   ├ Success: store last-barber-id, → /home
  │   ├ INVALID_PIN: reset entry, mostrar "PIN incorrecto" + intentos restantes
  │   └ PIN_LOCKED_OUT: → LOCKED_OUT con lockedUntil del server
  └ "Otro barbero" link → BARBER_SELECTOR

LOCKED_OUT (per-barbero, default 60s)
  ├ Countdown local 1s tick desde lockedUntil
  ├ Polling posPinLockoutStatus(email) cada 5s para detectar admin override
  ├ lockedUntil expira (local OR poll devuelve null) → PIN_ENTRY de ese barbero
  └ "Otro barbero" link → BARBER_SELECTOR

LOGOUT (manual button en PosShell)
  ├ Clear last-barber-id, viewer, llamar logout mutation
  └ → BARBER_SELECTOR (forzado)

IDLE_LOCK (5 min via useAutoLock)
  └ → UNLOCK (con last-barber preservado)
```

### Provider changes (`PosAuthProvider`)

State actual: `viewer / isAuthenticated / isLocked / loading`

Agregar:
- `pinLockedUntil: Date | null` derivado de `viewer.staff` cuando aplica (caso edge — viewer existe pero recently locked).

Acciones inalteradas: `pinLogin / logout / lock / unlock`.

### Repository changes (`auth.repository.ts`)

- `VIEWER_QUERY`: agregar `staff.pinLockedUntil` y `staff.pinAttempts` al selection set
- `STAFF_PIN_LOGIN`: en éxito devuelve viewer normal; en fallo el API throwea typed errors:
  - `INVALID_PIN` con `extensions: { attemptsRemaining: number }`
  - `PIN_LOCKED_OUT` con `extensions: { lockedUntil: ISOString }`
- Nuevo: `POS_PIN_LOCKOUT_STATUS_QUERY(email): { lockedUntil, attemptsRemaining }` para polling

### Files affected

**Modified:**
- `src/features/auth/presentation/LockPage.tsx` — full rewrite (199 LoC → ~120 LoC)
- `src/features/auth/presentation/PinPadView.tsx` — DELETE (replaced by `<PinKeypad>` from foundation)
- `src/features/auth/presentation/BarberSelectorView.tsx` — rewrite (88 LoC → ~60 LoC), use TileGrid
- `src/core/auth/PosAuthProvider.tsx` — minor: surface pinLockedUntil from viewer
- `src/core/auth/auth.repository.ts` — extend queries, new lockout status query, typed errors
- `src/core/auth/auth.types.ts` — `PosStaffUser` += `pinAttempts: number`, `pinLockedUntil: Date | null`
- `src/app/PosShell.tsx` — migrate visual to v2 (sharp corners, editorial tokens, drop bb-color-*)

**Created:**
- `src/features/auth/presentation/LockShell.tsx` — root layout for all lock states
- `src/features/auth/presentation/PairingView.tsx` — first-time pairing
- `src/features/auth/presentation/PinEntryView.tsx` — avatar + PinKeypad + error
- `src/features/auth/presentation/LockoutView.tsx` — countdown + admin override polling
- `src/features/auth/presentation/NoPinMessageView.tsx` — barbero sin PIN message

**Untouched:**
- `src/core/auth/useAutoLock.ts` — keeps 5 min timeout, no changes
- `src/core/auth/usePosAuth.ts` — wrapper hook, no changes

## B. Components

### Reusados de foundation v2 (sub-#0)

| Componente | Uso en lock |
|---|---|
| `<PinKeypad length={4} onComplete>` | PIN entry — replaces v1 PinPadView completely |
| `<TouchButton variant="primary" size="primary">` | "Continuar" después de location password |
| `<TouchButton variant="ghost" size="row">` | Discrete links: "Otro barbero", "Cambiar sucursal" |
| `<TileGrid cols={3}>` | Sucursales y barberos lists |
| `<TileButton title={name} subtitle>` | Tile by sucursal / barbero |
| `<EmptyStateV2>` | Network errors, sin barberos, sin sucursales |

### Nuevos componentes (auth feature)

| Componente | Responsabilidad | Tamaño |
|---|---|---|
| `<LockShell>` | Layout root: bg carbon, brand wordmark "BIENBRAVO" arriba, contenido cambia según state. Sin chrome de PosShell. | ~30 LoC |
| `<PairingView>` | Sucursal selector + password input + Continuar. Maneja loading/error. | ~80 LoC |
| `<BarberSelectorView>` rewrite | Lista de barberos en TileButtons con foto + nombre. Footer link "Cambiar sucursal". | ~60 LoC |
| `<PinEntryView>` | Avatar + nombre + `<PinKeypad>` + error state + footer link "Otro barbero". | ~50 LoC |
| `<LockoutView>` | Avatar + nombre + countdown numeral grande "0:58" + texto + link "Otro barbero". 1s tick + 5s poll. | ~80 LoC |
| `<NoPinMessageView>` | Avatar + nombre + mensaje + link "Otro barbero". | ~40 LoC |
| `<LockPage>` rewrite | Orquestador del state machine. Decide qué view renderizar. | ~120 LoC |

### Reuso de PosShell lock button

El icono lock arriba a la derecha en PosShell ya existe — solo migrar a tokens v2 (sharp corners, `--color-bone-muted`, `--color-cuero-viejo` hover). Acción inalterada: llama `lock()` del provider.

## C. API changes (cross-repo bienbravo-api)

### 1. Schema migration

```prisma
model StaffUser {
  // ... existing
  pinAttempts     Int       @default(0)
  pinLockedUntil  DateTime?
}
```

Migration: `add_pos_pin_lockout_fields`. Default 0/null para staff existentes.

### 2. Modify `staffPinLogin` mutation behavior

Pseudo-flow:

```ts
async staffPinLogin(email, pin4) {
  const staff = findByEmail(email)
  if (!staff || !staff.posPinHash) throw 'INVALID_CREDENTIALS'

  // Check active lockout
  if (staff.pinLockedUntil && staff.pinLockedUntil > now) {
    throw new GraphQLError('PIN_LOCKED_OUT', {
      extensions: { lockedUntil: staff.pinLockedUntil.toISOString() }
    })
  }

  const valid = bcrypt.compare(pin4, staff.posPinHash)
  if (!valid) {
    const attempts = staff.pinAttempts + 1
    const update: any = { pinAttempts: attempts }
    if (attempts >= 8) {
      update.pinLockedUntil = new Date(Date.now() + 60_000)
      update.pinAttempts = 0  // reset for next round after cooldown
    }
    await prisma.staffUser.update({ where: { id: staff.id }, data: update })

    if (attempts >= 8) {
      throw new GraphQLError('PIN_LOCKED_OUT', {
        extensions: { lockedUntil: update.pinLockedUntil.toISOString() }
      })
    }
    throw new GraphQLError('INVALID_PIN', {
      extensions: { attemptsRemaining: 8 - attempts }
    })
  }

  // Success: clear counter + locks
  await prisma.staffUser.update({
    where: { id: staff.id },
    data: { pinAttempts: 0, pinLockedUntil: null }
  })
  // ...continue with normal login
}
```

### 3. Update `Viewer.staff` GraphQL type

Agregar `pinLockedUntil: DateTime` (nullable) y `pinAttempts: Int!` al type `Staff` exportado en `Viewer.staff`. Tests check that the viewer query selects them.

### 4. New query: `posPinLockoutStatus`

```graphql
type PosPinLockoutStatus {
  lockedUntil: DateTime  # null if not locked
  attemptsRemaining: Int!
}

type Query {
  posPinLockoutStatus(email: String!): PosPinLockoutStatus!
}
```

- Public (sin auth required) — el lock screen no tiene viewer logueado
- Rate limit estricto (e.g., 10 reqs/min/IP) para prevenir email enumeration
- Email no existente → devolver `{ lockedUntil: null, attemptsRemaining: 8 }` (no leak)

### 5. New mutation: `resetPosPinAttempts`

```graphql
type Mutation {
  resetPosPinAttempts(staffUserId: ID!): Boolean!
}
```

- Permission: `admin.staff.set_pin` (reusado)
- Resetea pinAttempts=0, pinLockedUntil=null
- Manager from admin app calls this

### 6. Tests en bienbravo-api

- 8 wrong PINs → lockout
- Lockout dura 60s, después permite reintento
- PIN correcto resetea attempts a 0
- `resetPosPinAttempts` clera state
- `posPinLockoutStatus` devuelve null si not locked, fecha si locked
- Email enumeration mitigation: nonexistent email → null + max attempts

**Estimación API PR:** ~3 archivos modificados + 1 migration + ~300 LoC.

## D. Error handling + edge cases

### Network errors
- Apollo error en cualquier query/mutation → `<EmptyStateV2>` con mensaje genérico + retry button. Permanecer en state actual.
- iPad sin WiFi → POS no permite login offline en este sub-#1.

### Datos stale en localStorage
- `bb-pos-location-id` apunta a sucursal eliminada/inactiva → `getBarbers` falla → EmptyStateV2 "Esta sucursal ya no está disponible. Cambia." + button → PAIRING. Clear key.
- `bb-pos-last-barber-id` apunta a barbero deactivado o no en location actual → silent fallback a BARBER_SELECTOR. Clear key.
- `bb-pos-last-barber-id` apunta a barbero que perdió `hasPosPin` → silent fallback a BARBER_SELECTOR.

### PIN errors
- Wrong PIN, attempts < 8 → "PIN incorrecto" + caption pequeño "X intentos restantes". Reset PinKeypad input. Avatar shake animation 200ms.
- Wrong PIN, attempts >= 8 → server throws `PIN_LOCKED_OUT` con `lockedUntil`. POS transiciona a LockoutView.
- Network timeout durante PIN submit → "Sin conexión, vuelve a intentar". Permitir retry.

### Lockout edge cases
- `lockedUntil` ya en el pasado al recibirlo (clock skew) → tratar como expirado. Volver a PIN_ENTRY.
- Polling `posPinLockoutStatus` falla por red → seguir countdown local sin override remoto.
- Admin override mid-countdown → next poll regresa `lockedUntil: null` → POS sale de LOCKED_OUT en max 5s.
- iPad screen lock + reabrir → al volver del background, refetch `posPinLockoutStatus` y recalcular countdown desde el server, no del local time.

### Pairing edge cases
- Wrong location password → "Contraseña incorrecta" + reset input. Sin lockout.
- Sucursal sin password configurado → `verifyLocationAccess` rechaza siempre. "Esta sucursal aún no está activada para POS".
- Múltiples taps al "Continuar" → debounce el button (disabled mientras pending).

### Idle timeout edge cases
- Modal abierto → idle dispara igual. Modal queda detrás del lock screen, hay que reabrirlo después.
- Cart con items en checkout → cart NO persiste si cambia barbero. SÍ persiste si el mismo barbero unlockea. Implementación específica vive en sub-#4 (checkout state). Lock solo emite "lock event" sin destruir state.

### Logout vs Lock semantics
- **Logout** (manual button PosShell): clear viewer + clear last-barber-id + clear cart. → BARBER_SELECTOR siempre.
- **Lock** (manual button O idle): set isLocked=true, NO clear viewer ni cart ni last-barber-id. → PIN_ENTRY del último barbero.

### PIN keypad UX
- < 4 dígitos: dots indicators reflejan input.
- = 4 dígitos: auto-submit (PinKeypad onComplete).
- Pending la mutation: dots filled, keypad disabled 600ms.
- Network slow > 600ms: keypad sigue disabled hasta resolve.

## E. Testing strategy

### Unit tests (Vitest + RTL — colocados con cada componente)

| File | Tests |
|---|---|
| `LockShell.test.tsx` | brand wordmark, children render | 2 |
| `PairingView.test.tsx` | locations list / loading / error; password verification flow; cancel; password incorrect | ~6 |
| `BarberSelectorView.test.tsx` | tiles render con photo / fallback; onSelect; onChangeLocation; sin barberos empty state | ~5 |
| `PinEntryView.test.tsx` | avatar + name; PinKeypad onComplete; error state; "Otro barbero" link | ~4 |
| `LockoutView.test.tsx` | countdown render; tick down; reach 0 → onUnlocked; mid-poll cleared → onUnlocked; "Otro barbero" link | ~5 |
| `NoPinMessageView.test.tsx` | message + link | 2 |
| `LockPage.test.tsx` | state machine integration: 6-7 paths through the SM | ~7 |

**Total: ~31 unit tests new.** Combined with existing 46 from sub-#0 = ~77 total.

### Mock strategy
- `auth.repository.ts` mock injected via existing `RepositoryProvider` (pattern already in repo)
- `localStorage` real — jsdom provides it, tests clear before each
- `useAutoLock` not unit-tested (timer faking complexity); covered by manual smoke

### Manual smoke (post-implementation)

- iPad landscape 1180×820 in DevTools
- 8 flows to validate (see acceptance below)

### Out of scope tests
- E2E con Playwright/Cypress — no setup
- Accessibility audit con axe-core — manual spot-check per view
- Visual regression — defer
- API mutation tests — live in bienbravo-api repo

## Acceptance criteria

- [ ] Fresh iPad: pairing flow completes, locationId persists in localStorage
- [ ] Subsequent unlocks skip pairing — directos a PIN_ENTRY (last-barber) o BARBER_SELECTOR
- [ ] PIN keypad usa `<PinKeypad>` foundation (no custom v1 implementation)
- [ ] 8 PINs incorrectos en sucesión → LOCKOUT_VIEW con countdown 60s
- [ ] Admin override (via reset mutation): polling detecta cleared lockout en max 5s
- [ ] Barbero sin PIN: muestra mensaje, link "Otro barbero", no bloquea otros
- [ ] Logout from PosShell → BARBER_SELECTOR (sin last-barber)
- [ ] Lock from PosShell → PIN_ENTRY (con last-barber)
- [ ] Idle 5 min → auto-lock → PIN_ENTRY (con last-barber)
- [ ] Lint + typecheck + `npm test` + `npm run build` clean
- [ ] Cero `bb-color-*` o `rounded-{xl,2xl}` en archivos auth nuevos/modificados
- [ ] WCAG AA: focus rings via global `*:focus-visible`, semantic HTML, screen reader friendly
- [ ] Manual smoke: 8 flows verificados en iPad landscape

## Risks

- **Cross-repo coordination**: API PR debe mergear ANTES del POS PR. Si el API team está blocked / busy, sub-#1 está blocked. Mitigación: el API PR es small (~300 LoC), should ship fast.
- **Email enumeration en `posPinLockoutStatus`**: rate limit + uniform response cubren esto, pero es un nuevo public endpoint. Spec the rate limit explicit.
- **Local clock skew**: el countdown depende del local clock. Si el iPad tiene clock muy off, podría malinterpretar `lockedUntil`. Mitigación: refetch al volver de background, prefer server time.
- **localStorage clearing accidental** (devtools, browser settings): re-pairing toma 30 segundos pero requiere alguien que sepa el password de sucursal. Si solo el manager lo sabe, podría ser inconveniente. Mitigación: documentar el password en una nota física en el counter (manager's responsability).

## Tamaño estimado

- **Nuevo:** 5 components nuevos + 1 LockPage rewrite + repo extensions = ~520 LoC en POS
- **Modificado:** PosShell visual migration, PosAuthProvider minor, auth.types.ts
- **Eliminado:** PinPadView v1 (96 LoC) + LockPage v1 (199 LoC) + BarberSelectorView v1 (88 LoC)
- **Tests:** ~31 unit tests, ~300 LoC
- **API PR (separate repo):** ~300 LoC
- **Net POS:** roughly +300 LoC after deletions

**Estimado: 4-6 PRs en bienbravo-pos** + 1 PR en bienbravo-api.
