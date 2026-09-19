# Ajustes del negocio y bloqueo automático del POS — diseño

Fecha: 18 sep 2026 · Cubre: R12 y R10 · Proyectos: api, admin, pos
Origen y decisiones: `docs/requerimientos/2026-09-feedback-aaron.md`

## 1. Problema

- **R10.** Un barbero cobra, olvida tocar el candado y el siguiente cobra en su perfil: la
  venta y la comisión quedan mal atribuidas. El auto-bloqueo ya existe
  (`bienbravo-pos/src/core/auth/useAutoLock.ts`) pero con 5 minutos fijos. Al bloquear,
  `PosShell.tsx:62` desmonta todo y el carrito (en memoria, `useCheckout.ts`) se pierde.
- **R12.** Varios valores de este lote deben ser configurables y hoy no hay dónde:
  `TenantSetting` solo tiene `vatRateBps`, sin mutation ni pantalla.

## 2. Decisiones (Miguel, 18 sep 2026)

15 s de inactividad general y 90 s con venta en curso, ambos configurables. **Sin bloqueo
inmediato tras cada venta** (pedir PIN por venta sería muy cansado). Ventana de correcciones
de 7 días, configurable, compartida por R2 y R4. Una pantalla "Ajustes del negocio" en el
admin. La tasa de IVA **no** se expone por ahora.

## 3. Diseño

### 3.1 Datos (`TenantSetting`, migración aditiva con defaults)

| Columna | Default | Límites (validados en el API) |
|---|---|---|
| `posAutoLockIdleSeconds Int` | 15 | 10–600 |
| `posAutoLockCheckoutSeconds Int` | 90 | 10–600, y ≥ el valor general |
| `salesCorrectionWindowDays Int` | 7 | 0–31 |

La política de venta a staff vive en su propia tabla (`StaffSalePolicy`, spec de R7) pero se
edita desde esta misma pantalla.

### 3.2 API

- Query `businessSettings` (permiso `settings.business.manage`) y mutation
  `updateBusinessSettings(input)` con validación de límites y `AuditLog`
  `settings.business.update` con valor anterior y nuevo por campo.
- Los ajustes que necesita el POS viajan en su consulta de arranque
  (`BootstrapProvider`): solo `posAutoLockIdleSeconds` y `posAutoLockCheckoutSeconds`. No
  requieren permiso especial: cualquier sesión de POS los lee.
- `salesCorrectionWindowDays` lo leen en el API las reglas de R2 y R4; ningún cliente lo
  necesita para decidir (el API devuelve `…Editable` / `…LockReason`).

### 3.3 POS: `useAutoLock`

1. Tiempo activo = `checkoutSeconds` si hay **venta en curso** (carrito con al menos un
   concepto o pantalla de pago abierta); si no, `idleSeconds`. La pantalla de recibo cuenta
   como "sin venta en curso": al cerrar el cobro vuelve a correr el tiempo corto, y eso cubre
   el escenario de R9 sin pedir PIN por venta.
2. **Nunca bloquea mientras un cobro se está enviando** (`submitting`).
3. Aviso en los últimos 5 s: franja "Se bloquea en 5… toca para seguir"; cualquier toque
   reinicia el contador. Respeta `prefers-reduced-motion`.
4. "Venta en curso" se publica desde el flujo de cobro por un contexto mínimo
   (`core/auth`), para no acoplar `useAutoLock` al feature de checkout.
5. Si la consulta de arranque aún no carga, usa los defaults (15 / 90).
6. Es un bloqueo suave de atribución, no una frontera de seguridad: la cookie sigue viva.
   No cambia nada del modelo de auth.

Mejora posterior, fuera de este lote: conservar el carrito al bloquear (mismo barbero
continúa; otro barbero lo descarta).

### 3.4 Admin: "Ajustes del negocio"

Página nueva en Configuración, con secciones: **POS · Bloqueo** (los dos tiempos, en
segundos, con ayuda de qué significa cada uno), **Ventas · Correcciones** (días), **Venta a
staff** (aparece cuando exista R7), **Impuestos** (solo el texto "Precios sin IVA"; sin campo).
Patrón de formulario del admin (react-hook-form + zod), barra de guardar, errores del API en
español. Agrupada y corta: no es una pantalla de 12 interruptores.

## 4. Permisos

`settings.business.manage` → Gerencia Global. Alta aditiva; nunca el seed.

## 5. Pruebas

api: límites, permiso, bitácora con antes/después. pos (Vitest, timers falsos): bloquea a los
15 s en Hoy; no bloquea a los 15 s con carrito; bloquea a los 90 s con carrito; no bloquea
mientras `submitting`; el aviso aparece a 5 s del final y un toque reinicia; tras el recibo
vuelve el tiempo corto; usa defaults si no hay ajustes. admin: validación del formulario.

## 6. Orden de entrega

api (migración, query, mutation, arranque del POS) → pos y admin en paralelo tras sincronizar
schema. R2 y R4 pueden arrancar antes usando una constante 7 con el mismo nombre y cambiar a
la lectura real cuando esto exista.

## 7. Fuera de alcance

Ajustes por sucursal; editar la tasa de IVA; bloqueo tras cada venta; conservar el carrito.
