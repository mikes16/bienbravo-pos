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
