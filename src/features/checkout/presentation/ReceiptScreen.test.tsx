import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ReceiptScreen } from './ReceiptScreen'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'

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
    renderWithProviders(<ReceiptScreen sale={SALE} onListo={() => {}} />)
    // El ReceiptScreen ahora renderiza dos copias del contenido del sale:
    // la preview en pantalla (visible) y el PrintableTicket (display: none
    // por default, visible solo en @media print). Por eso usamos
    // getAllByText / queryAllByText — ambas existen en el DOM.
    expect(screen.getAllByText('Corte').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Shampoo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$810').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/carlos méndez/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/antonio/i).length).toBeGreaterThan(0)
  })

  it('shows subtotal + propina breakdown when the sale carried a tip', () => {
    const saleWithTip = {
      ...SALE,
      totalCents: 30000,
      tipCents: 2000,
      payments: [{ provider: 'CARD_TERMINAL' as const, amountCents: 30000 }],
      items: [
        { id: 'i1', name: 'Corte Especializado', qty: 1, unitPriceCents: 28000, totalCents: 28000, staffUser: { id: 'b1', fullName: 'Brandon' } },
      ],
    }
    renderWithProviders(<ReceiptScreen sale={saleWithTip} onListo={() => {}} />)
    // Preview en pantalla + PrintableTicket → cada texto aparece 2 veces.
    expect(screen.getAllByText(/^subtotal$/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^propina$/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText('+$20').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$300').length).toBeGreaterThan(0)
  })

  it('hides the propina breakdown when there was no tip', () => {
    renderWithProviders(<ReceiptScreen sale={{ ...SALE, tipCents: 0 }} onListo={() => {}} />)
    expect(screen.queryByText(/^propina$/i)).not.toBeInTheDocument()
  })

  it('Imprimir CTA calls window.print', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    const user = userEvent.setup()
    renderWithProviders(<ReceiptScreen sale={SALE} onListo={() => {}} />)
    await user.click(screen.getByRole('button', { name: /imprimir/i }))
    expect(printSpy).toHaveBeenCalled()
    printSpy.mockRestore()
  })

  it('Listo CTA fires onListo', async () => {
    const onListo = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<ReceiptScreen sale={SALE} onListo={onListo} />)
    await user.click(screen.getByRole('button', { name: /listo/i }))
    expect(onListo).toHaveBeenCalled()
  })

  it('Enviar por correo button is disabled (deferred to sub-#4c)', () => {
    renderWithProviders(<ReceiptScreen sale={SALE} onListo={() => {}} />)
    const emailBtn = screen.getByRole('button', { name: /correo/i })
    expect(emailBtn).toBeDisabled()
  })
})
