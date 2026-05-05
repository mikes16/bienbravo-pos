import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PaymentSheet } from './PaymentSheet'

describe('PaymentSheet', () => {
  it('renders 3 method chips when open', () => {
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={() => {}} />)
    expect(screen.getByRole('button', { name: /efectivo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tarjeta/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /transferencia/i })).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<PaymentSheet open={false} totalCents={100000} onClose={() => {}} onConfirm={() => {}} />)
    expect(screen.queryByRole('button', { name: /efectivo/i })).not.toBeInTheDocument()
  })

  it('selecting CASH shows CashChangeHelper', async () => {
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={() => {}} />)
    await user.click(screen.getByRole('button', { name: /efectivo/i }))
    expect(screen.getByLabelText(/recibido/i)).toBeInTheDocument()
  })

  it('selecting TARJETA shows TipInput', async () => {
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={() => {}} />)
    await user.click(screen.getByRole('button', { name: /tarjeta/i }))
    expect(screen.getByText(/propina/i)).toBeInTheDocument()
  })

  it('Confirmar fires onConfirm with method + tip', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /tarjeta/i }))
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(onConfirm).toHaveBeenCalledWith({ method: 'CARD', tipCents: 0 })
  })
})
