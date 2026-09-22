import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { InMemoryCache } from '@apollo/client'
import type { NormalizedCacheObject } from '@apollo/client'
import { attachCachePersistence, pickPersistable } from './client'
import { PERSISTED_ROOT_FIELDS, classifyRootField, rootFieldName } from './dataClasses'

/**
 * REGLA DEL DUEÑO (18 sep 2026): el dinero nunca se muestra desde caché ni se
 * guarda en el dispositivo. Hasta ahora el POS escribía TODO `cache.extract()`
 * en localStorage: ventas, comisiones, caja y nombres/teléfonos de clientes
 * quedaban legibles en un iPad compartido y sobrevivían al bloqueo.
 *
 * Estos tests fijan la garantía: solo catálogo (STATIC) y sesión (SESSION) se
 * persisten, por LISTA DE PERMITIDOS — un campo raíz nuevo sin clasificar se
 * queda fuera.
 */

const STORAGE_KEY = 'bb-pos-apollo-cache'
const STORAGE_VERSION_KEY = 'bb-pos-apollo-cache-version'
// Valor fijo al que cae BUILD_ID cuando corre bajo vitest (el `define` de Vite
// no se aplica en tests).
const TEST_BUILD_ID = 'test'

// Cifras y PII con valores únicos: si alguna aparece en lo persistido, el
// `toContain` lo caza aunque el shape del snapshot cambie.
const DAY_SALES_TOTAL = 987654
const COMMISSION_TOTAL = 445566
const REGISTER_CASH = 778899
const CUSTOMER_NAME = 'Juan Pérez Sensible'
const CUSTOMER_PHONE = '8441112233'

function makeSnapshot(): NormalizedCacheObject {
  return {
    ROOT_QUERY: {
      __typename: 'Query',
      // STATIC — se persiste, con sus entidades alcanzables.
      'services({"locationId":"loc-1"})': [{ __ref: 'Service:svc-1' }],
      // SESSION — se persiste.
      viewer: {
        __typename: 'Viewer',
        kind: 'STAFF',
        permissions: ['pos.tab.home'],
        staff: { __ref: 'StaffUser:staff-1' },
      },
      // SENSITIVE — dinero: jamás se persiste.
      'posDaySales({"date":"2026-09-19","locationId":"loc-1"})': {
        __typename: 'PosDaySales',
        totalCents: DAY_SALES_TOTAL,
        sales: [{ __ref: 'Sale:sale-1' }],
      },
      'staffDayEarnings({"date":"2026-09-19","locationId":"loc-1","staffUserId":"staff-1"})': {
        __typename: 'StaffDayEarnings',
        commissionCents: COMMISSION_TOTAL,
      },
      staffCommissionToday: COMMISSION_TOTAL,
      'registers({"locationId":"loc-1"})': [{ __ref: 'Register:reg-1' }],
      'posCajaStatusHome({"locationId":"loc-1"})': {
        __typename: 'PosCajaStatus',
        openingCashCents: REGISTER_CASH,
      },
      // SENSITIVE — PII de cliente.
      'searchCustomers({"query":"jua"})': [{ __ref: 'Customer:cus-1' }],
      // SENSITIVE — cupo mensual de venta a staff: dato de staff, nunca persistido.
      'staffSaleQuota({"staffUserId":"staff-1"})': { __typename: 'StaffSaleQuota', remainingCents: 1 },
      // LIVE — sin dinero, pero tampoco se persiste.
      'walkIns({"locationId":"loc-1"})': [{ __ref: 'WalkIn:wi-1' }],
      // LIVE — ajustes del negocio (bloqueo automático): sin dinero, revalidado
      // siempre por el canal de frescura, tampoco se persiste.
      posSettings: {
        __typename: 'TenantSetting',
        posAutoLockIdleSeconds: 15,
        posAutoLockCheckoutSeconds: 90,
      },
      // Campo raíz que nadie clasificó todavía (el "futuro" del schema).
      'aFutureUnclassifiedField({"x":1})': { __typename: 'Whatever', secret: 'nope' },
    },
    ROOT_MUTATION: {
      __typename: 'Mutation',
      'createSale({"input":{}})': { __ref: 'Sale:sale-1' },
    },
    // Entidades alcanzables desde el catálogo / la sesión.
    'Service:svc-1': {
      __typename: 'Service',
      id: 'svc-1',
      name: 'Corte clásico',
      basePriceCents: 25000,
      category: { __ref: 'CatalogCategory:cat-1' },
    },
    'CatalogCategory:cat-1': { __typename: 'CatalogCategory', id: 'cat-1', name: 'Cortes' },
    'StaffUser:staff-1': { __typename: 'StaffUser', id: 'staff-1', fullName: 'Aarón Barbero' },
    // Entidades alcanzables SOLO desde campos de dinero / clientes.
    'Sale:sale-1': {
      __typename: 'Sale',
      id: 'sale-1',
      totalCents: DAY_SALES_TOTAL,
      customer: { __ref: 'Customer:cus-1' },
    },
    'Customer:cus-1': {
      __typename: 'Customer',
      id: 'cus-1',
      fullName: CUSTOMER_NAME,
      phone: CUSTOMER_PHONE,
    },
    'Register:reg-1': { __typename: 'Register', id: 'reg-1', openingCashCents: REGISTER_CASH },
    'WalkIn:wi-1': { __typename: 'WalkIn', id: 'wi-1', customerName: CUSTOMER_NAME },
  }
}

