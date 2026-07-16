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
