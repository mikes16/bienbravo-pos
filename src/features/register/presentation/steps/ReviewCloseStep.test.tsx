import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ReviewCloseStep } from './ReviewCloseStep'

// openingCashCents: el monto que se abrió la caja con. ReviewCloseStep lo
// resta de expected.cashCents para mostrar "ventas en efectivo del día"
// vs el fondo de apertura. 50000 es un fondo típico para los tests.
const PERFECT = {
  openingCashCents: 50000,
  expected: { cashCents: 184000, cardCents: 254000, transferCents: 126000 },
  counted: { cashCents: 184000, cardCents: 254000, transferCents: 126000 },
}
const SMALL_DIFF = {
  openingCashCents: 50000,
  expected: { cashCents: 184000, cardCents: 254000, transferCents: 126000 },
  counted: { cashCents: 181000, cardCents: 254000, transferCents: 126000 },
}
const LARGE_DIFF = {
  openingCashCents: 50000,
  expected: { cashCents: 184000, cardCents: 254000, transferCents: 126000 },
  counted: { cashCents: 164000, cardCents: 254000, transferCents: 126000 },
}

describe('ReviewCloseStep', () => {
  it('shows green banner when diff is 0', () => {
    render(<ReviewCloseStep {...PERFECT} confirmAck={false} onConfirmAckChange={() => {}} />)
    expect(screen.getByText(/todo cuadra/i)).toBeInTheDocument()
  })

  it('shows amber faltante banner when |diff| <= $50', () => {
    render(<ReviewCloseStep {...SMALL_DIFF} confirmAck={false} onConfirmAckChange={() => {}} />)
    expect(screen.getByText(/faltante de \$30/i)).toBeInTheDocument()
  })

  it('shows bravo banner when |diff| > $50', () => {
    render(<ReviewCloseStep {...LARGE_DIFF} confirmAck={false} onConfirmAckChange={() => {}} />)
    expect(screen.getByText(/faltante de \$200/i)).toBeInTheDocument()
  })

  it('renders efectivo and tarjeta rows (transfer is auto-reconciled, not displayed)', () => {
    render(<ReviewCloseStep {...PERFECT} confirmAck={false} onConfirmAckChange={() => {}} />)
    // "efectivo" aparece en varias filas (fondo de apertura + ventas en
    // efectivo + total contado). getAllByText evita el ambiguity error.
    expect(screen.getAllByText(/efectivo/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/tarjeta/i).length).toBeGreaterThan(0)
    // Decisión de producto: la fila de Stripe/transferencia está oculta —
    // el cajero no puede confirmarla manualmente; se reconcilia sola.
  })

  it('confirmAck checkbox calls onConfirmAckChange', async () => {
    const onConfirmAckChange = vi.fn()
    const user = userEvent.setup()
    render(<ReviewCloseStep {...SMALL_DIFF} confirmAck={false} onConfirmAckChange={onConfirmAckChange} />)
    await user.click(screen.getByRole('checkbox'))
    expect(onConfirmAckChange).toHaveBeenCalledWith(true)
  })

  it('does NOT show checkbox when diff is 0', () => {
    render(<ReviewCloseStep {...PERFECT} confirmAck={false} onConfirmAckChange={() => {}} />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('TOTAL shows success color when diff is 0', () => {
    render(<ReviewCloseStep {...PERFECT} confirmAck={false} onConfirmAckChange={() => {}} />)
    expect(screen.getByText('$0 exacto').className).toMatch(/color-success/)
  })

  it('renders checkbox as checked when confirmAck=true', () => {
    render(<ReviewCloseStep {...SMALL_DIFF} confirmAck={true} onConfirmAckChange={() => {}} />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })
})