describe('pickPersistable — lista de permitidos del cache persistido', () => {
  it('conserva catálogo y sesión con sus entidades alcanzables', () => {
    const kept = pickPersistable(makeSnapshot())
    const rootKeys = Object.keys(kept.ROOT_QUERY as object)

    expect(rootKeys).toContain('services({"locationId":"loc-1"})')
    expect(rootKeys).toContain('viewer')
    expect(kept['Service:svc-1']).toBeDefined()
    // Alcance transitivo: Service → CatalogCategory, viewer → StaffUser.
    expect(kept['CatalogCategory:cat-1']).toBeDefined()
    expect(kept['StaffUser:staff-1']).toBeDefined()
  })

  it('descarta dinero (ventas, comisiones, caja) y datos de clientes', () => {
    const kept = pickPersistable(makeSnapshot())
    const rootKeys = Object.keys(kept.ROOT_QUERY as object)

    expect(rootKeys.some((k) => rootFieldName(k) === 'posDaySales')).toBe(false)
    expect(rootKeys.some((k) => rootFieldName(k) === 'staffDayEarnings')).toBe(false)
    expect(rootKeys.some((k) => rootFieldName(k) === 'staffCommissionToday')).toBe(false)
    expect(rootKeys.some((k) => rootFieldName(k) === 'registers')).toBe(false)
    expect(rootKeys.some((k) => rootFieldName(k) === 'posCajaStatusHome')).toBe(false)
    expect(rootKeys.some((k) => rootFieldName(k) === 'searchCustomers')).toBe(false)

    // Las entidades que solo colgaban de esos campos se van con ellos.
    expect(kept['Sale:sale-1']).toBeUndefined()
    expect(kept['Customer:cus-1']).toBeUndefined()
    expect(kept['Register:reg-1']).toBeUndefined()
    expect(kept.ROOT_MUTATION).toBeUndefined()

    // Garantía de fondo: ni una cifra ni un dato de cliente en el payload.
    const serialized = JSON.stringify(kept)
    expect(serialized).not.toContain(String(DAY_SALES_TOTAL))
    expect(serialized).not.toContain(String(COMMISSION_TOTAL))
    expect(serialized).not.toContain(String(REGISTER_CASH))
    expect(serialized).not.toContain(CUSTOMER_NAME)
    expect(serialized).not.toContain(CUSTOMER_PHONE)
  })

  it('descarta lo VIVO sin dinero y un campo raíz que nadie clasificó', () => {
    const kept = pickPersistable(makeSnapshot())
    const rootKeys = Object.keys(kept.ROOT_QUERY as object)

    expect(rootKeys.some((k) => rootFieldName(k) === 'walkIns')).toBe(false)
    expect(kept['WalkIn:wi-1']).toBeUndefined()

    // Lista de permitidos: un campo raíz sin clasificar se queda fuera.
    expect(classifyRootField('aFutureUnclassifiedField({"x":1})')).toBe('unclassified')
    expect(rootKeys.some((k) => rootFieldName(k) === 'aFutureUnclassifiedField')).toBe(false)
  })

  it('descarta posSettings (LIVE) y staffSaleQuota (SENSITIVE), y sí conserva el catálogo', () => {
    const kept = pickPersistable(makeSnapshot())
    const rootKeys = Object.keys(kept.ROOT_QUERY as object)

    expect(classifyRootField('posSettings')).toBe('live')
    expect(classifyRootField('staffSaleQuota({"staffUserId":"staff-1"})')).toBe('sensitive')
    expect(rootKeys.some((k) => rootFieldName(k) === 'posSettings')).toBe(false)
    expect(rootKeys.some((k) => rootFieldName(k) === 'staffSaleQuota')).toBe(false)
    expect(PERSISTED_ROOT_FIELDS.has('posSettings')).toBe(false)
    expect(PERSISTED_ROOT_FIELDS.has('staffSaleQuota')).toBe(false)

    // El catálogo sí sobrevive junto a ellos.
    expect(rootKeys).toContain('services({"locationId":"loc-1"})')
    expect(kept['Service:svc-1']).toBeDefined()
  })

  it('lee el nombre del campo sin importar args ni directivas', () => {
    expect(rootFieldName('services({"locationId":"loc-1"})')).toBe('services')
    expect(rootFieldName('walkIns@connection({"key":"q"})')).toBe('walkIns')
    expect(rootFieldName('viewer')).toBe('viewer')
  })

  it('aguanta referencias circulares y snapshots vacíos', () => {
    const circular: NormalizedCacheObject = {
      ROOT_QUERY: { __typename: 'Query', 'products({})': [{ __ref: 'Product:a' }] },
      'Product:a': { __typename: 'Product', id: 'a', twin: { __ref: 'Product:b' } },
      'Product:b': { __typename: 'Product', id: 'b', twin: { __ref: 'Product:a' } },
    }
    const kept = pickPersistable(circular)
    expect(kept['Product:a']).toBeDefined()
    expect(kept['Product:b']).toBeDefined()

    expect(pickPersistable({})).toEqual({})
  })
})

