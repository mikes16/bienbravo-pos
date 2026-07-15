# Precio de líneas con overrides — Design (POS)

**Fecha:** 2026-07-15
**Repos del esfuerzo:** bienbravo-pos (esta spec) + bienbravo-api ([spec hermana](../../../../bienbravo-api/docs/superpowers/specs/2026-07-15-validacion-precios-createsale-api-design.md): validación server-side).
**⚠️ Orden de deploy INVERTIDO: POS primero, API después.** Si la validación del API llega antes que este fix, el POS viejo manda precios base y el API bloquea ventas legítimas.

## Bug (reportado en prod, Sucursal Norte)

Corte: base $200, override sucursal Norte $280, override barbero Javi $350. El tile del grid muestra $350 (correcto — `pricingFor` con el staff logueado) pero la línea del carrito cobra $200. Dos causas en el POS:

1. **Prefill del walk-in** (`useCheckout.ts` ~235): pre-llena el carrito con `svc.basePriceCents` — nunca resuelve `pricingFor`.
2. **Add con barbero default** (`cart.ts` reducer `add`): estampa `staffUserId: state.defaultBarberId` en la línea nueva SIN re-resolver el precio. La línea carga el precio del catálogo (resuelto para el *viewer logueado*), que solo es correcto cuando cajero == barbero de la línea.

`changeLineBarber` (picker de barbero) SÍ re-resuelve bien — es la única ruta correcta hoy.

## Principio

> **El precio de una línea siempre proviene de `pricingFor(locationId, staffUserId de la línea)` — staff > sucursal > base.** Cualquier ruta que cree o modifique una línea de servicio resuelve por esa vía. El API validará y rechazará desajustes (spec hermana), así que un precio mal resuelto = venta bloqueada.

## Cambios

### 1. `resolveServicePriceForBarber` acepta `staffUserId: string | null`
El query `PosResolveServicePrice` ya declara `$staffUserId: ID` (nullable). Solo se amplía la firma del repo (interface + impl) para poder resolver a nivel sucursal (línea sin barbero).

### 2. Prefill del walk-in resuelve overrides
Por cada `requestedService`: si el barbero asignado sigue disponible → `resolveServicePriceForBarber(svc.id, locationId, assignedId)`; si no → `resolveServicePriceForBarber(svc.id, locationId, null)` (sucursal > base). Fallback a `basePriceCents` + `console.error` solo si la resolución truena (raro; el API rechazará ese precio si difiere, y el cajero puede quitar/re-agregar la línea).

### 3. Add re-resuelve cuando hay barbero default
El action `add` acepta `lineId` opcional (generado por el caller). `useCheckout` expone `addCatalogItem(item)`: dispatch `add` optimista con el precio del catálogo (feedback instantáneo al tap) y, si la línea es servicio y hay `defaultBarberId`, encadena `changeLineBarber(lineId, defaultBarberId)` — reusa la máquina existente que resuelve y corrige el precio (cache-first: corrección típicamente imperceptible). `CheckoutPage.onAdd` usa `addCatalogItem`.

### 4. Tests (Vitest)
- Prefill walk-in: línea con precio resuelto (mock de `resolveServicePriceForBarber`), NO `basePriceCents`; con y sin barbero asignado disponible.
- Add con barbero default: el precio de la línea termina siendo el resuelto para ese barbero.
- Add sin barbero default: conserva el precio del catálogo, sin llamadas extra.

## Fuera de alcance
- Extras de servicios (no generan líneas en el POS hoy — verificado).
- Productos y combos: sin motor de overrides por barbero; el add actual es correcto (producto = precio de variante; combo ya viene resuelto por sucursal en el catálogo).
- La validación server-side (spec hermana en bienbravo-api).
