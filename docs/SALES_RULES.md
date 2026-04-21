# Reglas de venta – BienBravo POS

Este documento define las reglas que el POS debe respetar al procesar ventas, con foco en catálogo, pricing por sucursal e inventario. El POS es **consumer** del dominio definido por el API — no redefine reglas, las implementa.

> Fuente de verdad del dominio:
> - Catálogo: [../../bienbravo-api/docs/CATALOG.md](../../bienbravo-api/docs/CATALOG.md)
> - Reglas generales: [../../bienbravo-api/docs/BUSINESS_RULES.md](../../bienbravo-api/docs/BUSINESS_RULES.md)
> - Permisos: [../../bienbravo-api/docs/PERMISSIONS.md](../../bienbravo-api/docs/PERMISSIONS.md)

---

## 1. Contexto del POS

- El POS siempre opera dentro de una `locationId` conocida (la sucursal donde está instalado).
- El POS consume GraphQL vía Apollo Client. **Nunca** calcula precios, comisiones o duraciones localmente — siempre los pide al API.
- Una venta cerrada en POS es un `Sale` con uno o más `SaleItem`. Cada `SaleItem` puede ser de tipo `SERVICE`, `PRODUCT` o `COMBO`.

---

## 2. Resolución de precio al agregar un item

### Servicio

Al agregar un servicio al carrito, llamar:

```graphql
Service.pricingFor(locationId: $currentLocation, staffUserId: $staff)
```

- Si aún no hay barbero asignado: llamar **sin** `staffUserId`.
- Al asignar/cambiar barbero: **re-resolver** — el precio puede cambiar si el barbero tiene `StaffServicePrice` (caso Javi).
- Mostrar al cajero `totalDurationMin` y `totalPriceCents` (incluyen extras auto-incluidos).
- Los extras auto-incluidos (`ServiceLocationExtra`) se agregan como `SaleItem` separados con `itemType=SERVICE`. Visualmente el cajero los ve agrupados bajo el servicio padre, pero en el `Sale` quedan como filas independientes para facturación y reporte.

### Producto

Al agregar un producto al carrito:
1. Pedir al API precio del producto en la sucursal actual.
2. **Validar stock** vía `InventoryLevel.quantity` en la `StockLocation` de la sucursal antes de permitir agregar más cantidad de la disponible (ver §4).

### Combo

Al agregar un combo al carrito, llamar:

```graphql
CatalogCombo.pricingFor(locationId: $currentLocation)
```

- El API devuelve precio resuelto del combo (con override de sucursal si aplica) y la lista expandida de items (servicios + productos + extras).
- El POS **no** suma precios de componentes. Usa el `priceCents` resuelto del combo como línea.
- Para el bloqueo de agenda y el audit de inventario, cada componente debe materializarse como `SaleItem` con su `linkTo` al combo padre (`saleItem.comboLineId` o similar — verificar contrato actual del API).

---

## 3. Asignación de barbero en servicios

- Todo `SaleItem` de tipo `SERVICE` debe tener `staffUserId` antes de cerrar la venta, salvo servicios "sin barbero" (p. ej. "Descuento aplicado"). Si se intenta cerrar sin barbero, bloquear con error claro.
- La comisión del barbero se toma del `commissionCents` **resuelto** (precedencia `StaffServicePrice → ServiceLocation → Service`), nunca del `baseCommissionCents` crudo.

---

## 4. Inventario

El POS es el punto donde se **consume** stock. Reglas obligatorias:

### 4.1 Validación antes de cerrar

Por cada `SaleItem` con `productId` (incluyendo productos componentes de combos):

```
required = Σ qty del producto en la venta (suma directa + componentes de combos)
available = InventoryLevel.quantity en la StockLocation de la sucursal
```

Si `required > available`:
- **Por default:** bloquear el cierre de la venta.
- **Override:** solo un usuario con permiso `inventory.allow_negative` puede aceptar explícitamente cerrar con stock negativo. La UI debe pedir confirmación con la cantidad exacta en negativo que se va a registrar.

### 4.2 Mutation de cierre de venta

Al cerrar la venta, el API (no el POS) debe — **en una sola transacción**:

1. Crear `Sale` + `SaleItem`s.
2. Por cada `SaleItem` con `productId` o `productVariantId`:
   - Crear `InventoryMovement(type=SALE, delta=-qty, referenceId=sale.id, stockLocationId=...)`.
   - Decrementar `InventoryLevel.quantity`.
3. Para combos: iterar `CatalogComboItem[]` con `productId` y aplicar la misma regla, multiplicando `qty` del item por `qty` del `SaleItem` combo.
4. Si el decremento deja `InventoryLevel.quantity < 0` y el usuario no tiene permiso de override, **revertir la transacción completa**.

