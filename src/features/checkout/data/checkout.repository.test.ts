import { describe, it, expect } from 'vitest'
import { ApolloClient, ApolloLink, InMemoryCache, Observable, gql } from '@apollo/client'
import { print } from 'graphql'
import { ApolloCheckoutRepository } from './checkout.repository'
import { CheckoutRejectedError } from '../domain/checkout.types'

/**
 * Regresión del "OCUPADO pegado": hasClockedIn/isOccupied son datos VIVOS —
 * cambian al completar/asignar servicios (incluso desde otra tablet) y
 * ninguna de esas mutaciones evicta `posAvailableBarbers` del cache (solo
 * clock in/out). Con cache-first + cache persistido en localStorage, el
 * snapshot "Javi ocupado" se quedaba pegado: el barbero terminaba su
 * servicio, abría el sheet de walk-in y "Atiende ya" lo seguía mostrando
 * OCUPADO/deshabilitado. getAvailableBarbers debe ir SIEMPRE a la red.
 */
function makeClientWithChangingOccupancy() {
  let requestCount = 0
  const link = new ApolloLink(
    () =>
      new Observable((observer) => {
        requestCount++
        observer.next({
          data: {
            posAvailableBarbers: [
              {
                __typename: 'PosAvailableBarber',
                id: 'b1',
                fullName: 'Javi Cruz',
                photoUrl: null,
                hasClockedIn: true,
                // Primer request: en servicio. Segundo: ya terminó (libre).
                isOccupied: requestCount === 1,
              },
            ],
          },
        })
        observer.complete()
      }),
  )
  const client = new ApolloClient({ link, cache: new InMemoryCache() })
  return { client, getRequestCount: () => requestCount }
}

describe('ApolloCheckoutRepository.getAvailableBarbers', () => {
  it('refetches occupancy from the network on every call instead of serving the cached snapshot', async () => {
    const { client, getRequestCount } = makeClientWithChangingOccupancy()
    const repo = new ApolloCheckoutRepository(client)

    const during = await repo.getAvailableBarbers('loc-1')
    expect(during[0].isOccupied).toBe(true)

    // El barbero terminó su servicio (el server ya lo reporta libre).
    // Reabrir el sheet debe verlo libre — no el snapshot cacheado.
    const after = await repo.getAvailableBarbers('loc-1')
    expect(after[0].isOccupied).toBe(false)
    expect(getRequestCount()).toBe(2)
  })
})

// Overlay de precios de combo por barbero: lockea la forma del query hermana
// (catalogCombos { id pricingFor { priceCents isExcluded } }) y que el repo
// mapee id + precio resuelto + exclusión. Es la mitad "display" del fix de
// dinero de combos.
function makeClientReturning(payload: Record<string, unknown>) {
  const link = new ApolloLink(
    () =>
      new Observable((observer) => {
        observer.next({ data: payload })
        observer.complete()
      }),
  )
  return new ApolloClient({ link, cache: new InMemoryCache() })
}

// Captura las variables enviadas a la mutation para verificar el payload que el
// repo arma (saleId, items, payments del delta, tipCents, registerSessionId).
function makeCapturingClient(payload: Record<string, unknown>) {
  const captured: { variables: Record<string, unknown> | null } = { variables: null }
  const link = new ApolloLink(
    (operation) =>
      new Observable((observer) => {
        captured.variables = operation.variables
        observer.next({ data: payload })
        observer.complete()
      }),
  )
  const client = new ApolloClient({ link, cache: new InMemoryCache() })
  return { client, captured }
}

