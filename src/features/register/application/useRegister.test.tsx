import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useRegister } from './useRegister'
import { RepositoryProvider } from '@/core/repositories/RepositoryProvider'
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

const CLOSE_INPUT = {
  sessionId: 'sess-1',
  countedCashCents: 0,
  countedCardCents: 0,
  countedTransferCents: 0,
}

function wrapper(repos: Repositories) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <RepositoryProvider value={repos}>{children}</RepositoryProvider>
  }
}

describe('useRegister', () => {
  it('carga en mount sin pedir política de caché: el repositorio siempre va a la red', async () => {
    const repos = createMockRepositories()
    const getRegisters = vi.fn().mockResolvedValue([
      { id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1', openSession: SESSION },
    ])
    repos.register.getRegisters = getRegisters

    renderHook(() => useRegister('loc1'), { wrapper: wrapper(repos) })

    // Un solo argumento: la política la decide la clase del dato, no el caller ([D-017]).
    await waitFor(() => expect(getRegisters).toHaveBeenCalledWith('loc1'))
  })

  it('closeSession devuelve la sesión y refresca en éxito', async () => {
    const repos = createMockRepositories()
    const getRegisters = vi.fn().mockResolvedValue([
      { id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1', openSession: SESSION },
    ])
    repos.register.getRegisters = getRegisters
    const closed = { ...SESSION, status: 'CLOSED' as const }
    repos.register.closeSession = vi.fn().mockResolvedValue(closed)

    const { result } = renderHook(() => useRegister('loc1'), { wrapper: wrapper(repos) })
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
    const getRegisters = vi.fn().mockResolvedValue([
      { id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1', openSession: SESSION },
    ])
    repos.register.getRegisters = getRegisters
    const serverError = new Error(
      'Esta caja ya fue cerrada (posiblemente desde el admin). Se actualizará la vista.',
    )
    repos.register.closeSession = vi.fn().mockRejectedValue(serverError)

    const { result } = renderHook(() => useRegister('loc1'), { wrapper: wrapper(repos) })
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
})
