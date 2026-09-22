import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// `vi.mock` se iza al tope del archivo: los spies deben nacer en `vi.hoisted`.
// Se mockea el mapa de rutas (no `router.tsx` real) para no arrastrar los
// chunks de features ni el browser router al test.
const prefetch = vi.hoisted(() => ({
  caja: vi.fn(() => Promise.resolve({})),
  daySales: vi.fn(() => Promise.resolve({})),
  clock: vi.fn(() => Promise.resolve({})),
}))

vi.mock('./router', () => ({
  routePrefetchers: {
    '/caja': prefetch.caja,
    // Mismo chunk que `/caja`: sirve para verificar la deduplicación.
    '/caja/abrir': prefetch.caja,
    '/day-sales': prefetch.daySales,
    '/reloj': prefetch.clock,
  },
}))

import { useIdleRoutePrefetch } from './useIdleRoutePrefetch'

// jsdom no implementa `requestIdleCallback`: el hook cae al `setTimeout`.
function flushIdle() {
  act(() => {
    vi.runAllTimers()
  })
}

describe('useIdleRoutePrefetch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    prefetch.caja.mockClear()
    prefetch.daySales.mockClear()
    prefetch.clock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('solo precarga los chunks de las rutas que el viewer puede ver', () => {
    renderHook(() => useIdleRoutePrefetch(['pos.tab.register']))
    flushIdle()

    // `/caja` y `/caja/abrir` comparten prefetcher: una sola llamada.
    expect(prefetch.caja).toHaveBeenCalledTimes(1)
    expect(prefetch.daySales).not.toHaveBeenCalled()
    expect(prefetch.clock).not.toHaveBeenCalled()
  })

  it('no precarga nada cuando el viewer no tiene permisos', () => {
    renderHook(() => useIdleRoutePrefetch([]))
    flushIdle()

    expect(prefetch.caja).not.toHaveBeenCalled()
    expect(prefetch.daySales).not.toHaveBeenCalled()
    expect(prefetch.clock).not.toHaveBeenCalled()
  })

  it('precarga cada ruta permitida cuando el viewer tiene varios tabs', () => {
    renderHook(() => useIdleRoutePrefetch(['pos.tab.clock', 'pos.sales.day.read']))
    flushIdle()

    expect(prefetch.clock).toHaveBeenCalledTimes(1)
    expect(prefetch.daySales).toHaveBeenCalledTimes(1)
    expect(prefetch.caja).not.toHaveBeenCalled()
  })

  it('no precarga si el componente se desmonta antes del idle', () => {
    const { unmount } = renderHook(() => useIdleRoutePrefetch(['pos.tab.register']))
    unmount()
    flushIdle()

    expect(prefetch.caja).not.toHaveBeenCalled()
  })
})
