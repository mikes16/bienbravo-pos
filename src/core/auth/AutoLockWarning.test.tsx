import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `vi.mock` se iza al tope: el estado de los factories nace en `vi.hoisted`.
// Aquí se mockean las dos fuentes de la franja (sesión y cuenta atrás) para
// probar SOLO la presentación: los temporizadores y los dos tiempos ya tienen
// su suite en `useAutoLock.test.ts`.
const auth = vi.hoisted(() => ({ isAuthenticated: true, isLocked: false }))
const autoLock = vi.hoisted(() => ({ secondsRemaining: null as number | null }))

vi.mock('./usePosAuth.ts', () => ({
  usePosAuth: () => auth,
}))

// `importOriginal` conserva `AUTO_LOCK_WARNING_SECONDS` real: si la ventana de
// aviso deja de ser 5 s, estos tests se enteran en vez de mentir con un 5 fijo.
vi.mock('./useAutoLock.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useAutoLock.ts')>()),
  useAutoLock: () => ({ secondsRemaining: autoLock.secondsRemaining }),
}))

import { AutoLockWarning } from './AutoLockWarning.tsx'

const STRIP = { name: 'Seguir usando el POS' }

/** Relleno de la barra: el único hijo del `progressbar` (el track). */
function progressFill(): Element {
  const fill = screen.getByRole('progressbar').firstElementChild
  if (!fill) throw new Error('la barra de tiempo no tiene relleno')
  return fill
}

describe('AutoLockWarning', () => {
  beforeEach(() => {
    // Timers falsos con avance real: `userEvent` necesita que el reloj corra
    // o sus `await` no resuelven nunca.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    auth.isAuthenticated = true
    auth.isLocked = false
    autoLock.secondsRemaining = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mientras sobra tiempo no hay franja', () => {
    const { rerender } = render(<AutoLockWarning />)
    expect(screen.queryByRole('button', STRIP)).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    // Cinturón: aunque alguien publicara un número FUERA de la ventana de
    // aviso, la franja no se enciende (no es un contador permanente).
    autoLock.secondsRemaining = 6
    rerender(<AutoLockWarning />)
    expect(screen.queryByRole('button', STRIP)).not.toBeInTheDocument()
  })

  it('en los últimos 5 s aparece con el número y la barra llena', () => {
    autoLock.secondsRemaining = 5
    render(<AutoLockWarning />)

    expect(screen.getByRole('button', STRIP)).toBeInTheDocument()
    expect(screen.getByText('Se bloquea en 5… toca para seguir')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5')
    expect(progressFill()).toHaveStyle({ width: '100%' })
  })

  it('la barra se vacía conforme baja el número', () => {
    autoLock.secondsRemaining = 5
    const { rerender } = render(<AutoLockWarning />)

    autoLock.secondsRemaining = 2
    rerender(<AutoLockWarning />)

    expect(screen.getByText('Se bloquea en 2… toca para seguir')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(progressFill()).toHaveStyle({ width: '40%' })
  })

  it('tocar la franja publica actividad: el contador se reinicia', async () => {
    const user = userEvent.setup({ delay: null })
    autoLock.secondsRemaining = 3
    render(<AutoLockWarning />)

    // `useAutoLock` escucha la actividad sobre `document`: si algo cortara la
    // propagación del toque, el POS se bloquearía con el dedo encima.
    const activity = vi.fn()
    document.addEventListener('pointerdown', activity)
    try {
      await user.click(screen.getByRole('button', STRIP))
      expect(activity).toHaveBeenCalled()
    } finally {
      document.removeEventListener('pointerdown', activity)
    }
  })

  it('con teclado (o lector de pantalla) también reinicia', async () => {
    const user = userEvent.setup({ delay: null })
    autoLock.secondsRemaining = 3
    render(<AutoLockWarning />)

    const activity = vi.fn()
    document.addEventListener('pointerdown', activity)
    try {
      await user.tab()
      expect(screen.getByRole('button', STRIP)).toHaveFocus()
      await user.keyboard('{Enter}')
      // Una activación sin dedo no produce `pointerdown` por sí sola: el único
      // posible es el que publica la franja. Sin él, "Seguir usando el POS"
      // sería un botón que no hace nada para quien usa tecnología asistiva.
      expect(activity).toHaveBeenCalledTimes(1)
    } finally {
      document.removeEventListener('pointerdown', activity)
    }
  })

  it('con el POS bloqueado no se muestra', () => {
    auth.isLocked = true
    autoLock.secondsRemaining = 4
    render(<AutoLockWarning />)

    expect(screen.queryByRole('button', STRIP)).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('sin sesión no se muestra', () => {
    auth.isAuthenticated = false
    autoLock.secondsRemaining = 4
    render(<AutoLockWarning />)

    expect(screen.queryByRole('button', STRIP)).not.toBeInTheDocument()
  })

  it('el anuncio accesible ocurre una sola vez, sin cantar cada segundo', () => {
    autoLock.secondsRemaining = 5
    const { rerender } = render(<AutoLockWarning />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('El POS se bloqueará en 5 segundos')

    autoLock.secondsRemaining = 3
    rerender(<AutoLockWarning />)
    autoLock.secondsRemaining = 1
    rerender(<AutoLockWarning />)

    // El número visible sí bajó...
    expect(screen.getByText('Se bloquea en 1… toca para seguir')).toBeInTheDocument()
    // ...pero la región viva es el MISMO nodo con el MISMO texto: sin cambio
    // no hay segundo anuncio.
    expect(screen.getByRole('status')).toBe(status)
    expect(status.textContent).toBe('El POS se bloqueará en 5 segundos')
  })

  it('respeta prefers-reduced-motion: la barra cambia por pasos', () => {
    autoLock.secondsRemaining = 4
    render(<AutoLockWarning />)

    // jsdom no evalúa media queries: se comprueba la variante emitida en el
    // markup, que es lo que apaga la transición de 1 s.
    expect(progressFill().className).toContain('motion-reduce:transition-none')
  })
})
