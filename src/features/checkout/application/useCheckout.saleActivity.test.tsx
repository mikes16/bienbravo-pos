import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RepositoryProvider } from '@/core/repositories/RepositoryProvider'
import { LocationProvider } from '@/core/location/LocationProvider'
import { PosAuthProvider } from '@/core/auth/PosAuthProvider'
import { ToastProvider } from '@/core/toast/ToastProvider'
import { FreshnessContext, type FreshnessContextValue } from '@/core/freshness/FreshnessProvider'
import { getSaleActivitySnapshot, resetSaleActivity } from '@/core/auth/saleActivity'
import { createMockRepositories } from '@/test/mocks/repositories'
import type { Repositories } from '@/core/repositories/registry'
import { CheckoutRejectedError } from '../domain/checkout.types'
import type { SaleResult as ApiSaleResult } from '../domain/checkout.types'
import { useCheckout } from './useCheckout'

/**
 * Qué publica el cobro al bloqueo automático (spec § 3.3): `inProgress`
 * mientras hay una venta abierta y `submitting` mientras la venta viaja al
 * API. Aquí se prueba el CONTRATO con `core/auth/saleActivity` y la pausa del
 * canal de frescura; el resto del cobro (precios, cupones, pagos) vive en
 * CheckoutPage.test.tsx.
 */

const SESSION = {
  id: 'sess-1',
  status: 'OPEN' as const,
  openedAt: '2026-09-19T15:00:00.000Z',
  closedAt: null,
  openingCashCents: 0,
  expectedCashCents: 0,
  expectedCardCents: 0,
  expectedTransferCents: 0,
  countedCashCents: null,
  countedCardCents: null,
  countedTransferCents: null,
}
const REGISTER = { id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1', openSession: SESSION }

/** Producto del catálogo mock: no pasa por el resolver de precio por barbero. */
const CERA = {
  kind: 'product' as const,
  id: 'prod-1',
  name: 'Cera para cabello',
  priceCents: 25000,
  categoryId: null,
}
const CASH_PAYMENT = { payments: [{ provider: 'CASH' as const, amountCents: 25000 }], tipCents: 0 }
const SALE_OK: ApiSaleResult = {
  id: 'sale-1',
  status: 'PAID',
  paymentStatus: 'PAID',
  totalCents: 25000,
  paidTotalCents: 25000,
}

/** Promesa que el test resuelve cuando quiere: deja la venta "en vuelo". */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  // Sin este no-op, un reject antes del await del test se reporta como
  // unhandled rejection y ensucia la corrida.
  promise.catch(() => {})
  return { promise, resolve, reject }
}

function makeRepos(): Repositories {
  const repos = createMockRepositories()
  // Sin caja abierta el submit ni siquiera arranca (devuelve con error).
  repos.register.getRegisters = vi.fn().mockResolvedValue([REGISTER])
  return repos
}

function renderCheckout(repos: Repositories) {
  const setPaused = vi.fn()
  const freshness: FreshnessContextValue = {
    connection: 'connected',
    lastUpdatedAt: null,
    refreshAll: () => {},
    setPaused,
    register: () => () => {},
  }
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={['/checkout']}>
        <RepositoryProvider value={repos}>
          <LocationProvider>
            <PosAuthProvider>
              <ToastProvider>
                <FreshnessContext.Provider value={freshness}>{children}</FreshnessContext.Provider>
              </ToastProvider>
            </PosAuthProvider>
          </LocationProvider>
        </RepositoryProvider>
      </MemoryRouter>
    )
  }
  return { ...renderHook(() => useCheckout(), { wrapper: Wrapper }), setPaused }
}

/** Monta el cobro y espera a que catálogo, barberos y caja estén cargados. */
async function mountLoaded(repos: Repositories) {
  const view = renderCheckout(repos)
  await waitFor(() => expect(view.result.current.loaded).toBe(true))
  // Deja aterrizar el overlay de precios (segunda tanda de promesas).
  await act(async () => {})
  return view
}

