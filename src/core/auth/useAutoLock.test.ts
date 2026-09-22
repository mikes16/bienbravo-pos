import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `vi.mock` se iza al tope del archivo: el estado que usan los factories nace
// en `vi.hoisted`. Se mockean las DOS fuentes del hook (sesión y ajustes) para
// que el test sea de temporizadores y no de Apollo: `usePosSettings` ya tiene
// su propia suite y aquí sus defaults (15 / 90) se simulan con estos números.
const auth = vi.hoisted(() => ({
  isAuthenticated: true,
  isLocked: false,
  lock: vi.fn(),
}))

const settings = vi.hoisted(() => ({ idleSeconds: 15, checkoutSeconds: 90 }))

vi.mock('./usePosAuth.ts', () => ({
  usePosAuth: () => auth,
}))

vi.mock('@/core/bootstrap/usePosSettings.ts', () => ({
  usePosSettings: () => settings,
}))

import { resetSaleActivity, setSaleInProgress, setSaleSubmitting } from './saleActivity.ts'
import { useAutoLock } from './useAutoLock.ts'

/** Avanza el reloj falso `seconds` segundos dentro de `act`. */
function advance(seconds: number) {
  act(() => {
    vi.advanceTimersByTime(seconds * 1000)
  })
}

/** Toque del operador en la tablet (el hook escucha sobre `document`). */
function touch() {
  act(() => {
    document.dispatchEvent(new Event('pointerdown'))
  })
}

describe('useAutoLock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    auth.isAuthenticated = true
    auth.isLocked = false
    auth.lock.mockClear()
    settings.idleSeconds = 15
    settings.checkoutSeconds = 90
    resetSaleActivity()
  })

  afterEach(() => {
    vi.useRealTimers()
    // El store se limpia en `beforeEach` y no aquí a propósito: en `afterEach`
    // el hook puede seguir montado (la limpieza de Testing Library corre
    // después) y la notificación caería fuera de `act`.
  })

  it('bloquea a los 15 s de reposo y no vuelve a bloquear después', () => {
    renderHook(() => useAutoLock())

    advance(14)
    expect(auth.lock).not.toHaveBeenCalled()

    advance(1)
    expect(auth.lock).toHaveBeenCalledTimes(1)

    // Nada queda programado: bloquear apaga la cuenta, no la reinicia sola.
    advance(60)
    expect(auth.lock).toHaveBeenCalledTimes(1)
  })

  it('cualquier actividad del operador reinicia el contador', () => {
    renderHook(() => useAutoLock())

    advance(14)
    touch()

    // Ya van 28 s desde que montó, pero solo 14 desde el toque.
    advance(14)
    expect(auth.lock).not.toHaveBeenCalled()

    advance(1)
    expect(auth.lock).toHaveBeenCalledTimes(1)
  })

  it('con venta en curso espera 90 s y no bloquea a los 15', () => {
    setSaleInProgress(true)
    renderHook(() => useAutoLock())

    advance(15)
    expect(auth.lock).not.toHaveBeenCalled()

    advance(74)
    expect(auth.lock).not.toHaveBeenCalled()

    advance(1)
    expect(auth.lock).toHaveBeenCalledTimes(1)
  })

  it('abrir una venta reinicia el contador con el tiempo largo', () => {
    renderHook(() => useAutoLock())

    advance(10)
    act(() => {
      setSaleInProgress(true)
    })

    // 90 s se cuentan desde que se abrió la venta, no desde el montaje.
    advance(89)
    expect(auth.lock).not.toHaveBeenCalled()

    advance(1)
    expect(auth.lock).toHaveBeenCalledTimes(1)
  })

  it('cerrar la venta (recibo en pantalla) vuelve al tiempo corto', () => {
    setSaleInProgress(true)
    renderHook(() => useAutoLock())

    advance(30)
    act(() => {
      setSaleInProgress(false)
    })

    advance(14)
    expect(auth.lock).not.toHaveBeenCalled()

    advance(1)
    expect(auth.lock).toHaveBeenCalledTimes(1)
  })

  it('nunca bloquea mientras el cobro se está enviando, y al terminar reinicia', () => {
    setSaleInProgress(true)
    setSaleSubmitting(true)
    renderHook(() => useAutoLock())

    // La terminal puede tardar lo que quiera: con el cobro en vuelo no hay
    // bloqueo ni temporizador armado.
    advance(600)
    expect(auth.lock).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)

    act(() => {
      setSaleSubmitting(false)
    })

    // El contador arranca de cero al terminar el envío (venta aún abierta).
    advance(89)
    expect(auth.lock).not.toHaveBeenCalled()

    advance(1)
    expect(auth.lock).toHaveBeenCalledTimes(1)
  })

  it('aplica los tiempos nuevos de los ajustes y reinicia con ellos', () => {
    const { rerender } = renderHook(() => useAutoLock())

    advance(10)
    settings.idleSeconds = 30
    settings.checkoutSeconds = 120
    rerender()

    // Los 30 s corren desde el cambio: a los 29 (39 desde el montaje) aún no.
    advance(29)
    expect(auth.lock).not.toHaveBeenCalled()

    advance(1)
    expect(auth.lock).toHaveBeenCalledTimes(1)
  })

  it('sin sesión no programa nada', () => {
    auth.isAuthenticated = false
    renderHook(() => useAutoLock())

    expect(vi.getTimerCount()).toBe(0)
    advance(600)
    expect(auth.lock).not.toHaveBeenCalled()
  })

  it('con el POS ya bloqueado no programa nada', () => {
    auth.isLocked = true
    renderHook(() => useAutoLock())

    expect(vi.getTimerCount()).toBe(0)
    advance(600)
    expect(auth.lock).not.toHaveBeenCalled()
  })

  it('publica los segundos restantes solo en los últimos 5 s', () => {
    const { result } = renderHook(() => useAutoLock())

    advance(9)
    expect(result.current.secondsRemaining).toBeNull()

    advance(1)
    expect(result.current.secondsRemaining).toBe(5)

    advance(1)
    expect(result.current.secondsRemaining).toBe(4)

    advance(3)
    expect(result.current.secondsRemaining).toBe(1)

    advance(1)
    expect(auth.lock).toHaveBeenCalledTimes(1)
    expect(result.current.secondsRemaining).toBeNull()
  })

  it('un toque durante el aviso lo retira y vuelve a contar', () => {
    const { result } = renderHook(() => useAutoLock())

    advance(11)
    expect(result.current.secondsRemaining).toBe(4)

    touch()
    expect(result.current.secondsRemaining).toBeNull()

    advance(10)
    expect(result.current.secondsRemaining).toBe(5)
    expect(auth.lock).not.toHaveBeenCalled()
  })

  it('abrir una venta durante el aviso lo retira', () => {
    const { result } = renderHook(() => useAutoLock())

    advance(12)
    expect(result.current.secondsRemaining).toBe(3)

    act(() => {
      setSaleInProgress(true)
    })
    expect(result.current.secondsRemaining).toBeNull()
    expect(auth.lock).not.toHaveBeenCalled()
  })
})
