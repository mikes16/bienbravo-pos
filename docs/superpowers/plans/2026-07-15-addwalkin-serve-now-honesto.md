# AddWalkInSheet "Atender ya" honesto — Implementation Plan (POS)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Atender ya" nunca reporta éxito cuando el assign falló: se previene el submit con barbero ocupado (revalidación al cambiar de modo + guard) y, si el API aun así rechaza, el error se muestra con su motivo.

**Architecture:** Todo en `src/features/walkins/presentation/AddWalkInSheet.tsx` + su test. Una task.

**Tech Stack:** React 19 + TS 5 + Vitest. Spec: `docs/superpowers/specs/2026-07-15-addwalkin-serve-now-honesto-design.md`.

## Global Constraints

- Repo: `/Users/insightcollective/Documents/Code/BienBravo/bienbravo-pos`, branch `master`, commit directo, mensaje en español.
- Copy visible en español, operadores no técnicos (mensajes simples y accionables).
- NO tocar HOY (`features/home/`), el repo de walkins (`walkins.repository.ts`) ni el API.
- NO push — el director revisa y publica.

---

### Task 1: Revalidación + guard + error visible

**Files:**
- Modify: `src/features/walkins/presentation/AddWalkInSheet.tsx` (cambio de modo, submit ~línea 175-230, catch del assign ~212)
- Test: `src/features/walkins/presentation/AddWalkInSheet.test.tsx` (existente — leer su harness primero)

- [ ] **Step 1: Failing tests.** Agregar al test existente (adaptando a su harness de mocks — los asserts invariantes son estos):

```ts
it('cambiar a "Atender ya" limpia la selección si el barbero está ocupado', async () => {
  // barbero mock con isOccupied: true seleccionado en modo cola →
  // switch a serve_now → el submit exige elegir de nuevo (selección null)
})

it('submit en "Atender ya" con barbero ocupado muestra error y no crea nada', async () => {
  // forzar selección ocupada (mock del refetch devolviéndolo ocupado) →
  // submit → screen.getByRole('alert') con /está ocupado/ y
  // expect(walkins.create).not.toHaveBeenCalled()
})

it('si el assign falla, el toast dice EN COLA con el motivo del API', async () => {
  // walkins.create OK + walkins.assign rechaza con
  // new Error('El barbero ya tiene un servicio en curso.') →
  // addToast llamado con tono error y texto que incluya 'quedó EN COLA' y el motivo;
  // onCreated SÍ llamado
})
```

- [ ] **Step 2:** `npx vitest run src/features/walkins/presentation/AddWalkInSheet.test.tsx` → los 3 nuevos FALLAN.

- [ ] **Step 3: Implementation.**
  1. **Cambio de modo** — donde se setea `mode` a `serve_now` (handler del toggle), agregar: si `selectedBarberId` apunta a un barbero con `isOccupied`, limpiar selección; y disparar re-fetch de barberos para ocupación fresca:

```ts
const switchMode = (next: 'queue' | 'serve_now') => {
  setMode(next)
  if (next === 'serve_now') {
    const sel = allBarbers.find((b) => b.id === selectedBarberId)
    if (sel?.isOccupied) setSelectedBarberId(null)
    // Ocupación fresca al momento de la decisión, no al momento de abrir
    // el sheet (isOccupied cambia con cada cobro/atender del piso).
    if (locationId) {
      void checkout.getAvailableBarbers(locationId).then((b) => {
        setAllBarbers(b.filter((bb) => bb.hasClockedIn))
        // Si el refetch revela que el seleccionado se ocupó, soltarlo también.
        setSelectedBarberId((cur) => (cur && b.find((bb) => bb.id === cur)?.isOccupied ? null : cur))
      }).catch(() => {})
    }
  }
}
```

(Cablear el toggle de modo a `switchMode` en lugar del `setMode` directo. Si el toggle es inline en JSX, extraer.)

  2. **Guard de submit** — junto a la validación existente `if (mode === 'serve_now' && !selectedBarberId)`, agregar:

```ts
const selectedBarber = allBarbers.find((b) => b.id === selectedBarberId)
if (mode === 'serve_now' && selectedBarber?.isOccupied) {
  setError(`${selectedBarber.fullName.split(' ')[0]} está ocupado — cóbrale a su cliente primero o deja este walk-in en cola`)
  return
}
```

  3. **Catch del assign** — reemplazar el `catch {}` silencioso:

```ts
let assignedBarberName: string | null = null
let assignError: string | null = null
if (mode === 'serve_now' && selectedBarberId) {
  try {
    await walkins.assign(created.id, selectedBarberId)
    assignedBarberName = allBarbers.find((b) => b.id === selectedBarberId)?.fullName.split(' ')[0] ?? null
  } catch (err) {
    // El walk-in ya aterrizó (correcto: el cliente está formado). Pero el
    // "atender ya" NO pasó — decirlo fuerte con el motivo del API, nunca
    // cerrar como éxito silencioso (bug de prod: operador creía atender
    // y el cliente seguía en cola).
    assignError = err instanceof Error ? err.message : 'no se pudo asignar'
  }
}
if (assignError) {
  addToast(`${trimmedName} quedó EN COLA — ${assignError}`, 'error')
} else {
  addToast(
    assignedBarberName
      ? `${trimmedName} agregado · asignado a ${assignedBarberName}`
      : `${trimmedName} agregado · en cola`,
    'success',
  )
}
onCreated()
```

(Verificar la firma real de `addToast` — si el segundo arg no es `'error'`, usar el tono de error que exponga el ToastContext del POS.)

- [ ] **Step 4:** `npx vitest run src/features/walkins/presentation/AddWalkInSheet.test.tsx` → PASS (nuevos + existentes; ajustar tests existentes solo si asumían el catch silencioso).

- [ ] **Step 5:** `npx vitest run src/features/walkins` y luego `npm test` + `npm run build` → todo verde.

- [ ] **Step 6: Commit**

```bash
git add src/features/walkins/presentation/AddWalkInSheet.tsx src/features/walkins/presentation/AddWalkInSheet.test.tsx
git commit -m "fix(walkins): Atender ya honesto — guard de barbero ocupado y assign nunca silencioso"
```

---

## Verificación final
- [ ] `npm test` completo verde + build limpio.
- [ ] NO push — el director revisa y publica.
