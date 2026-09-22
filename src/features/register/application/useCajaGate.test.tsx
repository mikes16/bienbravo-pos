import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useCajaGate } from './useCajaGate'
import { RepositoryProvider } from '@/core/repositories/RepositoryProvider'
import {
  FreshnessContext,
  type FreshnessContextValue,
  type FreshnessLoader,
  type FreshnessTopic,
} from '@/core/freshness/FreshnessProvider'
import { createMockRepositories } from '@/test/mocks/repositories'
import type { Repositories } from '@/core/repositories/registry'
import type { CajaStatus } from '../domain/register.types'

const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const STALE: CajaStatus = { isOpen: true, isStale: true, openedAt: YESTERDAY }
const CLOSED: CajaStatus = { isOpen: false, isStale: false, openedAt: null }

/**
 * Canal de frescura de mentira para `renderHook` — equivalente al stub que
 * `renderWithProviders` monta por default ([D-023]), que aquí no aplica porque
 * no hay árbol de pantalla. El test hace de servidor con `announce(tema)`.
 */
function createFreshnessHarness() {
  const registrations = new Set<{ load: FreshnessLoader; topics: readonly FreshnessTopic[] }>()
  const value: FreshnessContextValue = {
    connection: 'connected',
    lastUpdatedAt: null,
    refreshAll: () => {},
    setPaused: () => {},
    register: (load, topics) => {
      const entry = { load, topics }
      registrations.add(entry)
      return () => {
        registrations.delete(entry)
      }
    },
  }
  /**
   * Avisa del tema y devuelve CÓMO terminó cada carga registrada: el motor del
   * canal mira justo eso para decidir si mueve "Actualizado HH:MM".
   */
  async function announce(topic: FreshnessTopic): Promise<PromiseSettledResult<void>[]> {
    let settled: PromiseSettledResult<void>[] = []
    await act(async () => {
      settled = await Promise.allSettled(
        [...registrations]
          .filter((r) => r.topics.includes(topic))
          .map(async (r) => {
            await r.load()
          }),
      )
    })
    return settled
  }
  return { value, announce }
}

function wrapper(repos: Repositories, freshness: FreshnessContextValue) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RepositoryProvider value={repos}>
        <FreshnessContext.Provider value={freshness}>{children}</FreshnessContext.Provider>
      </RepositoryProvider>
    )
  }
}

/** El mismo árbol pero SIN canal: lo que ve el hook cuando `PosShell` se monta
 *  sin sesión (sus guardas corren después de los hooks) y `FreshnessGate` no
 *  montó el provider. */
function mountWithoutChannel(repos: Repositories) {
  return renderHook(() => useCajaGate('loc-1', '/hoy'), {
    wrapper: function Wrapper({ children }: { children: ReactNode }) {
      return <RepositoryProvider value={repos}>{children}</RepositoryProvider>
    },
  })
}

function mount(repos: Repositories, locationId: string | null = 'loc-1') {
  const freshness = createFreshnessHarness()
  const hook = renderHook(({ path }: { path: string }) => useCajaGate(locationId, path), {
    wrapper: wrapper(repos, freshness.value),
    initialProps: { path: '/hoy' },
  })
  return { ...hook, announce: freshness.announce }
}

function reposWith(getCajaStatus: () => Promise<CajaStatus>) {
  const repos = createMockRepositories()
  const spy = vi.fn(getCajaStatus)
  repos.register.getCajaStatus = spy
  return { repos, spy }
}

describe('useCajaGate', () => {
  it('consulta UNA vez al montar y no se revalida sola', async () => {
    const { repos, spy } = reposWith(async () => STALE)

    const { result } = mount(repos)

    await waitFor(() => expect(result.current).toEqual({ kind: 'stale', openedAt: YESTERDAY }))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('loc-1')
  })

  it('sin sucursal no consulta nada y deja pasar', () => {
    const { repos, spy } = reposWith(async () => STALE)

    const { result } = mount(repos, null)

    expect(result.current).toEqual({ kind: 'clear' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('sin canal arriba no lanza: el shell sin sesión tiene que llegar a su redirección', async () => {
    const { repos, spy } = reposWith(async () => STALE)

    // `useLiveRefresh` lanzaría aquí y la pantalla quedaría en blanco
    // ([D-029] / [D-030]); el registro es opcional, la consulta no.
    const { result } = mountWithoutChannel(repos)

    await waitFor(() => expect(result.current).toEqual({ kind: 'stale', openedAt: YESTERDAY }))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('el aviso del tema register lo suelta (el corte lo hizo otra iPad)', async () => {
    let status = STALE
    const { repos, spy } = reposWith(async () => status)

    const { result, announce } = mount(repos)
    await waitFor(() => expect(result.current.kind).toBe('stale'))

    status = CLOSED
    await announce('register')

    expect(result.current).toEqual({ kind: 'clear' })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('un aviso de otro tema (sales) no lo toca', async () => {
    const { repos, spy } = reposWith(async () => STALE)

    const { result, announce } = mount(repos)
    await waitFor(() => expect(result.current.kind).toBe('stale'))

    await announce('sales')

    expect(spy).toHaveBeenCalledTimes(1)
    expect(result.current.kind).toBe('stale')
  })

  it('si la consulta falla deja pasar (fail-open), pero el canal se entera', async () => {
    const { repos } = reposWith(async () => {
      throw new Error('network')
    })

    const { result, announce } = mount(repos)

    // Fail-open: un blip de red no atrapa al operador — el API rechaza igual
    // las ventas contra una caja de ayer.
    await waitFor(() => expect(result.current).toEqual({ kind: 'clear' }))

    // Y aun así la carga RECHAZA: el canal no puede mover su hora de
    // "Actualizado" con un dato que nunca llegó.
    const [settled] = await announce('register')
    expect(settled.status).toBe('rejected')
    expect(result.current).toEqual({ kind: 'clear' })
  })

  it('mientras bloquea, cambiar de ruta re-consulta (el wizard navega al cerrar)', async () => {
    let status = STALE
    const { repos, spy } = reposWith(async () => status)

    const { result, rerender } = mount(repos)
    await waitFor(() => expect(result.current.kind).toBe('stale'))

    status = CLOSED
    rerender({ path: '/caja' })

    await waitFor(() => expect(result.current).toEqual({ kind: 'clear' }))
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('sin bloqueo, cambiar de ruta NO consulta: navegar no es motivo para ir a la red', async () => {
    const { repos, spy } = reposWith(async () => CLOSED)

    const { result, rerender } = mount(repos)
    await waitFor(() => expect(result.current.kind).toBe('clear'))

    rerender({ path: '/caja' })
    await act(async () => {})

    expect(spy).toHaveBeenCalledTimes(1)
  })
})
