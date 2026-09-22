/**
 * Clasificación de los campos raíz de `Query` que lee el POS. ÚNICA fuente de
 * verdad: la usan la persistencia del cache (`client.ts`) y, más adelante, las
 * políticas de refresco.
 *
 * REGLA DEL DUEÑO (18 sep 2026): **el dinero nunca se muestra desde caché ni se
 * guarda en el dispositivo.** Con varias iPads cobrando a la vez, una cifra
 * guardada está mal en cuanto otra iPad cobra. Además, el iPad es compartido:
 * ventas, comisiones y nombres/teléfonos de clientes NO pueden quedar legibles
 * en `localStorage` para el siguiente barbero (hallazgo de privacidad).
 *
 * Las cuatro clases (ver docs/superpowers/specs/2026-09-18-frescura-y-
 * consistencia-pos-admin-design.md §3.1):
 *
 * | Clase       | Persistido | Política de lectura                              |
 * |-------------|------------|--------------------------------------------------|
 * | STATIC      | sí         | cache-first, invalidado por versión de catálogo   |
 * | SESSION     | sí         | cache-first, revalidado al desbloquear con PIN    |
 * | SENSITIVE   | NUNCA      | siempre de la red (esqueleto mientras carga)      |
 * | LIVE        | NUNCA      | memoria de ESTA sesión + revalidación siempre     |
 *
 * INVARIANTE (lista de permitidos, no de excluidos): solo STATIC ∪ SESSION se
 * persiste. Un campo raíz nuevo que nadie clasifique queda fuera por defecto —
 * olvidarse de clasificar algo jamás termina guardando dinero en el dispositivo.
 * Al agregar una query nueva, clasifica su campo raíz aquí.
 */

export type DataClass = 'static' | 'session' | 'sensitive' | 'live' | 'unclassified'

/**
 * ESTÁTICO: catálogo y sucursales. Cambia cuando el admin publica, no durante
 * el día. Es lo pesado y lo que hace que el POS arranque instantáneo, así que
 * es lo único (junto a la sesión) que se guarda en el dispositivo. Su frescura
 * la controla el hash `catalogVersion` (BootstrapProvider), no el tiempo.
 *
 * `barbers` NO está aquí a propósito: el roster trae PII del staff (email,
 * teléfono, `pinAttempts`, `pinLockedUntil`) y no tiene por qué sobrevivir en
 * un iPad compartido. Se lee en vivo (ver LIVE).
 */
export const STATIC_ROOT_FIELDS = [
  'services',
  'products',
  'catalogCombos',
  'catalogCategories',
  // Sucursales del selector de lock screen: id/nombre/slug/timezone, sin PII.
  'posPublicLocations',
] as const

/**
 * SESIÓN: quién está logueado y qué puede hacer. Se persiste para que el
 * arranque no parpadee, y se revalida al desbloquear con PIN. El API sigue
 * siendo el que gatea el dato: un permiso stale aquí no abre nada.
 */
export const SESSION_ROOT_FIELDS = ['viewer'] as const

/**
 * DINERO / SENSIBLE: jamás se persiste y siempre se lee de la red. Cubre
 * ventas, comisiones, caja, detalle de venta, prepago de cita y todo dato de
 * cliente (búsqueda, ficha e historial son PII pura).
 */
export const SENSITIVE_ROOT_FIELDS = [
  // Ventas del día y detalle de una venta.
  'posDaySales',
  'sale',
  // Comisiones / Mi día (los tres escalares del encabezado de Hoy).
  'staffDayEarnings',
  'staffCommissionToday',
  'staffServiceRevenueToday',
  'staffProductRevenueToday',
  // Caja: sesión abierta, conteos y corte.
  'registers',
  'posCajaStatusHome',
  // Cita individual: trae la venta prepagada (paidTotalCents, payments).
  'appointment',
  // Clientes (PII): búsqueda, ficha e historial de visitas.
  'searchCustomers',
  'customer',
  'customerAppointments',
] as const

/**
 * VIVO sin dinero: se puede pintar desde la memoria de ESTA sesión y se
 * revalida siempre, pero nunca sobrevive a un arranque.
 *
 * `posAvailableBarbers` incluye el estado laboral (`hasClockedIn`,
 * `isOccupied`) — por eso deja de ser "estático" pese a parecer catálogo.
 * `service`/`catalogCombo` (singulares) resuelven el precio de UNA línea al
 * cobrar: no se persisten porque el evict por versión de catálogo solo cubre
 * los campos raíz plurales, así que un singular guardado dejaría vivo un
 * precio viejo tras un cambio de catálogo. La autoridad final del precio es el
 * API (PRICE_MISMATCH server-side).
 */
export const LIVE_ROOT_FIELDS = [
  'walkIns',
  'suggestedNextWalkIn',
  'appointments',
  'posAvailableBarbers',
  'barbers',
  'posInventoryLevels',
  // Reloj / fichajes.
  'timeClockEvents',
  'staffWorkingWindows',
  'latenessRule',
  // Gate de catálogo y seguridad del PIN: siempre frescos, nunca guardados.
  'catalogVersion',
  'posPinLockoutStatus',
  // Resolución puntual de precio al cobrar.
  'service',
  'catalogCombo',
] as const

/**
 * La lista de permitidos de la persistencia: STATIC ∪ SESSION. Todo lo demás
 * (incluido lo que no esté clasificado) se descarta antes de escribir en
 * `localStorage`.
 */
export const PERSISTED_ROOT_FIELDS: ReadonlySet<string> = new Set<string>([
  ...STATIC_ROOT_FIELDS,
  ...SESSION_ROOT_FIELDS,
])

const SENSITIVE_SET: ReadonlySet<string> = new Set<string>(SENSITIVE_ROOT_FIELDS)
const LIVE_SET: ReadonlySet<string> = new Set<string>(LIVE_ROOT_FIELDS)
const STATIC_SET: ReadonlySet<string> = new Set<string>(STATIC_ROOT_FIELDS)
const SESSION_SET: ReadonlySet<string> = new Set<string>(SESSION_ROOT_FIELDS)

/**
 * Las llaves de `ROOT_QUERY` en el cache normalizado llevan los argumentos
 * pegados: `services({"locationId":"loc-1"})`, `posDaySales({...})`, y con
 * directivas `walkIns@connection(...)`. Nos quedamos con el nombre del campo.
 */
export function rootFieldName(storeFieldName: string): string {
  const cut = storeFieldName.search(/[(@:]/)
  return cut === -1 ? storeFieldName : storeFieldName.slice(0, cut)
}

/** ¿Este campo raíz puede guardarse en el dispositivo? */
export function isPersistable(storeFieldName: string): boolean {
  return PERSISTED_ROOT_FIELDS.has(rootFieldName(storeFieldName))
}

/** Dinero o datos de cliente: nunca persistido, siempre de la red. */
export function isSensitive(storeFieldName: string): boolean {
  return SENSITIVE_SET.has(rootFieldName(storeFieldName))
}

/** Vivo sin dinero: nunca persistido, revalidado siempre. */
export function isLive(storeFieldName: string): boolean {
  return LIVE_SET.has(rootFieldName(storeFieldName))
}

/** Clase de un campo raíz; `unclassified` para lo que nadie declaró aún. */
export function classifyRootField(storeFieldName: string): DataClass {
  const field = rootFieldName(storeFieldName)
  if (STATIC_SET.has(field)) return 'static'
  if (SESSION_SET.has(field)) return 'session'
  if (SENSITIVE_SET.has(field)) return 'sensitive'
  if (LIVE_SET.has(field)) return 'live'
  return 'unclassified'
}