describe('attachCachePersistence — escritura, restore y purga por build', () => {
  let detach: (() => void) | null = null

  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    detach?.()
    detach = null
    window.localStorage.clear()
  })

  it('solo escribe en localStorage catálogo y sesión', () => {
    const cache = new InMemoryCache()
    const persistor = attachCachePersistence(cache)
    detach = persistor.stop

    cache.restore(makeSnapshot())
    persistor.flush()

    const raw = window.localStorage.getItem(STORAGE_KEY) ?? ''
    expect(raw).toContain('Corte clásico')
    expect(raw).not.toContain(String(DAY_SALES_TOTAL))
    expect(raw).not.toContain(String(COMMISSION_TOTAL))
    expect(raw).not.toContain(CUSTOMER_NAME)
    expect(window.localStorage.getItem(STORAGE_VERSION_KEY)).toBe(TEST_BUILD_ID)
  })

  it('al restaurar, descarta el dinero de un caché viejo del mismo build', () => {
    // Simula el caché escrito por la versión anterior (guardaba TODO).
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSnapshot()))
    window.localStorage.setItem(STORAGE_VERSION_KEY, TEST_BUILD_ID)

    const cache = new InMemoryCache()
    const persistor = attachCachePersistence(cache)
    detach = persistor.stop

    const restored = JSON.stringify(cache.extract())
    expect(restored).toContain('Corte clásico')
    expect(restored).not.toContain(String(DAY_SALES_TOTAL))
    expect(restored).not.toContain(CUSTOMER_NAME)
    expect(cache.extract()['Customer:cus-1']).toBeUndefined()
  })

  it('un build id distinto purga el caché guardado y arranca limpio', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSnapshot()))
    window.localStorage.setItem(STORAGE_VERSION_KEY, 'build-del-deploy-anterior')

    const cache = new InMemoryCache()
    const persistor = attachCachePersistence(cache)
    detach = persistor.stop

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem(STORAGE_VERSION_KEY)).toBeNull()
    expect(cache.extract().ROOT_QUERY).toBeUndefined()
  })

  it('purge borra lo guardado (logout / bloqueo de sesión)', () => {
    const cache = new InMemoryCache()
    const persistor = attachCachePersistence(cache)
    detach = persistor.stop

    cache.restore(makeSnapshot())
    persistor.flush()
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull()

    persistor.purge()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem(STORAGE_VERSION_KEY)).toBeNull()
  })
})
