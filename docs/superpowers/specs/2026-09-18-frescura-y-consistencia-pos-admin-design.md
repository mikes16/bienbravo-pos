# Frescura del caché del POS y consistencia de datos POS ↔ Admin — diseño

Fecha: 18 sep 2026 · Cubre: R13 (nuevo), absorbe R8 y amplía H2 · Proyectos: pos, api, admin
Origen: petición de Miguel del 18 sep 2026: "no mostrar cosas erróneas entre plataformas,
especialmente entre el POS y el Admin" y "revisión del caché del POS porque me deja muchas
cosas desactualizadas".

## 1. Diagnóstico (verificado en código)

El POS guarda todo su caché de Apollo en `localStorage` y lo restaura al arrancar
(`bienbravo-pos/src/core/apollo/client.ts`). La política por defecto es `cache-first`. Eso es
correcto para el catálogo, pero hoy aplica igual a los datos que cambian todo el día:

1. **Datos vivos servidos del caché como si fueran verdad.** `DaySalesPage.tsx:55` monta con
   `force: false` → `cache-first` sobre un caché que además sobrevive recargas. "Ventas del
   día" pinta la lista como quedó la última vez que se guardó. Mismo patrón en Hoy, Mi día,
   Caja, walk-ins, agenda y reloj (`force ? 'network-only' : 'cache-first'`).
2. **La frescura depende del foco.** Los únicos disparadores de refresco son `focus`,
   `visibilitychange` y eventos del WebSocket. Una terminal dedicada que está siempre en
   primer plano nunca dispara los dos primeros. El control de versión del catálogo
   (`BootstrapProvider.tsx`) tiene el mismo defecto: solo revisa al autenticarse y en
   `visibilitychange`, así que un cambio de precio hecho en el admin puede no llegar nunca a
   una terminal que no se recarga.
3. **El WebSocket no es confiable como única vía.** El pubsub del API es en memoria y no
   reenvía eventos a quien estaba desconectado; el manejador de error de la suscripción no
   hace nada. Un corte de red deja la pantalla congelada sin aviso.
4. **Las invalidaciones son locales.** Tras cobrar, la terminal evicta sus propios campos;
   lo que cambian otra terminal o el admin no invalida nada aquí.
5. **Evict sin recarga.** Cuando cambia la versión del catálogo se evictan campos, pero las
   pantallas ya montadas no vuelven a consultar.
6. **El hash de versión no cubre todo lo que el POS muestra.** `catalog-version.service.ts`
   cubre productos, servicios, combos, categorías, overrides de servicio por sucursal y por
   barbero, y staff; pero **no** los overrides de combo por sucursal y por barbero
   (`CatalogComboLocation`, `StaffComboPrice`), y tampoco cubrirá lo nuevo de este lote
   (precio staff, ajustes del negocio, política de venta a staff).
7. **La versión del caché persistido es una constante manual** (`SCHEMA_VERSION =
   '2026-06-04-v1'`). Si alguien olvida subirla tras un cambio de schema, el POS restaura
   datos con forma vieja. Este lote cambia mucho el schema.
8. **Una pestaña abierta sigue corriendo el JavaScript viejo** después de un despliegue.

**Esto explica R8 con certeza:** la terminal de la barbería restauró su caché (2 ventas,
$500), no recibió los eventos y, al no perder nunca el foco, no volvió a consultar. La
computadora de Aarón tenía caché limpio y vio las 14.

Del lado de consistencia entre plataformas:

9. **La misma cifra sale de fuentes distintas.** Ejemplo: efectivo/tarjeta del día. El POS
   usa pagos en vivo; Finanzas → Ventas suma en el navegador una lista (con tope de 1000
   filas y aviso); "Hoy" lee `DailyLocationMetrics`, una tabla que se recalcula "best-effort"
   después de cada venta y **no tiene recálculo programado** (H2): si un recálculo falla, el
   admin queda mal indefinidamente y nadie se entera. Con comisiones pasa igual
   (`DailyStaffMetrics` vs cálculo en vivo del POS).

## 2. Principios (contrato del lote)