**El POS no toca la DB de inventario directamente.** Llama al API y confía en la transacción atómica.

### 4.3 Refunds y cancelaciones

- **Refund total o parcial:** el API debe crear `InventoryMovement(type=REFUND, delta=+qty, referenceId=sale.id)` y **incrementar** el `InventoryLevel` por cada producto afectado. El POS solo dispara la mutation de refund.
- **Cancelación antes de cerrar:** si el cajero cancela el carrito antes de confirmar la venta, no hay `Sale` creado → no hay que tocar inventario. Simplemente se descarta el estado local del POS.
- **Nunca** se editan ni borran `InventoryMovement` existentes. Toda corrección es un movimiento nuevo.

---

## 5. Reintentos, timeouts y offline

- **Idempotencia:** la mutation de cierre de venta debe llevar un `clientRequestId` generado por el POS. Si el POS reintenta por timeout, el API debe reconocerlo y devolver el `Sale` ya creado en lugar de duplicarlo.
- **Sin offline parcial:** si no hay red, el POS **no** debe acumular ventas para sincronizar después. El stock y las comisiones dependen del estado del servidor y no pueden resolverse localmente. La UI debe bloquear con mensaje claro de "sin conexión".
- **Reconexión:** tras reconectar, invalidar cache local de pricing (puede haber cambiado) y refrescar el carrito antes de permitir cerrar.

---

## 6. UI — obligaciones mínimas del carrito

Al construir la vista del carrito, el POS debe mostrar:

1. **Por cada línea:** nombre, cantidad, precio resuelto, subtotal.
2. **Por combos:** lista expandible de componentes (servicios + productos + extras auto-incluidos).
3. **Por servicios:** barbero asignado (requerido antes de cerrar).
4. **Indicador de stock bajo** cuando un producto en el carrito tiene `quantity - required < InventoryLevel.lowStockThreshold`. No bloquea, solo avisa.
5. **Desglose de comisiones** accesible por barbero (vista de cajero/encargado).
6. **Override de precio** por línea solo disponible para roles con permiso `pos.price_override`. El override registra `SaleItem.priceCentsOverride` y una razón obligatoria.

---

## 7. Permisos relevantes

| Permiso | Acción |
|---|---|
| `pos.sale.create` | Abrir y cerrar ventas |
| `pos.price_override` | Cambiar precio manual de una línea |
| `inventory.allow_negative` | Cerrar venta con stock insuficiente |
| `pos.refund` | Procesar refund total o parcial |
| `pos.refund.after_hours` | Refunds fuera de la ventana permitida (si aplica política) |

Verificar contra [PERMISSIONS.md](../../bienbravo-api/docs/PERMISSIONS.md) antes de implementar — esta tabla refleja el diseño objetivo, no necesariamente lo ya seedeado.

---

## 8. Estado de implementación

| Área | Estado |
|---|---|
| Carrito con servicios + productos | ✅ Implementado |
| Combos en carrito | ⚠️ Implementado parcial (verificar resolución de items) |
| Validación de stock antes de cerrar venta | ❓ A verificar |
| Descuento de `InventoryLevel` al cerrar venta de producto | ❓ A verificar |
| Descuento de `InventoryLevel` al cerrar venta de combo con productos | ❓ A verificar — **riesgo alto si no está** |
| Creación de `InventoryMovement` con `referenceId` | ❓ A verificar |
| Refunds con reversión de inventario | ❓ A verificar |
| Idempotencia (`clientRequestId`) en cierre de venta | ❓ A verificar |
| Re-resolución de precio al cambiar barbero | ⚠️ Pendiente (depende del plan de pricing por sucursal) |
| Override de precio con razón obligatoria | ❓ A verificar |

**Próximo paso al abrir el POS:** auditar `bienbravo-pos/src/features/checkout/` contra esta tabla y actualizar con `✅` / `❌` lo que esté implementado vs. falta.

---

## Resumen rápido

| Regla | Resumen |
|---|---|
| Precio de servicio | Siempre vía `Service.pricingFor(locationId, staffUserId?)`, nunca calculado en el POS. |
| Combo | Una línea con precio resuelto del combo; los componentes se materializan para inventario y agenda, no se re-suman. |
| Stock | Validar antes de cerrar; override solo con permiso explícito; decrementar en transacción atómica del API. |
| Movimientos | Toda venta/refund crea `InventoryMovement` con `referenceId=sale.id`. Nunca se editan ni borran. |
| Cierre de venta | Idempotente con `clientRequestId`. No hay venta offline. |
| Comisión | Siempre la resuelta, nunca `baseCommissionCents`. |
