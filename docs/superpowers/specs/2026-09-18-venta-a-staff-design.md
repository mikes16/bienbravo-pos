# Venta a staff — diseño

Fecha: 18 sep 2026 · Cubre: R7 · Proyectos: api, admin, pos
Origen y decisiones: `docs/requerimientos/2026-09-feedback-aaron.md`

## 1. Problema

La barbería vende productos (pomada, spray, bálsamo) a sus barberos a precio de costo, que
varía por producto. El cupón actual solo acepta un porcentaje o un monto fijo para todo el
alcance, no identifica quién compra y su tope es por cliente y de por vida. No hay forma de
medir cuánto compra cada barbero ni de limitarlo.

## 2. Decisiones (Miguel, 18 sep 2026)

- No se resuelve con cupón: "Venta a staff" es un modo de cobro del POS.
- Precio staff = override por variante → override por producto → `costCents`.
- El barbero solo compra para sí mismo; cobrar la compra de otro requiere permiso (caso:
  recepción). Pago siempre al momento, con las formas de pago existentes.
- Reglas administrables en el admin, con topes opcionales por barbero por mes (vacío = sin tope).
- Estas ventas cuentan en "Vendido hoy" y en ticket promedio; la diferencia contra precio
  público es descuento, estable aunque cambie el costo.
- Precios sin IVA (R5): el precio staff es precio final.

## 3. Estado actual (verificado)

`Product.costCents` existe a nivel producto; el precio público vive en
`ProductVariant.priceCents`. **Las líneas de venta no identifican la variante**: `SaleItem`
solo tiene `productId` y el API valida el precio del cliente contra "alguna variante"
(`pos.resolver.ts:280`). `Sale.customerId` es obligatorio. Los descuentos de los reportes
salen solo de `couponApplications`. Los productos generan comisión (`Product.commissionCents`).

## 4. Diseño

### 4.1 Modelo de datos (migración aditiva, todo nullable o con default)

- `Product.staffPriceCents Int?`, `ProductVariant.staffPriceCents Int?`,
  `Product.staffSaleEligible Boolean @default(true)`.
- `Sale.buyerStaffUserId String?` (+ índice `[tenantId, buyerStaffUserId, createdAt]`).
- `SaleItem.productVariantId String?` y `SaleItem.listUnitPriceCents Int?` (precio público al
  momento; solo se llena en líneas de venta a staff).
- `StaffSalePolicy` (una fila por tenant): `enabled`, `maxUnitsPerStaffPerMonth Int?`,
  `maxListAmountCentsPerStaffPerMonth Int?`, `maxUnitsPerProductPerStaffPerMonth Int?`,
  `generatesCommission Boolean @default(false)`, `allowServicesInTicket Boolean @default(true)`.
  Sin fila = política por default (activa, sin topes, sin comisión, servicios permitidos).

### 4.2 Precio staff

`variante.staffPriceCents ?? producto.staffPriceCents ?? producto.costCents`. Si los tres son
null, o `staffSaleEligible = false`, el producto no es elegible y el API rechaza la línea con
mensaje en español. Nunca se vende a $0 por falta de dato. Si el producto tiene más de una
variante con precio staff distinto, la línea debe traer `productVariantId`; si no lo trae, se
rechaza pidiendo elegir variante.

### 4.3 Cobro

`CreatePOSSaleInput.staffSale: { buyerStaffUserId }` (opcional). Cuando viene:

1. Política `enabled`. Comprador activo y del tenant.
2. Si `buyerStaffUserId` ≠ viewer → permiso `pos.staff_sale.create_for_others`; si es el
   viewer → `pos.staff_sale.create`.
3. Cada línea de producto: elegible, precio del cliente == precio staff resuelto
   (`PRICE_MISMATCH` si no), se guarda `listUnitPriceCents` y `productVariantId`.
4. Servicios y combos en el ticket: precio normal, o rechazo si `allowServicesInTicket = false`.
   Propinas: igual que siempre.
5. No admite cupones en el mismo ticket.
6. **Topes**, dentro de la misma transacción: suma las líneas de producto de ventas `PAID` con
   ese `buyerStaffUserId` en el mes calendario (tz de la sucursal, todas las sucursales) más
   las del ticket actual. El tope de monto se mide a **precio público**
   (`listUnitPriceCents × qty`): refleja cuánto inventario salió. Si excede, rechaza: "Kevin
   lleva 5 de 6 productos este mes". Ventas `VOID`/`REFUNDED` no cuentan (devuelven cupo).
7. `Sale.customerId` = cliente genérico "Mostrador" (el que ya usan las ventas sin cliente).
8. Comisión de las líneas de producto: 0/0 en el snapshot si `generatesCommission = false`
   (ver spec de comisiones). Validación de stock: la existente.

Query `staffSaleQuota(buyerStaffUserId)` → usados y restantes por cada tope, para que el POS
muestre el cupo antes de cobrar. El POS no decide; solo muestra.

### 4.4 Reportes

- La venta cuenta como ingreso por lo cobrado, en "Vendido hoy" y ticket promedio.
- Descuento de la línea = `(listUnitPriceCents − unitPriceCents) × qty`. Se suma a Descuentos
  junto con los cupones; `salesStats` lo distingue como "Descuento staff".
- Libro de ventas: marca "Staff · {nombre}" y filtro.
- Reporte nuevo "Compras de staff": por barbero y mes → unidades, valor a precio público,
  pagado, descuento. Permiso `reports.staff.view`.

### 4.5 Interfaz

**POS:** en el cobro, interruptor "Venta a staff". Comprador fijo = sesión activa, salvo que
el operador tenga `create_for_others`, que ve un selector de barbero. Los productos elegibles
cambian a precio staff con el público tachado; selector de variante cuando aplica; cupo
restante visible; los no elegibles se marcan. Con el nombre en la barra (R9) y el bloqueo a
15 s (R10), la sesión define a quién se le carga la compra.

**Admin:** campo "Precio staff" en producto y en variante (ayuda: "vacío = se usa el costo"),
casilla "Disponible para venta a staff"; sección "Venta a staff" en Ajustes del negocio (R12)
con la política; reporte "Compras de staff".

## 5. Permisos

`pos.staff_sale.create` → Gerencia Global, Barbero Admin, Barbero POS, Recepción POS.
`pos.staff_sale.create_for_others` → Gerencia Global, Barbero Admin, Recepción POS.
`staff_sale.policy.manage` → Gerencia Global. Alta aditiva; nunca el seed.

## 6. Pruebas

Unit: resolución de precio (los cuatro casos), variante obligatoria, elegibilidad, comprar
para otro sin permiso, cada tope (incluido cupo devuelto por anulación y cambio de mes en tz
local), cupón rechazado, descuento por línea estable tras cambiar `costCents`, comisión 0.
e2e: venta a staff completa → aparece en reportes con descuento staff.

## 7. Orden de entrega

Después del bloque de comisiones (usa el snapshot para "sin comisión") y de R12 (la política
vive en Ajustes del negocio). api → admin y pos en paralelo tras sincronizar schema.

## 8. Fuera de alcance

Descuento por nómina; exceder tope con autorización; elegibilidad de compradores por rol;
precio staff para servicios; venta a staff en el storefront.