- **P1. Una cifra, una definición.** Toda cifra de dinero se define una vez en el API. POS y
  admin la consumen; ninguno la vuelve a derivar con reglas propias.
- **P2. El dinero nunca se muestra desde caché ni se guarda en el dispositivo.** Siempre viene
  de la red. Lo vivo sin dinero puede pintarse desde la memoria de la sesión, pero se
  revalida siempre y no sobrevive a un arranque.
- **P3. La frescura no depende del foco ni de sondeos:** el servidor avisa (WebSocket) y el
  cliente se pone al día cuando se reconecta.
- **P4. Lo que cambia en otro lado llega en segundos** sin recargar la página; si la conexión
  en vivo está caída, la pantalla lo dice.
- **P5. El servidor decide al cobrar** y un rechazo por datos viejos se recupera solo.
- **P6. El desfase se detecta**, no se descubre por una queja.

## 3. Diseño — POS

### 3.1 Clasificar cada consulta

Primera tarea: inventario de todos los campos raíz que lee el POS, cada uno marcado como:

| Clase | Ejemplos | Política |
|---|---|---|
| **ESTÁTICO** | `services`, `products`, `catalogCombos`, `catalogCategories`, sucursales | `cache-first`, persistido en el dispositivo, controlado por versión (3.4) |
| **DINERO / SENSIBLE** | `posDaySales`, `staffDayEarnings` (comisiones), `registers` y `posCajaStatusHome` (caja), totales del encabezado, `staffSaleQuota`, detalle de ventas, búsqueda y datos de clientes | **siempre de la red** (`network-only`); mientras carga se ve un esqueleto, nunca una cifra vieja; **jamás se guarda en el dispositivo** |
| **VIVO sin dinero** | `walkIns`, `appointments`, reloj, estado de barberos, `posInventoryLevels` | se puede pintar lo que hay en memoria de esta sesión y se revalida siempre; nunca persistido |
| **SESIÓN** | `viewer` y sus permisos | persistido; se revalida al desbloquear con PIN |

**Regla de Miguel (18 sep 2026): el dinero nunca se muestra desde caché.** Con varias iPads
cobrando a la vez, una cifra guardada en un dispositivo está mal en cuanto otra iPad cobra.
Una cifra de dinero en pantalla siempre es la que acaba de responder el servidor, o un
esqueleto, o un aviso de "sin conexión". El costo es un parpadeo de carga (la consulta del
día es chica y va agrupada); el arranque instantáneo se conserva para el catálogo, que es lo
pesado.

La clasificación vive en un solo módulo de `core/` y la usan persistencia y refresco.
`posAvailableBarbers` hoy está como estático pero incluye el estado laboral: se separa o pasa a vivo.

### 3.1b Estados de una cifra de dinero en pantalla

Confirmado por Miguel (18 sep 2026): esqueleto de carga para el dinero; nunca datos viejos ni
falsos. Un componente compartido (`MoneyValue` o equivalente en `shared/pos-ui`) es la única
forma de pintar dinero en el POS y solo tiene estos estados:

| Estado | Cuándo | Qué se ve |
|---|---|---|
| **Cargando** | al entrar a la pantalla, al desbloquear con PIN, al reconectar el socket, al tocar "Actualizar" | esqueleto del tamaño del numeral (sin salto de layout); nunca `$0` ni la cifra anterior |
| **Vigente** | respondió el servidor | la cifra |
| **Actualizando** | llegó un evento y ya se pidió el dato nuevo | la cifra atenuada con indicador de actualización; si tarda más de 1 s pasa a esqueleto |
| **Sin conexión** | falló la red o el socket está caído | "—" y el aviso "Sin conexión · toca Actualizar"; nunca la última cifra como si fuera actual |
| **Error** | el servidor respondió con error | "No se pudo cargar" + reintentar; nunca `$0` |

"Actualizando" existe para que las pantallas no parpadeen a esqueleto con cada venta de otra
iPad: la cifra atenuada acaba de venir del servidor hace instantes, se marca como en
revisión y se reemplaza en el mismo ciclo. Todo lo demás (validez desconocida) es esqueleto.

