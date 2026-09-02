import { describe, it, expect } from 'vitest'
import { ApolloClient, ApolloLink, InMemoryCache, Observable } from '@apollo/client'
import { ApolloCheckoutRepository } from './checkout.repository'

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
