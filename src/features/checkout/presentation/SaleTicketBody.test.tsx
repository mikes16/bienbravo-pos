import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SaleTicketBody } from './SaleTicketBody'
import type { SaleTicketData } from './SaleTicketBody'
import { formatMoney } from '@/shared/lib/money'

const ITEMS = [
  {
    id: 'i1',
    name: 'Corte',
    qty: 1,
    unitPriceCents: 20000,
    totalCents: 20000,
    staffUser: { id: 'b1', fullName: 'Antonio' },
  },
  {
    id: 'i2',
    name: 'Shampoo',
    qty: 1,
    unitPriceCents: 10000,
    totalCents: 10000,
    staffUser: null,
  },
]

/** Suma de las líneas del ticket (30000). */
const LINES_CENTS = ITEMS.reduce((sum, i) => sum + i.totalCents, 0)

function sale(over: Partial<SaleTicketData> = {}): SaleTicketData {
  return {
    id: 'sale-1',
    subtotalCents: LINES_CENTS,
    taxTotalCents: 0,
    totalCents: LINES_CENTS,
    tipCents: 0,
    customer: { id: 'c1', fullName: 'Carlos Méndez' },
    items: ITEMS,
    payments: [{ provider: 'CASH', amountCents: LINES_CENTS }],
    discounts: [],
    ...over,
  }
}

describe('SaleTicketBody', () => {
  it('sin impuesto muestra solo Total (ni Subtotal ni Impuesto)', () => {
    render(<SaleTicketBody sale={sale()} />)
    expect(screen.queryByText(/^subtotal$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^impuesto$/i)).not.toBeInTheDocument()
    expect(screen.getByText(/^total$/i)).toBeInTheDocument()
    expect(screen.getByText(formatMoney(LINES_CENTS))).toBeInTheDocument()
  })

  it('sin impuesto con propina: se ve Propina pero no Subtotal, y el total suma la propina', () => {
    const tipCents = 2000
    const s = sale({ tipCents, totalCents: LINES_CENTS + tipCents })
    render(<SaleTicketBody sale={s} />)
    expect(screen.queryByText(/^subtotal$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^impuesto$/i)).not.toBeInTheDocument()
    expect(screen.getByText(/^propina$/i)).toBeInTheDocument()
    expect(screen.getByText(`+${formatMoney(tipCents)}`)).toBeInTheDocument()
    // Total = suma de líneas + propina.
    expect(screen.getByText(formatMoney(LINES_CENTS + tipCents))).toBeInTheDocument()
  })

  it('sin impuesto con descuento: se ve el descuento y el total lo resta, sin Subtotal', () => {
    const discountCents = 5000
    const s = sale({
      totalCents: LINES_CENTS - discountCents,
      discounts: [{ code: 'BRAVO10', name: 'Bravo 10', discountAmountCents: discountCents }],
    })
    render(<SaleTicketBody sale={s} />)
    expect(screen.queryByText(/^subtotal$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^impuesto$/i)).not.toBeInTheDocument()
    expect(screen.getByText(/^descuentos$/i)).toBeInTheDocument()
    expect(screen.getByText(`−${formatMoney(discountCents)}`)).toBeInTheDocument()
    // Total = suma de líneas − descuento.
    expect(screen.getByText(formatMoney(LINES_CENTS - discountCents))).toBeInTheDocument()
  })

  it('con impuesto > 0 reaparecen Subtotal, Impuesto y Total', () => {
    const taxCents = 4800
    const tipCents = 2000
    const s = sale({
      taxTotalCents: taxCents,
      tipCents,
      totalCents: LINES_CENTS + taxCents + tipCents,
    })
    render(<SaleTicketBody sale={s} />)
    expect(screen.getByText(/^subtotal$/i)).toBeInTheDocument()
    expect(screen.getByText(/^impuesto$/i)).toBeInTheDocument()
    expect(screen.getByText(/^total$/i)).toBeInTheDocument()
    // Subtotal = suma de líneas; el desglose cuadra con el total cobrado.
    expect(screen.getByText(formatMoney(LINES_CENTS))).toBeInTheDocument()
    expect(screen.getByText(`+${formatMoney(taxCents)}`)).toBeInTheDocument()
    expect(screen.getByText(formatMoney(LINES_CENTS + taxCents + tipCents))).toBeInTheDocument()
  })
})
