import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { FreshnessContext, type FreshnessContextValue } from './FreshnessProvider'
import { RefreshControl } from './RefreshControl'

/** Sucursal en UTC-6: un instante 23:36Z se lee 17:36 en la barra. */
const TZ = 'America/Monterrey'
const UPDATED_AT = new Date('2026-09-19T23:36:00Z')

function makeValue(overrides: Partial<FreshnessContextValue> = {}): FreshnessContextValue {
  return {
    connection: 'connected',
    lastUpdatedAt: null,
    refreshAll: vi.fn(),
    setPaused: vi.fn(),
    register: vi.fn(() => () => {}),
    ...overrides,
  }
}

/** Provider de prueba: el control sólo lee el contexto, nunca consulta. */
function renderControl(overrides: Partial<FreshnessContextValue> = {}, timezone = TZ) {
  const value = makeValue(overrides)
  const ui = (next: FreshnessContextValue) => (
    <FreshnessContext.Provider value={next}>
      <RefreshControl timezone={timezone} />
    </FreshnessContext.Provider>
  )
  const view = render(ui(value))
  return {
    value,
    container: view.container,
    update: (patch: Partial<FreshnessContextValue>) => view.rerender(ui({ ...value, ...patch })),
  }
}

const refreshButton = () => screen.getByRole('button', { name: 'Actualizar datos' })

describe('RefreshControl', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('el clic dispara refreshAll (la salida que no es recargar la página)', async () => {
    const user = userEvent.setup()
    const { value } = renderControl({ lastUpdatedAt: UPDATED_AT })

    await user.click(refreshButton())

    expect(value.refreshAll).toHaveBeenCalledTimes(1)
  })

  it('pinta la hora del último dato en la tz de la SUCURSAL, no en la del device', () => {
    renderControl({ lastUpdatedAt: UPDATED_AT })
    expect(screen.getByText('ACTUALIZADO 17:36')).toBeInTheDocument()
  })

  it('la misma hora en otra tz se lee distinto (la tz no es decorativa)', () => {
    renderControl({ lastUpdatedAt: UPDATED_AT }, 'UTC')
    expect(screen.getByText('ACTUALIZADO 23:36')).toBeInTheDocument()
  })

  it('sin lastUpdatedAt no pinta hora: no se inventa una frescura que no se sabe', () => {
    const { container } = renderControl({ lastUpdatedAt: null })
    expect(screen.queryByText(/actualizado/i)).not.toBeInTheDocument()
    expect(container.textContent ?? '').not.toMatch(/\d/)
    // El botón sigue ahí: es justamente la salida cuando no hay nada aún.
    expect(refreshButton()).toBeInTheDocument()
  })

  it('conectado no agrega ruido: ningún aviso de conexión', () => {
    renderControl({ connection: 'connected', lastUpdatedAt: UPDATED_AT })
    expect(screen.queryByText(/sin conexión en vivo/i)).not.toBeInTheDocument()
    expect(screen.getByText('ACTUALIZADO 17:36')).toBeInTheDocument()
  })

  it('offline: avisa y deja de presentar el dato viejo como actual', () => {
    renderControl({ connection: 'offline', lastUpdatedAt: UPDATED_AT })

    expect(screen.getByRole('status')).toHaveTextContent(/sin conexión en vivo/i)
    expect(screen.getByText('DATOS DE LAS 17:36')).toBeInTheDocument()
    expect(screen.queryByText(/actualizado/i)).not.toBeInTheDocument()
  })

  it('offline sin hora conocida: avisa, pero no inventa una hora', () => {
    renderControl({ connection: 'offline', lastUpdatedAt: null })
    expect(screen.getByRole('status')).toHaveTextContent(/sin conexión en vivo/i)
    expect(screen.queryByText(/datos de las/i)).not.toBeInTheDocument()
  })

  it('reconectando menos de 5 s: no alarma (un parpadeo del socket no es una caída)', () => {
    vi.useFakeTimers()
    renderControl({ connection: 'reconnecting', lastUpdatedAt: UPDATED_AT })

    act(() => {
      vi.advanceTimersByTime(4_900)
    })

    expect(screen.queryByText(/sin conexión en vivo/i)).not.toBeInTheDocument()
    expect(screen.getByText('ACTUALIZADO 17:36')).toBeInTheDocument()
  })

  it('reconectando más de 5 s: avisa y el texto pasa a "DATOS DE LAS"', () => {
    vi.useFakeTimers()
    renderControl({ connection: 'reconnecting', lastUpdatedAt: UPDATED_AT })

    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(screen.getByRole('status')).toHaveTextContent(/sin conexión en vivo/i)
    expect(screen.getByText('DATOS DE LAS 17:36')).toBeInTheDocument()
  })

  it('si el socket vuelve antes de la ventana, el aviso ya no aparece', () => {
    vi.useFakeTimers()
    const { update } = renderControl({ connection: 'reconnecting', lastUpdatedAt: UPDATED_AT })

    act(() => {
      vi.advanceTimersByTime(4_000)
    })
    act(() => {
      update({ connection: 'connected' })
    })
    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(screen.queryByText(/sin conexión en vivo/i)).not.toBeInTheDocument()
  })

  it('mientras refresca: botón deshabilitado y el ícono gira (salvo reduced motion)', async () => {
    const user = userEvent.setup()
    const { container } = renderControl({ lastUpdatedAt: UPDATED_AT })

    await user.click(refreshButton())

    expect(refreshButton()).toBeDisabled()
    expect(refreshButton()).toHaveAttribute('aria-busy', 'true')
    // jsdom no evalúa media queries: se comprueba la variante emitida.
    expect(container.innerHTML).toMatch(/animate-spin/)
    expect(container.innerHTML).toMatch(/motion-reduce:animate-none/)
  })

  it('deja de girar cuando avanza la hora del último dato', async () => {
    const user = userEvent.setup()
    const { update } = renderControl({ lastUpdatedAt: UPDATED_AT })

    await user.click(refreshButton())
    expect(refreshButton()).toBeDisabled()

    act(() => {
      update({ lastUpdatedAt: new Date(UPDATED_AT.getTime() + 60_000) })
    })

    expect(refreshButton()).toBeEnabled()
    expect(screen.getByText('ACTUALIZADO 17:37')).toBeInTheDocument()
  })

  it('si el refresco falla y la hora nunca avanza, el botón se recupera solo', async () => {
    // `shouldAdvanceTime`: userEvent (y el act de RTL) esperan macrotareas
    // reales; con timers falsos "puros" el await nunca resuelve y el test se
    // cuelga. Con esta opción el reloj falso avanza solo y `advanceTimersByTime`
    // sigue sirviendo para saltar los 4 s del tope.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ delay: null })
    renderControl({ lastUpdatedAt: UPDATED_AT })

    await user.click(refreshButton())
    expect(refreshButton()).toBeDisabled()

    act(() => {
      vi.advanceTimersByTime(4_000)
    })

    expect(refreshButton()).toBeEnabled()
    expect(refreshButton()).not.toHaveAttribute('aria-busy')
  })

  it('el botón tiene área táctil de 44 px', () => {
    renderControl({ lastUpdatedAt: UPDATED_AT })
    expect(refreshButton()).toHaveStyle({ minHeight: '44px', minWidth: '44px' })
  })
})