describe('ApolloCheckoutRepository.getAppointmentPrepayState', () => {
  it('mapea los items de la venta prepagada a prepaidItems (filtra TIP) + prepaidTotalCents', async () => {
    const client = makeClientReturning({
      appointment: {
        __typename: 'Appointment',
        id: 'appt-1',
        staffNote: 'Cliente alérgico',
        sale: {
          __typename: 'Sale',
          id: 'sale-1',
          source: 'BOOKING_PREPAY_LINK',
          paymentStatus: 'PAID',
          paidTotalCents: 50000,
          totalCents: 50000,
          items: [
            { __typename: 'SaleItem', id: 'i1', itemType: 'SERVICE', name: 'Corte', qty: 1, unitPriceCents: 50000, totalCents: 50000, serviceId: 'svc-1', productId: null, catalogComboId: null, staffUserId: 'b1' },
            { __typename: 'SaleItem', id: 'i2', itemType: 'TIP', name: 'Propina', qty: 1, unitPriceCents: 5000, totalCents: 5000, serviceId: null, productId: null, catalogComboId: null, staffUserId: 'b1' },
          ],
          payments: [
            { __typename: 'PaymentTransaction', provider: 'STRIPE', processedAt: '2026-07-01T12:00:00.000Z', createdAt: '2026-07-01T12:00:00.000Z', note: null },
          ],
        },
      },
    })
    const repo = new ApolloCheckoutRepository(client)
    const state = await repo.getAppointmentPrepayState('appt-1')
    expect(state.isPrepaid).toBe(true)
    expect(state.prepaidSaleId).toBe('sale-1')
    expect(state.prepaidTotalCents).toBe(50000)
    expect(state.staffNote).toBe('Cliente alérgico')
    // La línea TIP queda fuera; solo el servicio pagado se muestra como PAGADO.
    expect(state.prepaidItems).toEqual([
      { id: 'i1', name: 'Corte', qty: 1, unitPriceCents: 50000, totalCents: 50000, serviceId: 'svc-1', productId: null, catalogComboId: null, staffUserId: 'b1' },
    ])
  })

  it('sin venta prepagada devuelve el default (prepaidItems vacío, prepaidTotalCents null)', async () => {
    const client = makeClientReturning({
      appointment: { __typename: 'Appointment', id: 'appt-1', staffNote: null, sale: null },
    })
    const repo = new ApolloCheckoutRepository(client)
    const state = await repo.getAppointmentPrepayState('appt-1')
    expect(state.isPrepaid).toBe(false)
    expect(state.prepaidItems).toEqual([])
    expect(state.prepaidTotalCents).toBeNull()
  })
})

describe('ApolloCheckoutRepository.addItemsToAppointmentSale', () => {
  it('envía saleId + items + payments del delta + tipCents + registerSessionId y devuelve el Sale', async () => {
    const { client, captured } = makeCapturingClient({
      addItemsToAppointmentSale: {
        __typename: 'Sale',
        id: 'sale-1',
        status: 'PAID',
        paymentStatus: 'PAID',
        totalCents: 78000,
        paidTotalCents: 78000,
      },
    })
    const repo = new ApolloCheckoutRepository(client)
    const result = await repo.addItemsToAppointmentSale({
      saleId: 'sale-1',
      items: [
        { serviceId: 'svc-corte', productId: null, catalogComboId: null, qty: 1, unitPriceCents: 28000, staffUserId: 'b1' },
      ],
      payments: [{ provider: 'CASH', amountCents: 28000 }],
      tipCents: 0,
      registerSessionId: 'sess-1',
    })
    expect(result).toMatchObject({ id: 'sale-1', status: 'PAID', paymentStatus: 'PAID', totalCents: 78000, paidTotalCents: 78000 })
    const input = captured.variables?.input as Record<string, unknown>
    expect(input.saleId).toBe('sale-1')
    expect(input.registerSessionId).toBe('sess-1')
    expect(input.tipCents).toBe(0)
    expect(input.payments).toEqual([{ provider: 'CASH', amountCents: 28000 }])
    expect(input.items).toEqual([
      { serviceId: 'svc-corte', productId: null, catalogComboId: null, qty: 1, unitPriceCents: 28000, staffUserId: 'b1' },
    ])
  })
})

describe('ApolloCheckoutRepository.getComboPricing', () => {
  it('mapea id + precio resuelto + isExcluded de catalogCombos.pricingFor', async () => {
    const client = makeClientReturning({
      catalogCombos: [
        { __typename: 'CatalogCombo', id: 'combo-1', pricingFor: { __typename: 'ResolvedComboPricing', priceCents: 45000, isExcluded: false } },
        { __typename: 'CatalogCombo', id: 'combo-2', pricingFor: { __typename: 'ResolvedComboPricing', priceCents: 0, isExcluded: true } },
      ],
    })
    const repo = new ApolloCheckoutRepository(client)
    const rows = await repo.getComboPricing('loc-1', 'barber-9')
    expect(rows).toEqual([
      { id: 'combo-1', priceCents: 45000, isExcluded: false },
      { id: 'combo-2', priceCents: 0, isExcluded: true },
    ])
  })
})

