import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MoneyValue } from './MoneyValue'

const LABEL = 'Total del día'

function group() {
  return screen.getByRole('group', { name: LABEL })
}

describe('MoneyValue', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('loading: esqueleto sin ningún dígito ni signo de pesos, con aria-busy', () => {
    render(<MoneyValue status="loading" cents={null} label={LABEL} />)
    const el = group()
    expect(el).toHaveAttribute('aria-busy', 'true')
    // Nunca "$0" ni la cifra anterior: mientras no sabemos, no hay número.
    expect(el.textContent ?? '').not.toMatch(/\d/)
    expect(el.textContent ?? '').not.toContain('$')
  })

  it('fresh: pinta la cifra que respondió el servidor y ya no está ocupado', () => {
    render(<MoneyValue status="fresh" cents={82000} label={LABEL} />)
    expect(screen.getByText('$')).toBeInTheDocument()
    expect(screen.getByText('820')).toBeInTheDocument()
    expect(group()).not.toHaveAttribute('aria-busy')
  })

  it('fresh con 0: un cero REAL se pinta como cifra, no como esqueleto', () => {
    render(<MoneyValue status="fresh" cents={0} label={LABEL} />)
    expect(screen.getByText('$')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('fresh sin monto (cents null): esqueleto, jamás $0 inventado', () => {
    render(<MoneyValue status="fresh" cents={null} label={LABEL} />)
    expect(group().textContent ?? '').not.toMatch(/\d/)
    expect(group().textContent ?? '').not.toContain('$')
  })

  it('updating: muestra el monto atenuado y a los 1000 ms cae a esqueleto', () => {
    vi.useFakeTimers()
    render(<MoneyValue status="updating" cents={82000} label={LABEL} />)

    // La cifra acaba de venir del servidor: se marca en revisión, no parpadea.
    expect(screen.getByText('820')).toBeInTheDocument()
    expect(group()).toHaveAttribute('aria-busy', 'true')

    act(() => {
      vi.advanceTimersByTime(900)
    })
    expect(screen.getByText('820')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(screen.queryByText('820')).not.toBeInTheDocument()
    expect(group().textContent ?? '').not.toMatch(/\d/)
    expect(group()).toHaveAttribute('aria-busy', 'true')
  })

  it('updating: el reloj de 1 s se reinicia cuando el estado vuelve a cambiar', () => {
    vi.useFakeTimers()
    const { rerender } = render(<MoneyValue status="updating" cents={82000} label={LABEL} />)
    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(screen.queryByText('820')).not.toBeInTheDocument()

    rerender(<MoneyValue status="fresh" cents={90000} label={LABEL} />)
    expect(screen.getByText('900')).toBeInTheDocument()

    rerender(<MoneyValue status="updating" cents={90000} label={LABEL} />)
    expect(screen.getByText('900')).toBeInTheDocument()
  })

  it('offline: guion y "Sin conexión", nunca la última cifra', () => {
    render(<MoneyValue status="offline" cents={82000} label={LABEL} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText('Sin conexión')).toBeInTheDocument()
    expect(screen.queryByText('820')).not.toBeInTheDocument()
    expect(group().textContent ?? '').not.toContain('$')
  })

  it('error: mensaje, sin $0, y "Reintentar" llama a onRetry', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(<MoneyValue status="error" cents={82000} label={LABEL} onRetry={onRetry} />)

    expect(screen.getByText('No se pudo cargar')).toBeInTheDocument()
    expect(screen.queryByText('820')).not.toBeInTheDocument()
    expect(group().textContent ?? '').not.toContain('$')

    const retry = screen.getByRole('button', { name: 'Reintentar' })
    // Área táctil mínima de 44 px (jsdom no calcula layout: se verifica el estilo).
    expect(retry).toHaveStyle({ minHeight: '44px', minWidth: '44px' })
    await user.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('error sin onRetry: mensaje sin botón', () => {
    render(<MoneyValue status="error" cents={null} label={LABEL} />)
    expect(screen.getByText('No se pudo cargar')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('el esqueleto desactiva el pulso con prefers-reduced-motion', () => {
    render(<MoneyValue status="loading" cents={null} label={LABEL} />)
    // jsdom no evalúa media queries: se comprueba la variante motion-reduce emitida.
    expect(group().innerHTML).toMatch(/motion-reduce:animate-none/)
  })
})
