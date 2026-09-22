import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useRegister } from './useRegister'
import { RepositoryProvider } from '@/core/repositories/RepositoryProvider'
import {
  FreshnessContext,
  type FreshnessConnection,
  type FreshnessContextValue,
  type FreshnessLoader,
  type FreshnessTopic,
} from '@/core/freshness/FreshnessProvider'
import { createMockRepositories } from '@/test/mocks/repositories'
import type { Repositories } from '@/core/repositories/registry'
import type { RegisterSession } from '../domain/register.types'

const SESSION: RegisterSession = {
  id: 'sess-1',
  status: 'OPEN',
  openedAt: '2026-05-04T09:15:00.000Z',
  closedAt: null,
  openingCashCents: 50000,
  expectedCashCents: 184000,
  expectedCardCents: 254000,
  expectedTransferCents: 126000,
  countedCashCents: null,
  countedCardCents: null,
  countedTransferCents: null,
}

const REGISTERS = [
  { id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1', openSession: SESSION },
]

const CLOSE_INPUT = {
  sessionId: 'sess-1',
  countedCashCents: 0,
  countedCardCents: 0,
  countedTransferCents: 0,
}

/**
 * Canal de frescura de mentira para `renderHook` — equivalente al stub que
 * `renderWithProviders` monta por default ([D-023]), que aquí no aplica porque
 * no hay árbol de pantalla. El test hace de servidor con `announce(tema)`.
 */
function createFreshnessHarness(connection: FreshnessConnection = 'connected') {
  const registrations = new Set<{ load: FreshnessLoader; topics: readonly FreshnessTopic[] }>()
  const value: FreshnessContextValue = {
    connection,
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
  async function announce(topic: FreshnessTopic) {
    await act(async () => {
      await Promise.allSettled(
        [...registrations].filter((r) => r.topics.includes(topic)).map((r) => r.load()),
      )
    })
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

function mount(repos: Repositories, connection: FreshnessConnection = 'connected') {
  const freshness = createFreshnessHarness(connection)
  const hook = renderHook(() => useRegister('loc1'), {
    wrapper: wrapper(repos, freshness.value),
  })
  return { ...hook, announce: freshness.announce }
}

describe('useRegister', () => {
  it('carga en mount sin pedir política de caché: el repositorio siempre va a la red', async () => {
    const repos = createMockRepositories()
    const getRegisters = vi.fn().mockResolvedValue(REGISTERS)
    repos.register.getRegisters = getRegisters

    const { result } = mount(repos)

    // Un solo argumento: la política la decide la clase del dato, no el caller ([D-017]).
    await waitFor(() => expect(getRegisters).toHaveBeenCalledWith('loc1'))
    await waitFor(() => expect(result.current.status).toBe('fresh'))
    expect(result.current.registers).toEqual(REGISTERS)
  })

  it('arranca en "no sé": registers null y status loading, nunca lista vacía', () => {
    const repos = createMockRepositories()
    repos.register.getRegisters = vi.fn().mockReturnValue(new Promise(() => {}))

    const { result } = mount(repos)

    expect(result.current.registers).toBeNull()
    expect(result.current.status).toBe('loading')
  })

  it.each<FreshnessTopic>(['sales', 'register'])(
    'recarga cuando el canal avisa del tema %s (venta o caja de otra iPad)',
    async (topic) => {
      const repos = createMockRepositories()
      const getRegisters = vi.fn().mockResolvedValue(REGISTERS)
      repos.register.getRegisters = getRegisters

      const { announce } = mount(repos)
      await waitFor(() => expect(getRegisters).toHaveBeenCalled())
      const callsAfterMount = getRegisters.mock.calls.length

      await announce(topic)

      expect(getRegisters.mock.calls.length).toBeGreaterThan(callsAfterMount)
    },
  )

  it('un fallo TIRA la lista anterior: registers null + status error, nunca cifras viejas', async () => {
    const repos = createMockRepositories()
    const getRegisters = vi
      .fn()
      .mockResolvedValueOnce(REGISTERS)
      .mockRejectedValue(new Error('network down'))
    repos.register.getRegisters = getRegisters

    const { result, announce } = mount(repos)
    await waitFor(() => expect(result.current.registers).toEqual(REGISTERS))

    await announce('register')

    expect(result.current.registers).toBeNull()
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBeTruthy()
  })

  it('con el canal caído el fallo se lee como offline, no como error del servidor', async () => {
    const repos = createMockRepositories()
    repos.register.getRegisters = vi.fn().mockRejectedValue(new Error('network down'))

    const { result } = mount(repos, 'offline')

    await waitFor(() => expect(result.current.status).toBe('offline'))
    expect(result.current.registers).toBeNull()
  })

  it('refresh RECHAZA al fallar: el canal no mueve la hora del último dato', async () => {
    const repos = createMockRepositories()
    const failure = new Error('network down')
    const getRegisters = vi.fn().mockResolvedValueOnce(REGISTERS).mockRejectedValue(failure)
    repos.register.getRegisters = getRegisters

    const { result } = mount(repos)
    await waitFor(() => expect(result.current.registers).toEqual(REGISTERS))

    await act(async () => {
      await expect(result.current.refresh()).rejects.toBe(failure)
    })
  })

  it('closeSession devuelve la sesión y refresca en éxito', async () => {
    const repos = createMockRepositories()
    const getRegisters = vi.fn().mockResolvedValue(REGISTERS)
    repos.register.getRegisters = getRegisters
    const closed = { ...SESSION, status: 'CLOSED' as const }
    repos.register.closeSession = vi.fn().mockResolvedValue(closed)

    const { result } = mount(repos)
    await waitFor(() => expect(getRegisters).toHaveBeenCalled())
    const callsBefore = getRegisters.mock.calls.length

    let returned: RegisterSession | undefined
    await act(async () => {
      returned = await result.current.closeSession(CLOSE_INPUT)
    })

    expect(returned).toEqual(closed)
    // Refresca tras el éxito para reflejar la caja cerrada.
    await waitFor(() => expect(getRegisters.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('closeSession re-lanza el error del servidor y re-sincroniza en el catch', async () => {
    const repos = createMockRepositories()
    const getRegisters = vi.fn().mockResolvedValue(REGISTERS)
    repos.register.getRegisters = getRegisters
    const serverError = new Error(
      'Esta caja ya fue cerrada (posiblemente desde el admin). Se actualizará la vista.',
    )
    repos.register.closeSession = vi.fn().mockRejectedValue(serverError)

    const { result } = mount(repos)
    // Espera la carga del mount antes de contar los refresh subsecuentes.
    await waitFor(() => expect(getRegisters).toHaveBeenCalled())
    const callsBefore = getRegisters.mock.calls.length

    let thrown: unknown
    await act(async () => {
      try {
        await result.current.closeSession(CLOSE_INPUT)
      } catch (e) {
        thrown = e
      }
    })

    // (a) Re-lanza el error original — no lo traga devolviendo null.
    expect(thrown).toBe(serverError)
    // (b) El catch disparó una lectura adicional (siempre de red) para auto-sanar la vista.
    await waitFor(() => expect(getRegisters.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('un refresco que falla en el catch de closeSession no suplanta al error del servidor', async () => {
    const repos = createMockRepositories()
    repos.register.getRegisters = vi
      .fn()
      .mockResolvedValueOnce(REGISTERS)
      .mockRejectedValue(new Error('network down'))
    const serverError = new Error('Esta caja ya fue cerrada.')
    repos.register.closeSession = vi.fn().mockRejectedValue(serverError)

    const { result } = mount(repos)
    await waitFor(() => expect(result.current.registers).toEqual(REGISTERS))

    let thrown: unknown
    await act(async () => {
      try {
        await result.current.closeSession(CLOSE_INPUT)
      } catch (e) {
        thrown = e
      }
    })

    expect(thrown).toBe(serverError)
    expect(result.current.registers).toBeNull()
  })
})