describe('ApolloCheckoutRepository.resolveComboPriceForBarber', () => {
  it('devuelve el precio resuelto + isExcluded del combo para el barbero', async () => {
    const client = makeClientReturning({
      catalogCombo: {
        __typename: 'CatalogCombo',
        id: 'combo-1',
        priceCents: 40000,
        pricingFor: { __typename: 'ResolvedComboPricing', priceCents: 45000, isExcluded: false },
      },
    })
    const repo = new ApolloCheckoutRepository(client)
    const resolved = await repo.resolveComboPriceForBarber('combo-1', 'loc-1', 'barber-9')
    expect(resolved).toEqual({ priceCents: 45000, isExcluded: false })
  })

  it('marca isExcluded=true cuando el barbero no ofrece el combo (nunca comitea $0 desde aquí)', async () => {
    const client = makeClientReturning({
      catalogCombo: {
        __typename: 'CatalogCombo',
        id: 'combo-1',
        priceCents: 40000,
        pricingFor: { __typename: 'ResolvedComboPricing', priceCents: 0, isExcluded: true },
      },
    })
    const repo = new ApolloCheckoutRepository(client)
    const resolved = await repo.resolveComboPriceForBarber('combo-1', 'loc-1', 'barber-x')
    expect(resolved.isExcluded).toBe(true)
  })
})

describe('ApolloCheckoutRepository.getSaleDetail', () => {
  it('suma las líneas TIP en tipCents y las saca de items', async () => {
    const client = makeClientReturning({
      sale: {
        __typename: 'Sale',
        id: 'sale-1',
        createdAt: '2026-09-02T15:56:00.000Z',
        subtotalCents: 28000,
        taxTotalCents: 0,
        totalCents: 30000,
        customer: null,
        payments: [{ __typename: 'PaymentTransaction', provider: 'CARD_TERMINAL', amountCents: 30000 }],
        items: [
          { __typename: 'SaleItem', itemType: 'SERVICE', qty: 1, unitPriceCents: 28000, totalCents: 28000, name: 'Corte Especializado', staffUser: { __typename: 'User', id: 'b1', fullName: 'Brandon' } },
          { __typename: 'SaleItem', itemType: 'TIP', qty: 1, unitPriceCents: 2000, totalCents: 2000, name: 'Propina', staffUser: { __typename: 'User', id: 'b1', fullName: 'Brandon' } },
        ],
        couponApplications: [],
      },
    })
    const repo = new ApolloCheckoutRepository(client)
    const detail = await repo.getSaleDetail('sale-1')
    expect(detail?.tipCents).toBe(2000)
    expect(detail?.totalCents).toBe(30000)
    expect(detail?.items.map((i) => i.name)).toEqual(['Corte Especializado'])
  })
})

/* ── Rechazos del API al cobrar (spec frescura § 3.5) ───────────────────────
 *
 * El servidor decide al cobrar. Si rechaza por datos viejos, el POS tiene que
 * saber POR QUÉ para recuperarse (re-preciar, recargar stock, mandar a hacer
 * el corte) en vez de pintar un texto suelto. Estos casos fijan la traducción
 * `extensions.code` → error tipado del dominio; la recuperación se prueba en
 * CheckoutPage.test.tsx.
 */
