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

  describe('hideTotals', () => {
    /** Venta con TODOS los montos agregados presentes: 2 × Corte ($200 c/u,
     *  línea $400) + Shampoo $100, cupón −$50, impuesto $40, propina $30 y
     *  pago dividido. Total $520: ningún precio unitario coincide con él. */
    const TAX = 4000
    const TIP = 3000
    const DISCOUNT = 5000
    const LINES = 2 * 20000 + 10000
    const TOTAL = LINES - DISCOUNT + TAX + TIP
    function fullSale(): SaleTicketData {
      return sale({
        items: [{ ...ITEMS[0], qty: 2, totalCents: 40000 }, ITEMS[1]],
        subtotalCents: LINES,
        taxTotalCents: TAX,
        tipCents: TIP,
        totalCents: TOTAL,
        discounts: [{ code: 'BRAVO10', name: 'Bravo 10', discountAmountCents: DISCOUNT }],
        payments: [
          { provider: 'CASH', amountCents: 30000 },
          { provider: 'CARD_TERMINAL', amountCents: TOTAL - 30000 },
        ],
      })
    }

    it('hideTotals={false} es el ticket de siempre: totales, desglose e importes por pago', () => {
      render(<SaleTicketBody sale={fullSale()} hideTotals={false} />)
      expect(screen.getByText(/^total$/i)).toBeInTheDocument()
      expect(screen.getByText(formatMoney(TOTAL))).toBeInTheDocument()
      expect(screen.getByText(/^descuentos$/i)).toBeInTheDocument()
      expect(screen.getByText(/^propina$/i)).toBeInTheDocument()
      expect(screen.getByText(/^subtotal$/i)).toBeInTheDocument()
      // La línea pinta su total (2 × $200 = $400), no el precio unitario.
      expect(screen.getByText(formatMoney(40000))).toBeInTheDocument()
      expect(screen.queryByText(/c\/u/i)).not.toBeInTheDocument()
      expect(
        screen.getByText(
          `Pagado con Efectivo ${formatMoney(30000)} + Tarjeta ${formatMoney(TOTAL - 30000)}`,
        ),
      ).toBeInTheDocument()
    })

    it('hideTotals omite todo monto agregado y deja items con su precio unitario', () => {
      const { container } = render(<SaleTicketBody sale={fullSale()} hideTotals />)
      // Sin rótulos del bloque de totales.
      for (const label of [/^total$/i, /^subtotal$/i, /^impuesto$/i, /^propina$/i, /^descuentos$/i]) {
        expect(screen.queryByText(label)).not.toBeInTheDocument()
      }
      // Ningún monto agregado en ningún nodo (ni total, ni línea, ni pagos,
      // ni cupón/impuesto/propina).
      for (const cents of [TOTAL, LINES, 40000, 30000, TOTAL - 30000, DISCOUNT, TAX, TIP]) {
        expect(container).not.toHaveTextContent(formatMoney(cents))
      }
      // Items: nombre, cantidad y precio unitario.
      expect(screen.getByText(/corte/i)).toBeInTheDocument()
      expect(screen.getByText(/shampoo/i)).toBeInTheDocument()
      expect(screen.getByText('2 ×')).toBeInTheDocument()
      expect(screen.getByText(formatMoney(20000))).toBeInTheDocument()
      expect(screen.getByText(formatMoney(10000))).toBeInTheDocument()
      expect(screen.getAllByText(/^c\/u$/i)).toHaveLength(2)
      // Formas de pago sin importe.
      expect(screen.getByText('Pagado con Efectivo + Tarjeta')).toBeInTheDocument()
    })
  })
})