Reglas: un `0` real ("hoy no hay ventas") se distingue siempre de "no sé" (esqueleto/guion);
los esqueletos respetan `prefers-reduced-motion` y usan los tokens existentes; las listas de
ventas usan filas-esqueleto, no una lista vacía. El admin aplica el mismo criterio en sus
pantallas de dinero: ya atenúa los numerales en el primer fetch (`SalesHero`), se verifica
que ninguna muestre `$0` o datos del filtro anterior mientras carga.

### 3.2 Persistencia: lista de permitidos, no de excluidos

- **Solo se guarda en `localStorage` lo que está en una lista explícita** (clase ESTÁTICO y
  SESIÓN). Todo campo nuevo queda fuera por defecto: olvidarse de clasificar algo nunca
  termina guardando dinero en el dispositivo. Se implementa filtrando `cache.extract()` antes
  de escribir (campos de `ROOT_QUERY` permitidos + las entidades que referencian), no
  evictando al restaurar.
- **Privacidad (hallazgo).** Hoy el caché completo se guarda en `localStorage` de un iPad
  compartido: ventas, nombres de clientes y comisiones de todos los barberos que usaron ese
  dispositivo quedan legibles para cualquiera con acceso a él, y sobreviven al bloqueo. Con
  la lista de permitidos eso desaparece. Migración: el primer arranque con esta versión purga
  el caché guardado anterior.
- **Al bloquear la sesión** se evictan de la memoria los campos DINERO/SENSIBLE, para que el
  siguiente barbero no herede en pantalla ni en memoria las cifras del anterior.
- La versión del caché deja de ser manual: se deriva del identificador del build (inyectado
  por Vite). Cada despliegue purga el caché persistido una vez.

### 3.3 Refresco por eventos (WebSocket), sin sondeo periódico

**Decisión de Miguel (18 sep 2026): no hay latido.** Nada consulta al servidor "por si acaso"
cada N segundos. El POS se actualiza cuando el servidor avisa que algo cambió, igual que ya
funciona la fila del kiosko. La infraestructura existe: tres suscripciones
(`saleEvent`, `walkInQueueUpdated`, `appointmentUpdated`) con carga mínima (tipo + sucursal +
id, sin datos de dinero) y el cliente vuelve a pedir su consulta autenticada por HTTP.
Lo que falta es hacerla confiable y completa:

**a) Un solo canal por sucursal, en `core/`.** `FreshnessProvider` abre las suscripciones una
vez para toda la app (hoy cada página abre las suyas y solo mientras está montada). Las
pantallas registran su carga con `useLiveRefresh(load, temas)` y reciben solo los temas que
les importan (ventas, caja, fila, agenda, catálogo, ajustes). Sustituye los `useEffect`
duplicados de Hoy, Mi día y Ventas del día.

**b) Ponerse al día al reconectar.** El hueco real del WebSocket es lo que pasa mientras está
caído: el pubsub es en memoria y no reenvía. Regla: cada vez que el socket pasa de
desconectado a conectado (`graphql-ws` ya reintenta sin límite y detecta zombis con el
`keepAlive` de 12 s), se emite un "refrescar todo" **una sola vez**. Es una consulta por
reconexión, no un sondeo.

**c) Eventos que hoy no existen.** El API publica también cuando: se abre o cierra caja; se
corrige un pago o se anula una venta (ya existe para anular); se edita una comisión; cambia
el catálogo, un precio, los ajustes del negocio o la política de venta a staff (tema
"catálogo/ajustes": el POS responde revisando la versión, 3.4). Regla transversal: **toda
mutation que cambie algo que el POS muestra publica un evento** en el canal de su sucursal
(o de todas, si es de negocio).

**d) Disparadores por acción del usuario, no por tiempo:** desbloquear con PIN (el siguiente
barbero ve datos frescos) y entrar a "Nueva venta" (revisa versión de catálogo antes de
cobrar). Se conservan `focus` / `visibilitychange`.

**e) Botón "Actualizar"** en la barra del POS, con la hora del último dato ("Actualizado
18:36"). Es la red de seguridad y, sobre todo, una señal de confianza: el operador sabe qué
tan fresco es lo que ve y tiene una salida que no es recargar la página. No es el mecanismo
principal.

**f) Estado de conexión visible.** Si el socket lleva más de unos segundos caído: "Sin
conexión en vivo · datos de las 18:36". Nunca datos viejos presentados como actuales.

