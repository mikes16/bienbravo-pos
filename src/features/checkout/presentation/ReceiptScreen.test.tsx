import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ReceiptScreen } from './ReceiptScreen'

const SALE = {
  id: 'sale-1',
  totalCents: 81000,
  payments: [{ provider: 'CASH' as const, amountCents: 81000 }],
  createdAt: '2026-05-04T16:18:00.000Z',
  customer: { id: 'c1', fullName: 'Carlos Méndez', email: 'carlos@test.com' },
  items: [
    { id: 'i1', name: 'Corte', qty: 2, unitPriceCents: 28000, totalCents: 56000, staffUser: { id: 'b1', fullName: 'Antonio' } },
    { id: 'i2', name: 'Shampoo', qty: 1, unitPriceCents: 25000, totalCents: 25000, staffUser: null },
  ],
}

describe('ReceiptScreen', () => {
  it('renders sale items + totals + customer', () => {
    render(<ReceiptScreen sale={SALE} onListo={() => {}} />)
    expect(screen.getByText('Corte')).toBeInTheDocument()
    expect(screen.getByText('Shampoo')).toBeInTheDocument()
    expect(screen.getByText('$810')).toBeInTheDocument()
    expect(screen.getByText(/carlos méndez/i)).toBeInTheDocument()
    expect(screen.getByText(/antonio/i)).toBeInTheDocument()
  })

  it('Imprimir CTA calls window.print', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<ReceiptScreen sale={SALE} onListo={() => {}} />)
    await user.click(screen.getByRole('button', { name: /imprimir/i }))
    expect(printSpy).toHaveBeenCalled()
    printSpy.mockRestore()
  })

  it('Listo CTA fires onListo', async () => {
    const onListo = vi.fn()
    const user = userEvent.setup()
    render(<ReceiptScreen sale={SALE} onListo={onListo} />)
    await user.click(screen.getByRole('button', { name: /listo/i }))
    expect(onListo).toHaveBeenCalled()
  })

  it('Enviar por correo button is disabled (deferred to sub-#4c)', () => {
    render(<ReceiptScreen sale={SALE} onListo={() => {}} />)
    const emailBtn = screen.getByRole('button', { name: /correo/i })
    expect(emailBtn).toBeDisabled()
  })
})
