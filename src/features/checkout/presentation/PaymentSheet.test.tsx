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

  it('selecting CASH shows the CashCounter denomination rows', async () => {
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={() => {}} />)
    await user.click(screen.getByRole('button', { name: /efectivo/i }))
    // CashCounter renders all 6 rows; pick MONEDAS as the unique-to-counter signal
    expect(screen.getByText('MONEDAS')).toBeInTheDocument()
    expect(screen.getByText(/recibido/i)).toBeInTheDocument()
  })

  it('selecting TARJETA shows TipInput', async () => {
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={() => {}} />)
    await user.click(screen.getByRole('button', { name: /tarjeta/i }))
    expect(screen.getByText(/propina/i)).toBeInTheDocument()
  })

  it('Confirmar fires onConfirm with method + tip (CARD)', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /tarjeta/i }))
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(onConfirm).toHaveBeenCalledWith({ method: 'CARD', tipCents: 0 })
  })

  it('Confirmar fires onConfirm with tipCents=0 for CASH (cash never includes tip)', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={50000} onClose={() => {}} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /efectivo/i }))
    // Tap +$500 once to cover the total exactly.
    const plusButtons = screen.getAllByRole('button', { name: /aumentar/i })
    await user.click(plusButtons[0])
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(onConfirm).toHaveBeenCalledWith({ method: 'CASH', tipCents: 0 })
  })

  it('shows Procesando… and locks the CTA while submitting', async () => {
    const onConfirm = vi.fn()
    render(
      <PaymentSheet
        open
        totalCents={50000}
        submitting
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    )
    // Method chips disabled, primary CTA shows the in-flight label.
    expect(screen.getByRole('button', { name: /efectivo/i })).toBeDisabled()
    const cta = screen.getByRole('button', { name: /procesando/i })
    expect(cta).toBeDisabled()
    // Status line for the operator.
    expect(screen.getByRole('status')).toHaveTextContent(/registrando venta/i)
  })

  it('Confirmar is disabled for CASH when received < total', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={81000} onClose={() => {}} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /efectivo/i }))
    // No bills counted yet — confirm must be locked.
    const confirmBtn = screen.getByRole('button', { name: /confirmar/i })
    expect(confirmBtn).toBeDisabled()

    // Add $500 — still short of $810.
    const plusButtons = screen.getAllByRole('button', { name: /aumentar/i })
    await user.click(plusButtons[0])
    expect(confirmBtn).toBeDisabled()
    await user.click(confirmBtn)
    expect(onConfirm).not.toHaveBeenCalled()

    // Two more $200 → $900 received, now over $810. Confirm unlocks.
    await user.click(plusButtons[1])
    await user.click(plusButtons[1])
    expect(confirmBtn).not.toBeDisabled()
    await user.click(confirmBtn)
    expect(onConfirm).toHaveBeenCalledWith({ method: 'CASH', tipCents: 0 })
  })
})