Reglas: mínimo 5 s entre refrescos del mismo tema (agrupa ráfagas de eventos); no refresca
mientras un cobro se está enviando.

**Costo y límites.** Cero consultas en reposo: una terminal sin actividad en la sucursal no
toca la base. Cada venta produce un evento por terminal suscrita y una consulta chica de
cada una. Límite conocido y ya documentado en `pubsub.service.ts`: el pubsub en memoria
funciona con **una sola instancia del API**; si Railway escala horizontalmente hay que
moverlo a Redis (fuera de este lote, pero deja de ser opcional ese día).

**Seguridad.** Los eventos siguen sin llevar montos ni nombres: solo avisan. Los datos viajan
por la consulta HTTP autenticada. Verificar en el plan que ningún evento nuevo rompa esa regla.

### 3.4 Control de versión ampliado

- Corre cuando llega un evento del tema "catálogo/ajustes", al reconectar el socket, al
  desbloquear con PIN y al entrar a "Nueva venta" (hoy solo al autenticarse y en
  `visibilitychange`). Sigue siendo una consulta barata: el hash está memoizado 15 s en el API.
- Tras evictar, emite "refrescar" para que las pantallas montadas recarguen.
- El hash del API suma lo que falta: overrides de combo por sucursal y barbero, y lo nuevo
  del lote (`staffPriceCents`,
  `staffSaleEligible`, ajustes del negocio, política de venta a staff). Regla para el
  futuro, documentada junto al servicio: **todo campo que el POS renderice o use para
  calcular entra al hash**.

### 3.5 Recuperación cuando el servidor rechaza por datos viejos

Ante `PRICE_MISMATCH`, faltante de stock, `REGISTER_SESSION_STALE` o tope de venta a staff:
evictar lo relacionado, volver a consultar, re-preciar el carrito y pedir confirmación con un
mensaje claro ("Los precios cambiaron. Revisa el total."). Nunca un callejón sin salida.
Primer paso de la tarea: documentar qué hace hoy el cobro en cada caso.

### 3.6 Detectar despliegue nuevo

El build publica `version.json`. Se consulta al reconectar el socket (un despliegue del API
siempre tira la conexión) y al desbloquear con PIN; si cambió: recarga automática cuando el
POS está bloqueado o sin venta en curso; si hay venta en curso, franja "Hay una versión
nueva; se actualizará al terminar". Importante para este lote, que cambia API y POS a la vez.
El API mantiene cambios de schema aditivos para tolerar clientes viejos durante el despliegue.

## 4. Diseño — consistencia POS ↔ Admin

### 4.1 Tabla de cifras (fuente única)

Se completa en la primera tarea y queda en `bienbravo-api/docs/`. Base:

| Cifra | Definición única en el API | POS | Admin |
|---|---|---|---|
| Vendido del día | Σ `Sale.totalCents` de ventas `PAID`, día local de la sucursal | Ventas del día | Hoy, Finanzas → Ventas |
| Efectivo / Tarjeta / Transfer. | Σ `PaymentTransaction` `SUCCEEDED` por canal (`channelForProvider`) | Caja | Hoy, Finanzas → Ventas, cajas |
| Esperado en caja | `expected*Cents` + ajustes (spec de corrección de pago) | Caja | Historial de cajas |
| Comisión del barbero | `CommissionLedgerService` (spec de comisiones) | Hoy, Mi día | Hoy, Ventas, nómina, detalle de venta |
| Descuentos | cupones + descuento staff | Recibo | Finanzas → Ventas |

### 4.2 Prueba de consistencia (la pieza más importante)

Una prueba e2e en el API que arma un día completo (ventas en efectivo, tarjeta y mixtas,
propina, cupón, anulación, reembolso, corrección de pago, edición de comisión, venta a staff)
y afirma que **todas las fuentes de cada cifra coinciden**: `posDaySales` = suma de `sales` =
`dashboardSummary` = `posRevenueSummary`; ledger = `staffDayEarnings` = `DailyStaffMetrics` =
`staffCommissionSummary`; esperado en caja = pagos por canal + fondo + ajustes. Es el candado
de todo el lote: cualquier tarea que rompa una igualdad no pasa.

