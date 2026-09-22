import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `vi.mock` se iza: el estado del factory nace en `vi.hoisted`. Sólo se mockea
// la sesión (el candado); la actividad de venta y el estado del socket son
// stores de módulo y se manejan con sus propios setters, como en el POS real.
const auth = vi.hoisted(() => ({
  isAuthenticated: true,
  isLocked: false,
  lock: vi.fn(),
  unlock: vi.fn(),
}))

vi.mock('@/core/auth/usePosAuth.ts', () => ({
  usePosAuth: () => auth,
}))

import {
  resetSaleActivity,
  setSaleInProgress,
  setSaleSubmitting,
} from '@/core/auth/saleActivity.ts'
import { reportWsConnected, reportWsDisconnected, resetWsStatus } from '@/core/apollo/wsStatus.ts'
import { RELOADED_BUILD_KEY, VERSION_URL, useDeployWatcher } from './useDeployWatcher.ts'

/** Bajo vitest el `define` de Vite no se aplica: el build corriendo es 'test'. */
const RUNNING_BUILD = 'test'
const NEW_BUILD = 'deploy-2'

const reload = vi.fn()
let fetchMock: ReturnType<typeof vi.fn>

/** El manifiesto que responde el hosting en esta prueba. */
function serveVersion(buildId: string) {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ buildId }) })
}

/** Primera conexión del socket de la pestaña. */
function connect() {
  act(() => {
    reportWsConnected()
  })
}

/** Caída + reconexión: lo que deja un deploy del API. */
function reconnect() {
  act(() => {
    reportWsDisconnected()
    reportWsConnected(true)
  })
}

/** Deja correr las microtareas del fetch (dos `await` + el `.then`). */
async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useDeployWatcher', () => {
  beforeEach(() => {
    // El watcher está inerte en desarrollo; vitest corre con DEV=true, así que
    // aquí se simula el bundle desplegado.
    vi.stubEnv('DEV', false)
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    // `window.location` es inmodificable en jsdom (`spyOn` sobre `reload`
    // lanza): se sustituye el global entero por una copia con el doble.
    reload.mockClear()
    vi.stubGlobal('location', { ...window.location, reload })
    window.sessionStorage.clear()
    auth.isLocked = false
    // Los stores de módulo se limpian ANTES de montar, nunca en `afterEach`:
    // ahí el hook sigue montado y la notificación caería fuera de `act`.
    resetSaleActivity()
    resetWsStatus()
    serveVersion(RUNNING_BUILD)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('con el mismo buildId no hace nada', async () => {
    const { result } = renderHook(() => useDeployWatcher())
    await settle()

    expect(fetchMock).toHaveBeenCalledWith(VERSION_URL, { cache: 'no-store' })
    expect(reload).not.toHaveBeenCalled()
    expect(result.current.updateAvailable).toBe(false)
  })

  it('con el POS bloqueado, una versión nueva recarga de inmediato', async () => {
    auth.isLocked = true
    serveVersion(NEW_BUILD)
    // Con venta abierta: bloqueado, el carrito ya no es de nadie.
    setSaleInProgress(true)

    renderHook(() => useDeployWatcher())
    await settle()
    // Bloqueado no consulta al montar: el disparador es el socket.
    expect(fetchMock).not.toHaveBeenCalled()

    connect()
    await settle()
    // La PRIMERA conexión no cuenta: esa no se perdió ningún deploy.
    expect(fetchMock).not.toHaveBeenCalled()

    reconnect()
    await settle()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
    expect(window.sessionStorage.getItem(RELOADED_BUILD_KEY)).toBe(NEW_BUILD)
  })

  it('con venta en curso avisa y NO recarga; recarga al terminar la venta', async () => {
    serveVersion(NEW_BUILD)
    setSaleInProgress(true)

    const { result } = renderHook(() => useDeployWatcher())
    await settle()

    expect(reload).not.toHaveBeenCalled()
    expect(result.current.updateAvailable).toBe(true)

    // La venta se cierra (cobrada o cancelada): ahora sí.
    act(() => {
      setSaleInProgress(false)
    })
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
  })

  it('nunca recarga mientras un cobro se está enviando', async () => {
    serveVersion(NEW_BUILD)
    setSaleSubmitting(true)

    renderHook(() => useDeployWatcher())
    await settle()

    expect(reload).not.toHaveBeenCalled()

    act(() => {
      setSaleSubmitting(false)
    })
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))
  })

  it('no recarga dos veces por el mismo buildId', async () => {
    serveVersion(NEW_BUILD)

    const { unmount } = renderHook(() => useDeployWatcher())
    await settle()
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1))

    // El hosting sigue sirviendo el bundle viejo con el manifiesto nuevo.
    connect()
    reconnect()
    await settle()
    expect(reload).toHaveBeenCalledTimes(1)

    // Y tampoco tras la recarga que sí ocurrió (misma pestaña, mismo
    // sessionStorage): sin esto el POS quedaría recargándose para siempre.
    unmount()
    const { result } = renderHook(() => useDeployWatcher())
    await settle()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(result.current.updateAvailable).toBe(false)
  })

  it('un fallo de la consulta no rompe nada', async () => {
    fetchMock.mockRejectedValue(new Error('sin red'))

    const { result } = renderHook(() => useDeployWatcher())
    await settle()

    expect(result.current.updateAvailable).toBe(false)
    expect(reload).not.toHaveBeenCalled()

    // Un 404 (deploy a medias, manifiesto todavía no publicado) tampoco.
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    connect()
    reconnect()
    await settle()

    expect(result.current.updateAvailable).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('en reposo no consulta nada: no hay sondeo periódico', async () => {
    vi.useFakeTimers()
    try {
      serveVersion(NEW_BUILD)
      setSaleInProgress(true)

      renderHook(() => useDeployWatcher())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
      })

      // Una sola consulta en diez minutos: la del montaje. Nada se reprograma.
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(reload).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
