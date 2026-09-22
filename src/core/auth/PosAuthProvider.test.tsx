import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useContext, type ReactNode } from 'react'
import { InMemoryCache, type ApolloClient, type NormalizedCacheObject } from '@apollo/client'
import { PosAuthProvider, PosAuthContext } from './PosAuthProvider'
import { ApolloAuthRepository } from './auth.repository'
import { SENSITIVE_ROOT_FIELDS, STATIC_ROOT_FIELDS, rootFieldName } from '@/core/apollo/dataClasses'
import { RepositoryProvider } from '@/core/repositories/RepositoryProvider'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

const STORAGE_KEY_LOCKED = 'bb-pos-locked'

class AlreadySignedInAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

class NoSessionAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return null
  }
}

/**
 * Cuenta las evicciones de la clase DINERO/SENSIBLE. El mock no tiene cache
 * real, así que aquí solo verificamos QUIÉN dispara el borrado; QUÉ se borra
 * se prueba abajo contra un InMemoryCache de verdad.
 */
class CountingAuthRepo extends AlreadySignedInAuthRepo {
  sensitiveEvictions = 0
  override evictSensitiveCache(): void {
    this.sensitiveEvictions += 1
  }
}

function Wrapper({ children, auth }: { children: ReactNode; auth: InMemoryAuthRepository }) {
  const repos = { ...createMockRepositories(), auth }
  return (
    <RepositoryProvider value={repos}>
      <PosAuthProvider>{children}</PosAuthProvider>
    </RepositoryProvider>
  )
}

function Probe() {
  const ctx = useContext(PosAuthContext)
  if (!ctx) return null
  return (
    <div>
      <span data-testid="locked">{ctx.isLocked ? 'locked' : 'unlocked'}</span>
      <span data-testid="auth">{ctx.isAuthenticated ? 'auth' : 'anon'}</span>
      <button type="button" onClick={ctx.lock}>do-lock</button>
      <button type="button" onClick={ctx.unlock}>do-unlock</button>
      <button type="button" onClick={() => void ctx.logout()}>do-logout</button>
    </div>
  )
}

describe('PosAuthProvider lock persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('initial isLocked reads from localStorage so a soft-lock survives reload', async () => {
    window.localStorage.setItem(STORAGE_KEY_LOCKED, 'true')
    await act(async () => {
      render(
        <Wrapper auth={new AlreadySignedInAuthRepo()}>
          <Probe />
        </Wrapper>,
      )
    })
    expect(screen.getByTestId('locked').textContent).toBe('locked')
    expect(screen.getByTestId('auth').textContent).toBe('auth')
  })

  it('clears the persisted lock when getViewer returns null (cookie expired)', async () => {
    window.localStorage.setItem(STORAGE_KEY_LOCKED, 'true')
    await act(async () => {
      render(
        <Wrapper auth={new NoSessionAuthRepo()}>
          <Probe />
        </Wrapper>,
      )
    })
    expect(screen.getByTestId('locked').textContent).toBe('unlocked')
    expect(window.localStorage.getItem(STORAGE_KEY_LOCKED)).toBeNull()
  })

  it('lock() writes the persisted flag; unlock() removes it', async () => {
    let result!: { unmount: () => void }
    await act(async () => {
      result = render(
        <Wrapper auth={new AlreadySignedInAuthRepo()}>
          <Probe />
        </Wrapper>,
      )
    })

    expect(window.localStorage.getItem(STORAGE_KEY_LOCKED)).toBeNull()

    await act(async () => {
      screen.getByText('do-lock').click()
    })
    expect(window.localStorage.getItem(STORAGE_KEY_LOCKED)).toBe('true')
    expect(screen.getByTestId('locked').textContent).toBe('locked')

    await act(async () => {
      screen.getByText('do-unlock').click()
    })
    expect(window.localStorage.getItem(STORAGE_KEY_LOCKED)).toBeNull()
    expect(screen.getByTestId('locked').textContent).toBe('unlocked')

    result.unmount()
  })

  it('logout() clears the persisted lock and the last-barber memory', async () => {
    window.localStorage.setItem(STORAGE_KEY_LOCKED, 'true')
    window.localStorage.setItem('bb-pos-last-barber-id', 'barber-1')
    await act(async () => {
      render(
        <Wrapper auth={new AlreadySignedInAuthRepo()}>
          <Probe />
        </Wrapper>,
      )
    })

    await act(async () => {
      screen.getByText('do-logout').click()
    })

    expect(window.localStorage.getItem(STORAGE_KEY_LOCKED)).toBeNull()
    expect(window.localStorage.getItem('bb-pos-last-barber-id')).toBeNull()
    expect(screen.getByTestId('auth').textContent).toBe('anon')
    expect(screen.getByTestId('locked').textContent).toBe('unlocked')
  })
})

describe('PosAuthProvider: bloquear borra el dinero y los clientes de la memoria', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('lock() evicta lo sensible; unlock() no vuelve a evictar', async () => {
    const auth = new CountingAuthRepo()
    await act(async () => {
      render(
        <Wrapper auth={auth}>
          <Probe />
        </Wrapper>,
      )
    })
    expect(auth.sensitiveEvictions).toBe(0)

    await act(async () => {
      screen.getByText('do-lock').click()
    })
    expect(auth.sensitiveEvictions).toBe(1)

    await act(async () => {
      screen.getByText('do-unlock').click()
    })
    // Desbloquear no borra nada: lo sensible ya se fue al bloquear y el
    // catálogo/viewer se conservan para que el PIN entre instantáneo.
    expect(auth.sensitiveEvictions).toBe(1)
    expect(screen.getByTestId('locked').textContent).toBe('unlocked')
  })

  it('logout() también evicta lo sensible', async () => {
    const auth = new CountingAuthRepo()
    await act(async () => {
      render(
        <Wrapper auth={auth}>
          <Probe />
        </Wrapper>,
      )
    })

    await act(async () => {
      screen.getByText('do-logout').click()
    })
    expect(auth.sensitiveEvictions).toBe(1)
    expect(screen.getByTestId('auth').textContent).toBe('anon')
  })
})

