import { render, screen, fireEvent } from '@testing-library/react'
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

  it('Confirmar fires onConfirm with payments array + tip (CARD)', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={100000} onClose={() => {}} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /tarjeta/i }))
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      payments: [{ provider: 'CARD_TERMINAL', amountCents: 100000 }],
      tipCents: 0,
    })
  })

  it('Confirmar fires onConfirm with payments array + tipCents=0 for CASH (cash never includes tip)', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<PaymentSheet open totalCents={50000} onClose={() => {}} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /efectivo/i }))
    // Tap +$500 once to cover the total exactly.
    const plusButtons = screen.getAllByRole('button', { name: /aumentar/i })
    await user.click(plusButtons[0])
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(onConfirm).toHaveBeenCalledWith({
      payments: [{ provider: 'CASH', amountCents: 50000 }],
      tipCents: 0,
    })
  })

  it('renders the API error inline and flips the CTA to Reintentar', () => {
    render(
      <PaymentSheet
        open
        totalCents={50000}
        error="Este walk-in ya fue cobrado. Recarga la pantalla y selecciona otro."
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/walk-in ya fue cobrado/i)
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument()
  })

  it('hides the error region while a new submit is in flight', () => {
    render(
      <PaymentSheet
        open
        totalCents={50000}
        error="Fallo previo"
        submitting
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    // The alert should be suppressed while we're already retrying.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /procesando/i })).toBeInTheDocument()
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
    expect(onConfirm).toHaveBeenCalledWith({
      payments: [{ provider: 'CASH', amountCents: 81000 }],
      tipCents: 0,
    })
  })
})

describe('PaymentSheet — split mode', () => {
  it('reveals split UI when "Dividir pago" button is tapped', () => {
    render(<PaymentSheet open totalCents={85000} onClose={() => {}} onConfirm={() => {}} />)
    fireEvent.click(screen.getByText(/Dividir pago/i))
    expect(screen.getByText(/División de pago/i)).toBeInTheDocument()
    expect(screen.getAllByLabelText(/Monto/i).length).toBeGreaterThanOrEqual(2)
  })

  it('disables confirm when split sum does not equal total', () => {
    render(<PaymentSheet open totalCents={85000} onClose={() => {}} onConfirm={() => {}} />)
    fireEvent.click(screen.getByText(/Dividir pago/i))
    const inputs = screen.getAllByLabelText(/Monto/i)
    fireEvent.change(inputs[0], { target: { value: '500' } })
    fireEvent.change(inputs[1], { target: { value: '200' } })
    const confirmBtn = screen.getByText(/Cobrar/i).closest('button')!
    expect(confirmBtn).toBeDisabled()
    expect(screen.getByText(/Falta/i)).toBeInTheDocument()
  })

  it('enables confirm and emits split payments when sum matches', () => {
    const onConfirm = vi.fn()
    render(<PaymentSheet open totalCents={85000} onClose={() => {}} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByText(/Dividir pago/i))
    const inputs = screen.getAllByLabelText(/Monto/i)
    fireEvent.change(inputs[0], { target: { value: '500' } })
    fireEvent.change(inputs[1], { target: { value: '350' } })
    fireEvent.click(screen.getByText(/Cobrar/i))
    expect(onConfirm).toHaveBeenCalledWith({
      payments: expect.arrayContaining([
        { provider: 'CASH', amountCents: 50000 },
        { provider: 'CARD_TERMINAL', amountCents: 35000 },
      ]),
      tipCents: 0,
    })
  })
})