### 4.3 Tablas materializadas confiables (H2 ampliado)

- Tarea programada nocturna (el `ScheduleModule` ya está registrado) que recalcula
  `DailyLocationMetrics` y `DailyStaffMetrics` de ayer y hoy por sucursal.
- La misma tarea compara lo materializado contra el cálculo en vivo; si difieren, corrige y
  registra una alerta "métricas desfasadas" en el centro de alertas del admin.
- Los comentarios que hoy prometen este recálculo pasan a ser ciertos.
- Una sola instancia del API hoy; si algún día escala, la tarea necesita candado (advisory
  lock, patrón ya usado en el proyecto).

### 4.4 Admin

Las pantallas de dinero ya usan `cache-and-network`. Se agrega: toda mutation de este lote
(corrección de pago, edición de comisión, ajustes, política) invalida o vuelve a consultar
las consultas afectadas, para que dos pantallas del admin nunca se contradigan entre sí.

## 5. Regla transversal para todas las tareas del lote

Una tarea que agrega o cambia una cifra no está terminada hasta que: (1) la cifra se define en
el API y está en la tabla de 4.1; (2) dice qué pantallas de POS y admin la muestran; (3) tras
la mutation se refrescan ambos clientes (evict/refetch en admin; clase VIVO o hash en POS);
(4) la cifra entra a la prueba de 4.2.

## 6. Pruebas

POS (Vitest): **lo que se escribe en `localStorage` contiene solo campos de la lista de
permitidos** (la prueba falla si aparece `posDaySales`, `staffDayEarnings`, `registers`, un
cliente o cualquier campo no listado); un campo nuevo sin clasificar no se persiste; montar
Ventas del día, Hoy o Caja **siempre** dispara red y muestra esqueleto, nunca una cifra previa;
los cinco estados de `MoneyValue` (en particular: error y sin conexión nunca pintan `$0` ni la
cifra previa; un evento pone "actualizando" y a 1 s pasa a esqueleto; un `0` real se pinta
como `0`); al bloquear, los campos DINERO/SENSIBLE salen de la memoria; el primer arranque purga el caché
guardado anterior; un evento de venta refresca solo las pantallas del tema "ventas"; ráfaga de 10
eventos produce un solo refresco; **reconexión del socket refresca todo una vez**; no hay
ninguna consulta en reposo (ningún temporizador de sondeo); no refresca durante un cobro;
desbloqueo refresca; el botón "Actualizar" fuerza red y actualiza la hora; socket caído
muestra el aviso; cambio de versión recarga pantallas montadas; rechazo por precio re-precia
el carrito; `version.json` distinto recarga solo si no hay venta en curso. API: cada mutation
del lote publica su evento y el evento no lleva montos; hash cambia con cada campo nuevo;
tarea nocturna corrige y alerta; prueba de consistencia de 4.2.

## 7. Orden de entrega

1. pos: inventario y clasificación (3.1) + persistencia (3.2) + `FreshnessProvider` con canal
   único, puesta al día al reconectar, botón y estado de conexión (3.3). **Resuelve R8.**
2. api: eventos nuevos (3.3 c), hash ampliado (3.4) y tarea nocturna (4.3). En paralelo con 1.
3. pos: versión ampliada (3.4), recuperación (3.5), despliegue nuevo (3.6).
4. api: prueba de consistencia (4.2) — crece conforme entran los demás specs.
5. admin: invalidaciones de 4.4, junto con cada feature.

Los pasos 1 y 2 no dependen de ningún otro spec y conviene que salgan primero: todo lo demás
del lote se verá bien en el POS gracias a ellos.

## 8. Fuera de alcance

Modo sin conexión; mover el caché a IndexedDB; pubsub con Redis; conservar el carrito al
bloquear; reescribir el admin para leer agregados del servidor en vez de sumar listas (se
evalúa si la prueba de 4.2 muestra diferencias).