/**
 * Cache normalizado con una muestra de cada clase: TODOS los campos sensibles
 * (generados desde dataClasses, para que un campo nuevo quede cubierto sin
 * tocar este test), catálogo estático, viewer y las entidades normalizadas
 * donde vive de verdad el dinero y la PII.
 */
const SALE_TOTAL_CENTS = 45500
const COMMISSION_CENTS = 133700
const CUSTOMER_NAME = 'Ana Pérez'
const CUSTOMER_PHONE = '+528110000000'

function cacheWithEveryDataClass(): InMemoryCache {
  const rootQuery: Record<string, unknown> = {
    __typename: 'Query',
    // SESIÓN: lo que hace instantáneo el desbloqueo con PIN.
    viewer: { __typename: 'PosViewer', kind: 'STAFF' },
  }
  // ESTÁTICO: todo el catálogo, que debe sobrevivir intacto al bloqueo.
  for (const field of STATIC_ROOT_FIELDS) {
    rootQuery[`${field}({"locationId":"loc-1"})`] = `catalogo-${field}`
  }
  rootQuery['services({"locationId":"loc-1"})'] = [{ __ref: 'Service:svc-1' }]
  rootQuery['products({"locationId":"loc-1"})'] = [{ __ref: 'Product:prod-1' }]
  // Cada campo sensible, con args en la llave del store como los escribe Apollo.
  for (const field of SENSITIVE_ROOT_FIELDS) {
    rootQuery[`${field}({"locationId":"loc-1"})`] = `centinela-${field}`
  }
  // Y los tres que apuntan a entidades normalizadas con las cifras/PII reales.
  rootQuery['posDaySales({"locationId":"loc-1","date":"2026-09-22"})'] = [{ __ref: 'Sale:sale-1' }]
  rootQuery['searchCustomers({"q":"ana"})'] = [{ __ref: 'Customer:cus-1' }]
  rootQuery['staffCommissionToday({"staffUserId":"staff-1"})'] = COMMISSION_CENTS

  const cache = new InMemoryCache()
  cache.restore({
    ROOT_QUERY: rootQuery,
    'Service:svc-1': { __typename: 'Service', id: 'svc-1', name: 'Corte clásico', priceCents: 25000 },
    'Product:prod-1': { __typename: 'Product', id: 'prod-1', name: 'Pomada mate' },
    'Sale:sale-1': { __typename: 'Sale', id: 'sale-1', totalCents: SALE_TOTAL_CENTS },
    'Customer:cus-1': {
      __typename: 'Customer',
      id: 'cus-1',
      fullName: CUSTOMER_NAME,
      phone: CUSTOMER_PHONE,
    },
  } as unknown as NormalizedCacheObject)
  return cache
}

function repoOver(cache: InMemoryCache): ApolloAuthRepository {
  // evictSensitiveCache solo toca client.cache: no hace falta link ni red.
  return new ApolloAuthRepository({ cache } as unknown as ApolloClient)
}

describe('ApolloAuthRepository.evictSensitiveCache', () => {
  it('borra todos los campos raíz sensibles, incluidas sus variantes con args', () => {
    const cache = cacheWithEveryDataClass()
    repoOver(cache).evictSensitiveCache()

    const root = cache.extract().ROOT_QUERY as Record<string, unknown>
    const sobrantes = Object.keys(root).filter((key) =>
      (SENSITIVE_ROOT_FIELDS as readonly string[]).includes(rootFieldName(key)),
    )
    expect(sobrantes).toEqual([])
  })

  it('no deja las cifras ni la PII en la memoria del cache', () => {
    const cache = cacheWithEveryDataClass()
    repoOver(cache).evictSensitiveCache()

    // Aserción por valor literal, no por llaves: lo que importa es que el
    // siguiente barbero no pueda leer el dinero ni al cliente del anterior.
    const snapshot = JSON.stringify(cache.extract())
    expect(snapshot).not.toContain(String(SALE_TOTAL_CENTS))
    expect(snapshot).not.toContain(String(COMMISSION_CENTS))
    expect(snapshot).not.toContain(CUSTOMER_NAME)
    expect(snapshot).not.toContain(CUSTOMER_PHONE)
    // El gc() se lleva las entidades que solo colgaban de lo evictado.
    expect(snapshot).not.toContain('Sale:sale-1')
    expect(snapshot).not.toContain('Customer:cus-1')
  })

  it('conserva el catálogo y la sesión: desbloquear sigue siendo instantáneo', () => {
    const cache = cacheWithEveryDataClass()
    repoOver(cache).evictSensitiveCache()

    const snapshot = cache.extract()
    const root = snapshot.ROOT_QUERY as Record<string, unknown>
    expect(root.viewer).toBeDefined()
    for (const field of STATIC_ROOT_FIELDS) {
      expect(Object.keys(root).some((key) => rootFieldName(key) === field)).toBe(true)
    }
    expect(snapshot['Service:svc-1']).toBeDefined()
    expect(snapshot['Product:prod-1']).toBeDefined()
    expect(JSON.stringify(snapshot)).toContain('Corte clásico')
  })
})
