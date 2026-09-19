# Ajustes menores del lote de septiembre — diseño

Fecha: 18 sep 2026 · Cubre: R1, R5 (interfaz), R6, R9, H3 · Proyectos: api, admin, pos
Regla transversal de consistencia: sección 5 de `2026-09-18-frescura-y-consistencia-pos-admin-design.md`.
Origen y decisiones: `docs/requerimientos/2026-09-feedback-aaron.md`
Mockups de R6 y R9: `docs/requerimientos/mockups/2026-09-r6-r9-variantes.html`

Cada apartado es independiente y puede ser una tarea por proyecto.

## R1 — La forma de pago sale "—" en Finanzas → Ventas (api)

**Causa (verificado).** El resolver `sales` (`bienbravo-api/src/modules/pos/pos.resolver.ts:655`)
hace `findMany` sin `include` de `payments` ni `customer`; ambos son campos planos de `Sale`
(sin `@ResolveField`). `sale` (línea 600) y `posDaySales` sí los incluyen.

**Cambio.** Agregar `include: { customer: { select: { id, fullName } }, payments: true }` al
`findMany` de `sales`.

**Aceptación.** La lista devuelve pagos y cliente de cada venta sin abrir el detalle; los
chips Efectivo/Tarjeta/Transfer. muestran el total del periodo al cargar. Test unitario del
resolver que falle si se quita el include. Revisar el costo con el límite de 1000 ventas
(una sola consulta con join, sin N+1).

## R5 — Ocultar el desglose de impuesto (admin, pos)

Los datos ya están corregidos (18 sep 2026: tasa 0, histórico sin impuesto).

**Cambio.** Cuando `taxTotalCents === 0`, no mostrar las líneas Subtotal / Impuesto; solo
Total. Aplica a `bienbravo-admin/src/components/sales/SaleDetailModal.tsx` y a
`CheckoutPage.tsx` / `ReceiptScreen.tsx` del POS. Verificar en el plan si el POS calcula
impuesto del lado del cliente (no debe: el API es la fuente) y si el carrito del storefront
(`bienbravo-web/src/lib/cart/store.ts`) muestra impuesto.

**Aceptación.** Una venta sin impuesto muestra solo Total en admin, cobro y recibo. Si algún
día una venta trae impuesto distinto de 0, el desglose reaparece (no se borra el código).

## R6 — Encabezado: variante A "Cuatro numerales" (admin)

Aplica igual a `SalesHero.tsx` y `DashboardHero.tsx`.

- Total: techo del `clamp` de 128/140 px a **88 px**; centavos a 30 px.
- **Efectivo y Tarjeta** pasan a ser los primeros numerales secundarios, 48 px, etiqueta en
  hueso. Transferencia sube como tercer numeral solo cuando su monto es distinto de 0.
- Ventas y Ticket promedio (en "Hoy": Citas hoy) a 32 px en tono apagado, separados por un
  filete vertical.
- La fila mono queda con lo restante (Transfer. en 0, Propinas, Descuentos; en "Hoy" también
  Comisiones) a 12 px. Se conserva la regla "—" en 0, nunca "$0.00".

**Aceptación.** Coincide con el mockup A; en 375 px de ancho los numerales envuelven sin
desbordar; contraste AA; los tests existentes de ambos heroes siguen pasando (los
`data-testid` se conservan). El design system es compartido: no se tocan tokens.

## R9 — Identidad del barbero: variante A "Nombre en la barra" (pos)

- `IdentityStripV2.tsx`: nombre completo a 28 px (Barlow Condensed, mayúsculas) con el estado
  debajo ("EN PISO · SESIÓN ACTIVA"); avatar de 44 px; el candado pasa a botón con texto
  "Bloquear" (área táctil ≥ 44 px). La barra sube de 56/64 a 68 px.
- El botón de cobro dice "Cobrar como {nombre}" en el flujo de venta y en la confirmación de pago.
- Se elimina el "Hola, {nombre}." de `HoyView.tsx` (redundante).
- En anchos chicos el nombre se trunca con elipsis, nunca desaparece; el reloj y el estado
  ceden primero.

**Aceptación.** El nombre es visible en todas las pestañas y en el cobro; tests de
`IdentityStripV2` y `HoyView` actualizados. Depende de R10 para cerrar el escenario completo.

## R8 y H2 — movidos

"Ventas del día no se actualiza sola" (R8) y el recálculo nocturno inexistente (H2) se
resuelven en `2026-09-18-frescura-y-consistencia-pos-admin-design.md`: R8 tiene causa
confirmada en código (datos vivos servidos `cache-first` desde un caché persistido, con
refresco que depende del foco) y H2 pasa de "corregir comentarios" a implementar la tarea
nocturna con detección de desfase.

## H3 — Aprobar un reembolso no recalcula métricas (api)

**Por verificar.** `refundApprove` no llama a reporting; `DailyLocationMetrics.refundCents`
queda viejo hasta otro recálculo de ese día.

**Cambio.** Tras aprobar, `recalcSingleLocationDay` (y el de staff) del día local de la venta,
fuera de la transacción, con el mismo patrón que `voidSale`.

**Aceptación.** Test: aprobar un reembolso actualiza `refundCents` del día de la venta.