function makeClientRejectingWith(message: string, code?: string) {
  const link = new ApolloLink(
    () =>
      new Observable((observer) => {
        observer.next({
          data: null,
          errors: [code ? { message, extensions: { code } } : { message }],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        observer.complete()
      }),
  )
  return new ApolloClient({ link, cache: new InMemoryCache() })
}

const SALE_INPUT = {
  locationId: 'loc-1',
  registerSessionId: 'sess-1',
  customerId: 'cust-1',
  staffUserId: 'b1',
  items: [{ serviceId: 'svc-corte', productId: null, catalogComboId: null, qty: 1, unitPriceCents: 28000, staffUserId: 'b1' }],
  tipCents: 0,
  payments: [{ provider: 'CASH' as const, amountCents: 28000 }],
}

async function rejectionOf(client: ApolloClient): Promise<CheckoutRejectedError> {
  const repo = new ApolloCheckoutRepository(client)
  try {
    await repo.createSale(SALE_INPUT)
  } catch (err) {
    if (err instanceof CheckoutRejectedError) return err
    throw err
  }
  throw new Error('createSale no rechazó')
}

describe('ApolloCheckoutRepository.createSale — rechazos tipados', () => {
  it('PRICE_MISMATCH: el precio de la línea cambió', async () => {
    const rejection = await rejectionOf(
      makeClientRejectingWith('El precio de "Corte" cambió — recarga el catálogo e intenta de nuevo.', 'PRICE_MISMATCH'),
    )
    expect(rejection.code).toBe('PRICE_MISMATCH')
    // El mensaje del API viaja intacto: ya viene en español y accionable.
    expect(rejection.message).toMatch(/el precio de "corte" cambió/i)
  })

  it('BARBER_EXCLUDED: el barbero acreditado ya no ofrece el servicio', async () => {
    const rejection = await rejectionOf(
      makeClientRejectingWith('"Antonio" no ofrece "Corte" — elige otro barbero.', 'BARBER_EXCLUDED'),
    )
    expect(rejection.code).toBe('BARBER_EXCLUDED')
    expect(rejection.message).toMatch(/no ofrece "corte"/i)
  })

  it('REGISTER_SESSION_STALE: la caja abierta es de un día anterior', async () => {
    const rejection = await rejectionOf(
      makeClientRejectingWith(
        'La caja sigue abierta desde un día anterior. Haz el corte de caja y abre la de hoy antes de cobrar.',
        'REGISTER_SESSION_STALE',
      ),
    )
    expect(rejection.code).toBe('REGISTER_SESSION_STALE')
  })

  it('STOCK: se reconoce por el patrón del mensaje (el API lo lanza sin código propio)', async () => {
    const rejection = await rejectionOf(
      makeClientRejectingWith(
        'Stock insuficiente en esta sucursal:\nShampoo: 1 disponible(s), 3 solicitado(s)\nAjusta inventario antes de cobrar.',
        'INTERNAL_SERVER_ERROR',
      ),
    )
    expect(rejection.code).toBe('STOCK')
  })

  it('STOCK: también por código, para el día que el API lo tipe', async () => {
    const rejection = await rejectionOf(makeClientRejectingWith('No alcanza el inventario.', 'INSUFFICIENT_STOCK'))
    expect(rejection.code).toBe('STOCK')
  })

  it('UNKNOWN: cualquier otro código conserva su mensaje', async () => {
    const rejection = await rejectionOf(makeClientRejectingWith('No tienes permiso para cobrar.', 'FORBIDDEN'))
    expect(rejection.code).toBe('UNKNOWN')
    expect(rejection.message).toBe('No tienes permiso para cobrar.')
  })

  it('UNKNOWN: un fallo de red (sin GraphQLError) también sale tipado', async () => {
    const link = new ApolloLink(
      () =>
        new Observable((observer) => {
          observer.error(new Error('Failed to fetch'))
        }),
    )
    const rejection = await rejectionOf(new ApolloClient({ link, cache: new InMemoryCache() }))
    expect(rejection.code).toBe('UNKNOWN')
    expect(rejection.message).toMatch(/failed to fetch/i)
  })
})

describe('ApolloCheckoutRepository.addItemsToAppointmentSale — rechazos tipados', () => {
  it('traduce el código igual que createSale (mismas validaciones del API)', async () => {
    const repo = new ApolloCheckoutRepository(
      makeClientRejectingWith('El precio de "Barba" cambió — recarga el catálogo e intenta de nuevo.', 'PRICE_MISMATCH'),
    )
    await expect(
      repo.addItemsToAppointmentSale({
        saleId: 'sale-1',
        items: [{ serviceId: 'svc-barba', productId: null, catalogComboId: null, qty: 1, unitPriceCents: 15000, staffUserId: 'b1' }],
        payments: [{ provider: 'CASH', amountCents: 15000 }],
        tipCents: 0,
        registerSessionId: 'sess-1',
      }),
    ).rejects.toMatchObject({ name: 'CheckoutRejectedError', code: 'PRICE_MISMATCH' })
  })
})

describe('ApolloCheckoutRepository.evictCatalogCache', () => {
  it('tira catálogo y precios por línea del cache, y deja lo demás intacto', async () => {
    const cache = new InMemoryCache()
    cache.writeQuery({
      query: gql`query Seed($locationId: ID!, $date: String!) { services(locationId: $locationId) { id } posDaySales(locationId: $locationId, date: $date) { id } }`,
      variables: { locationId: 'loc-1', date: '2026-01-01' },
      data: {
        services: [{ __typename: 'Service', id: 'svc-corte' }],
        posDaySales: [{ __typename: 'Sale', id: 'sale-1' }],
      },
    })
    const repo = new ApolloCheckoutRepository(new ApolloClient({ link: ApolloLink.empty(), cache }))
    repo.evictCatalogCache()
    const root = cache.extract()['ROOT_QUERY'] as Record<string, unknown>
    expect(Object.keys(root).some((k) => k.startsWith('services'))).toBe(false)
    // Lo que no es catálogo no se toca: evictar de más borraría dinero que
    // otra pantalla acaba de traer de la red.
    expect(Object.keys(root).some((k) => k.startsWith('posDaySales'))).toBe(true)
  })
})

/* ── Venta a staff (spec venta a staff §4.2 y §4.3) ─────────────────────────
 *
 * El API es la autoridad: resuelve el precio staff (variante > producto >
 * costo), mide el cupo del mes y valida la línea al cobrar. El POS solo pide,
 * muestra y manda — estos casos fijan esa frontera.
 */

// Captura el DOCUMENTO enviado (además de las variables) para poder asertar
// qué campos pide el POS, no solo qué hace con la respuesta.
function makeQuerySpyClient(payload: Record<string, unknown>) {
  const sent: { queries: string[] } = { queries: [] }
  const link = new ApolloLink(
    (operation) =>
      new Observable((observer) => {
        sent.queries.push(print(operation.query))
        observer.next({ data: payload })
        observer.complete()
      }),
  )
  return { client: new ApolloClient({ link, cache: new InMemoryCache() }), sent }
}

const PRODUCTS_PAYLOAD = {
  products: [
    {
      __typename: 'Product',
      id: 'prod-pomada',
      name: 'Pomada Clásica',
      sku: 'POM-01',
      imageUrl: null,
      categoryId: 'cat-1',
      sortOrder: 0,
      isActive: true,
      staffSaleEligible: true,
      staffPriceResolvedCents: 12000,
      variants: [
        { __typename: 'ProductVariant', id: 'var-chica', priceCents: 25000, staffPriceResolvedCents: 12000 },
        { __typename: 'ProductVariant', id: 'var-grande', priceCents: 40000, staffPriceResolvedCents: 19000 },
      ],
    },
    {
      __typename: 'Product',
      id: 'prod-navaja',
      name: 'Navaja',
      sku: null,
      imageUrl: null,
      categoryId: null,
      sortOrder: 1,
      isActive: true,
      // No elegible Y sin precio staff: los dos motivos por los que el API
      // rechaza la línea. El POS los pinta, no los decide.
      staffSaleEligible: false,
      staffPriceResolvedCents: null,
      variants: [{ __typename: 'ProductVariant', id: 'var-navaja', priceCents: 30000, staffPriceResolvedCents: null }],
    },
  ],
}

describe('ApolloCheckoutRepository.getProducts — precio staff', () => {
  it('mapea elegibilidad y precio staff resuelto del producto y de cada variante', async () => {
    const { client } = makeQuerySpyClient(PRODUCTS_PAYLOAD)
    const products = await new ApolloCheckoutRepository(client).getProducts('loc-1')

    const pomada = products[0]
    expect(pomada.priceCents).toBe(25000)
    expect(pomada.staffSaleEligible).toBe(true)
    expect(pomada.staffPriceCents).toBe(12000)
    // Cada variante trae SU precio staff: es el que decide si la línea
    // necesita `productVariantId` y cuánto se cobra.
    expect(pomada.variants).toEqual([
      { id: 'var-chica', priceCents: 25000, staffPriceCents: 12000 },
      { id: 'var-grande', priceCents: 40000, staffPriceCents: 19000 },
    ])

    // null = no se puede vender a staff; nunca 0 (vender en $0 por falta de dato).
    const navaja = products[1]
    expect(navaja.staffSaleEligible).toBe(false)
    expect(navaja.staffPriceCents).toBeNull()
    expect(navaja.variants[0].staffPriceCents).toBeNull()
  })

  it('nunca pide el costo crudo del producto: solo el precio staff ya resuelto', async () => {
    const { client, sent } = makeQuerySpyClient(PRODUCTS_PAYLOAD)
    await new ApolloCheckoutRepository(client).getProducts('loc-1')
    // El costo es dato de administración: no tiene por qué llegar a una
    // terminal de mostrador ni quedar en el cache del dispositivo.
    expect(sent.queries[0]).not.toContain('costCents')
    expect(sent.queries[0]).toContain('staffPriceResolvedCents')
  })
})

const QUOTA_PAYLOAD = {
  staffSaleQuota: {
    __typename: 'StaffSaleQuota',
    enabled: true,
    allowServicesInTicket: true,
    unitsUsed: 5,
    unitsLimit: 6,
    unitsRemaining: 1,
    listAmountCentsUsed: 120000,
    listAmountCentsLimit: null,
    listAmountCentsRemaining: null,
    perProductLimit: 2,
    unitsByProduct: [{ __typename: 'StaffSaleProductUnits', productId: 'prod-pomada', units: 2 }],
  },
}

describe('ApolloCheckoutRepository.getStaffSaleQuota', () => {
  it('mapea el cupo del mes y distingue "sin tope" (null) de cero', async () => {
    const { client } = makeQuerySpyClient(QUOTA_PAYLOAD)
    const quota = await new ApolloCheckoutRepository(client).getStaffSaleQuota('loc-1', 'staff-9')
    expect(quota).toEqual({
      enabled: true,
      allowServicesInTicket: true,
      unitsUsed: 5,
      unitsLimit: 6,
      unitsRemaining: 1,
      listAmountCentsUsed: 120000,
      listAmountCentsLimit: null,
      listAmountCentsRemaining: null,
      perProductLimit: 2,
      unitsByProduct: [{ productId: 'prod-pomada', units: 2 }],
    })
  })

  it('va SIEMPRE a la red: el cupo cambia con cada compra, incluso desde otra iPad', async () => {
    let requests = 0
    const link = new ApolloLink(
      () =>
        new Observable((observer) => {
          requests++
          observer.next({
            data: {
              staffSaleQuota: {
                ...QUOTA_PAYLOAD.staffSaleQuota,
                // Otra terminal le vendió: ya no le queda cupo.
                unitsUsed: requests === 1 ? 5 : 6,
                unitsRemaining: requests === 1 ? 1 : 0,
              },
            },
          })
          observer.complete()
        }),
    )
    const repo = new ApolloCheckoutRepository(new ApolloClient({ link, cache: new InMemoryCache() }))

    const first = await repo.getStaffSaleQuota('loc-1', 'staff-9')
    expect(first.unitsRemaining).toBe(1)
    const second = await repo.getStaffSaleQuota('loc-1', 'staff-9')
    expect(second.unitsRemaining).toBe(0)
    expect(requests).toBe(2)
  })

  it('sin comprador explícito manda buyerStaffUserId null (= el de la sesión, lo resuelve el API)', async () => {
    const { client, captured } = makeCapturingClient(QUOTA_PAYLOAD)
    await new ApolloCheckoutRepository(client).getStaffSaleQuota('loc-1')
    expect(captured.variables).toEqual({ locationId: 'loc-1', buyerStaffUserId: null })
  })
})

const CREATED_SALE = {
  createPOSSale: {
    __typename: 'Sale',
    id: 'sale-9',
    status: 'PAID',
    paymentStatus: 'PAID',
    totalCents: 12000,
    paidTotalCents: 12000,
  },
}

describe('ApolloCheckoutRepository.createSale — venta a staff', () => {
  it('manda staffSale.buyerStaffUserId y el productVariantId de la línea', async () => {
    const { client, captured } = makeCapturingClient(CREATED_SALE)
    await new ApolloCheckoutRepository(client).createSale({
      ...SALE_INPUT,
      staffSale: { buyerStaffUserId: 'staff-9' },
      items: [
        { serviceId: null, productId: 'prod-pomada', catalogComboId: null, productVariantId: 'var-grande', qty: 1, unitPriceCents: 19000, staffUserId: 'b1' },
      ],
    })
    const input = captured.variables?.input as Record<string, unknown>
    // Solo viaja el COMPRADOR: precio staff, topes y permisos los resuelve el API.
    expect(input.staffSale).toEqual({ buyerStaffUserId: 'staff-9' })
    expect(input.items).toEqual([
      { serviceId: null, productId: 'prod-pomada', catalogComboId: null, productVariantId: 'var-grande', qty: 1, unitPriceCents: 19000, staffUserId: 'b1' },
    ])
  })

  it('sin staffSale el input es idéntico al de siempre (ni staffSale ni productVariantId)', async () => {
    const { client, captured } = makeCapturingClient(CREATED_SALE)
    await new ApolloCheckoutRepository(client).createSale(SALE_INPUT)
    const input = captured.variables?.input as Record<string, unknown>
    expect(input).toEqual({
      locationId: 'loc-1',
      registerSessionId: 'sess-1',
      customerId: 'cust-1',
      staffUserId: 'b1',
      completeWalkInId: null,
      completeAppointmentId: null,
      items: [{ serviceId: 'svc-corte', productId: null, catalogComboId: null, qty: 1, unitPriceCents: 28000, staffUserId: 'b1' }],
      tipCents: 0,
      payments: [{ provider: 'CASH', amountCents: 28000 }],
      appliedCouponCodes: [],
    })
    // `toEqual` ignora las llaves en undefined: lo que se verifica aquí es que
    // los campos nuevos NO existen en el payload de una venta normal.
    expect(Object.hasOwn(input, 'staffSale')).toBe(false)
    const [line] = input.items as Record<string, unknown>[]
    expect(Object.hasOwn(line, 'productVariantId')).toBe(false)
  })
})

describe('ApolloCheckoutRepository.createSale — rechazos de venta a staff', () => {
  it('STAFF_SALE_QUOTA_EXCEEDED: conserva el mensaje del API con el conteo del mes', async () => {
    const rejection = await rejectionOf(
      makeClientRejectingWith('Kevin lleva 5 de 6 productos este mes.', 'STAFF_SALE_QUOTA_EXCEEDED'),
    )
    expect(rejection.code).toBe('STAFF_SALE_QUOTA_EXCEEDED')
    expect(rejection.message).toBe('Kevin lleva 5 de 6 productos este mes.')
  })

  it('STAFF_SALE_NOT_ELIGIBLE: el API lo manda como BAD_USER_INPUT, se reconoce por el mensaje', async () => {
    const rejection = await rejectionOf(
      makeClientRejectingWith('"Navaja" no está disponible para venta a staff.', 'BAD_USER_INPUT'),
    )
    expect(rejection.code).toBe('STAFF_SALE_NOT_ELIGIBLE')
    expect(rejection.message).toMatch(/no está disponible para venta a staff/i)
  })

  it('STAFF_SALE_VARIANT_REQUIRED: falta elegir variante (también BAD_USER_INPUT)', async () => {
    const rejection = await rejectionOf(
      makeClientRejectingWith(
        'Elige la variante de "Pomada Clásica": sus variantes tienen precio de staff distinto.',
        'BAD_USER_INPUT',
      ),
    )
    expect(rejection.code).toBe('STAFF_SALE_VARIANT_REQUIRED')
    expect(rejection.message).toMatch(/elige la variante de "pomada clásica"/i)
  })

  it('un BAD_USER_INPUT que no es de venta a staff sigue siendo UNKNOWN', async () => {
    const rejection = await rejectionOf(makeClientRejectingWith('El total no cuadra con los pagos.', 'BAD_USER_INPUT'))
    expect(rejection.code).toBe('UNKNOWN')
  })

  it('el día que el API tipe los códigos, se reconocen sin mirar el texto', async () => {
    const eligible = await rejectionOf(makeClientRejectingWith('Producto no vendible a staff.', 'STAFF_SALE_NOT_ELIGIBLE'))
    expect(eligible.code).toBe('STAFF_SALE_NOT_ELIGIBLE')
    const variant = await rejectionOf(makeClientRejectingWith('Falta la variante.', 'STAFF_SALE_VARIANT_REQUIRED'))
    expect(variant.code).toBe('STAFF_SALE_VARIANT_REQUIRED')
  })
})
