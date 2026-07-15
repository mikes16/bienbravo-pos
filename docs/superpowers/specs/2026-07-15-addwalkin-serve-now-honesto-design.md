# AddWalkInSheet: "Atender ya" honesto — Design (POS)

**Fecha:** 2026-07-15
**Repo:** bienbravo-pos únicamente. HOY y el API no cambian (ambos se comportaron correctamente).

## Bug (reportado en prod)

Operador ya EN SERVICIO crea un walk-in y elige "Atender ya" consigo mismo. El API rechaza el assign (`'El barbero ya tiene un servicio en curso.'` — guard correcto de negocio) pero `AddWalkInSheet` **se traga el error en silencio** (`catch {}` en el flujo serve_now): la modal cierra como éxito y el cliente queda EN COLA con preferencia. El operador cree que lo está atendiendo; HOY (correctamente) le dice "Atender al siguiente: Pedro" y parece bug de HOY.

Dos hoyos concretos en `AddWalkInSheet.tsx`:
1. **Selección que sobrevive al cambio de modo:** en modo `queue` un barbero ocupado ES elegible (como preferencia — correcto). Al cambiar a `serve_now`, `selectedBarberId` persiste sin revalidar, y el submit solo valida `!selectedBarberId`, no ocupación → se manda un assign condenado.
2. **Assign silenciado:** el `catch {}` del assign trata el fallo como éxito. El toast dice "agregado · en cola" (cola honesta pero tono éxito y fácil de no leer) y `onCreated()` refresca — el operador no se entera de que el "atender ya" NO pasó.

## Principio

> El resultado que ve el operador debe ser el estado real: si el assign falla, se dice fuerte y claro con el motivo del API, y el cliente queda visiblemente en cola. Mejor aún: prevenir el submit condenado antes de mandarlo.

## Cambios (todos en `AddWalkInSheet.tsx`)

1. **Revalidar al cambiar de modo:** al pasar a `serve_now`, si el barbero seleccionado está `isOccupied`, limpiar la selección (`setSelectedBarberId(null)`). La fila ya se renderiza disabled en ese modo — la selección no puede apuntar a algo no-elegible.
2. **Refrescar ocupación al cambiar a `serve_now`:** re-fetch de `getAvailableBarbers` (network-only, ya lo es) para que `isOccupied` refleje el piso al momento de la decisión, no al momento de abrir el sheet.
3. **Guard de submit:** en `serve_now`, si el barbero seleccionado está ocupado según el snapshot fresco → `setError('<Nombre> está ocupado — cóbrale a su cliente primero o deja este walk-in en cola')` y abortar (antes de crear nada).
4. **Assign nunca más silencioso:** si `walkins.assign` lanza, el walk-in ya existe (decisión correcta: no revertir), pero el toast pasa a tono **error** con el motivo: `'<Nombre> quedó EN COLA — <mensaje del API>'`. `onCreated()` se sigue llamando (la lista debe refrescar). El toast de éxito con "asignado a X" queda solo para assigns reales (ya es así).

## Tests (Vitest, `AddWalkInSheet.test.tsx` existente)
- Cambiar a `serve_now` con un ocupado seleccionado limpia la selección.
- Submit en `serve_now` con ocupado (mock que lo permite) muestra el error y NO llama `create`.
- `create` OK + `assign` rechaza → toast de error con el mensaje del API, `onCreated` sí se llama.
- Flujo feliz serve_now con barbero libre: sin cambios (toast "asignado a X").

## Fuera de alcance
- HOY/CTA (funcionó como diseñado) y el guard del API (correcto).
- Cambiar la decisión "walk-in aterriza aunque el assign falle" (correcta: el cliente ya está formado).