describe('useCheckout · venta en curso y envío (core/auth/saleActivity)', () => {
  beforeEach(() => {
    // En beforeEach y NUNCA en afterEach: ahí el hook sigue montado y la
    // notificación del store cae fuera de `act`.
    resetSaleActivity()
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('agregar un concepto abre la venta y vaciar el carrito la cierra', async () => {
    const { result } = await mountLoaded(makeRepos())
    expect(getSaleActivitySnapshot().inProgress).toBe(false)

    act(() => {
      result.current.addCatalogItem(CERA)
    })
    expect(getSaleActivitySnapshot().inProgress).toBe(true)

    const lineId = result.current.cartState.lines[0].id
    act(() => {
      result.current.dispatch({ type: 'removeLine', lineId })
    })
    expect(result.current.cartState.lines).toHaveLength(0)
    expect(getSaleActivitySnapshot().inProgress).toBe(false)
  })

  it('mientras la venta viaja publica el envío y pausa los refrescos', async () => {
    const repos = makeRepos()
    const sale = deferred<ApiSaleResult>()
    repos.checkout.createSale = vi.fn(() => sale.promise)
    const { result, setPaused } = await mountLoaded(repos)

    act(() => {
      result.current.addCatalogItem(CERA)
    })
    expect(getSaleActivitySnapshot().submitting).toBe(false)

    let submitted: Promise<unknown> = Promise.resolve(null)
    act(() => {
      submitted = result.current.submit(CASH_PAYMENT)
    })
    expect(getSaleActivitySnapshot().submitting).toBe(true)
    expect(setPaused).toHaveBeenLastCalledWith(true)

    await act(async () => {
      sale.resolve(SALE_OK)
      await submitted
    })
    expect(getSaleActivitySnapshot().submitting).toBe(false)
    expect(setPaused).toHaveBeenLastCalledWith(false)
  })

  it('el envío se cierra y el canal se reanuda también cuando el cobro falla', async () => {
    const repos = makeRepos()
    const sale = deferred<ApiSaleResult>()
    repos.checkout.createSale = vi.fn(() => sale.promise)
    const { result, setPaused } = await mountLoaded(repos)

    act(() => {
      result.current.addCatalogItem(CERA)
    })
    let submitted: Promise<unknown> = Promise.resolve(null)
    act(() => {
      submitted = result.current.submit(CASH_PAYMENT)
    })
    expect(getSaleActivitySnapshot().submitting).toBe(true)

    await act(async () => {
      sale.reject(new Error('No hay red.'))
      await submitted
    })
    expect(getSaleActivitySnapshot().submitting).toBe(false)
    expect(setPaused).toHaveBeenLastCalledWith(false)
    expect(result.current.error).toBe('No hay red.')
    // El carrito conserva sus líneas: la venta sigue abierta para reintentar,
    // así que el operador conserva el plazo largo del bloqueo.
    expect(getSaleActivitySnapshot().inProgress).toBe(true)
  })

  /**
   * Venta a staff ([D-039]): el rechazo NO es recuperable, pero tampoco puede
   * dejar el cobro colgado. El envío se cierra igual que en cualquier fallo y
   * el mensaje del API queda en `error` — nunca en `rejectionNotice`, que es
   * el aviso de "ya me puse al día" ([D-035]).
   */
  it('un rechazo de venta a staff cierra el envío y deja el mensaje del API a la vista', async () => {
    const repos = makeRepos()
    const sale = deferred<ApiSaleResult>()
    repos.checkout.createSale = vi.fn(() => sale.promise)
    const { result, setPaused } = await mountLoaded(repos)

    act(() => {
      result.current.addCatalogItem(CERA)
    })
    let submitted: Promise<unknown> = Promise.resolve(null)
    act(() => {
      submitted = result.current.submit(CASH_PAYMENT)
    })
    expect(getSaleActivitySnapshot().submitting).toBe(true)

    await act(async () => {
      sale.reject(
        new CheckoutRejectedError('STAFF_SALE_VARIANT_REQUIRED', 'Elige la variante antes de cobrar.'),
      )
      await submitted
    })

    expect(result.current.submitting).toBe(false)
    expect(getSaleActivitySnapshot().submitting).toBe(false)
    expect(setPaused).toHaveBeenLastCalledWith(false)
    expect(result.current.error).toBe('Elige la variante antes de cobrar.')
    expect(result.current.rejectionNotice).toBeNull()
    // El carrito se conserva: la venta sigue abierta para corregir y reintentar.
    expect(result.current.cartState.lines).toHaveLength(1)
    expect(getSaleActivitySnapshot().inProgress).toBe(true)
  })

  it('al llegar al recibo ya no hay venta en curso', async () => {
    const repos = makeRepos()
    repos.checkout.createSale = vi.fn().mockResolvedValue(SALE_OK)
    const { result } = await mountLoaded(repos)

    act(() => {
      result.current.addCatalogItem(CERA)
    })
    expect(getSaleActivitySnapshot().inProgress).toBe(true)

    await act(async () => {
      await result.current.submit(CASH_PAYMENT)
    })
    // Pantalla de recibo: successSale pintado y el POS vuelve al plazo corto.
    expect(result.current.successSale).not.toBeNull()
    expect(getSaleActivitySnapshot()).toEqual({ inProgress: false, submitting: false })
  })

  it('desmontar el cobro limpia ambas banderas', async () => {
    const { result, unmount } = await mountLoaded(makeRepos())

    act(() => {
      result.current.addCatalogItem(CERA)
    })
    expect(getSaleActivitySnapshot().inProgress).toBe(true)

    unmount()
    expect(getSaleActivitySnapshot()).toEqual({ inProgress: false, submitting: false })
  })
})
