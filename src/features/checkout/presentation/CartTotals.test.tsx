import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CartTotals } from './CartTotals'

describe('CartTotals', () => {
  it('renders total label + amount', () => {
    render(<CartTotals subtotalCents={81000} />)
    expect(screen.getByText(/^total$/i)).toBeInTheDocument()
    expect(screen.getByText('$810')).toBeInTheDocument()
  })

  it('renders zero state with $0', () => {
    render(<CartTotals subtotalCents={0} />)
    expect(screen.getByText('$0')).toBeInTheDocument()
  })

  /* ── R5: sin impuesto el carrito no muestra Subtotal ni Impuesto ── */

  it('sin impuesto no muestra ni Subtotal ni Impuesto: solo Total', () => {
    render(<CartTotals subtotalCents={81000} taxTotalCents={0} />)
    expect(screen.queryByText(/^subtotal$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^impuesto$/i)).not.toBeInTheDocument()
    expect(screen.getByText(/^total$/i)).toBeInTheDocument()
  })

  it('sin impuesto el descuento se sigue viendo, pero sin línea de Subtotal', () => {
    render(<CartTotals subtotalCents={81000} discountTotalCents={10000} />)
    expect(screen.queryByText(/^subtotal$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^impuesto$/i)).not.toBeInTheDocument()
    expect(screen.getByText(/^descuentos$/i)).toBeInTheDocument()
    expect(screen.getByText('−$100')).toBeInTheDocument()
    // Total = suma de líneas − descuento.
    expect(screen.getByText('$710')).toBeInTheDocument()
  })

  it('con impuesto > 0 reaparece el desglose completo y el total lo incluye', () => {
    render(
      <CartTotals subtotalCents={100000} discountTotalCents={20000} taxTotalCents={12800} />,
    )
    expect(screen.getByText(/^subtotal$/i)).toBeInTheDocument()
    expect(screen.getByText(/^impuesto$/i)).toBeInTheDocument()
    expect(screen.getByText(/^total$/i)).toBeInTheDocument()
    expect(screen.getByText('$1,000')).toBeInTheDocument()
    expect(screen.getByText('$128')).toBeInTheDocument()
    // Total = suma de líneas − descuento + impuesto.
    expect(screen.getByText('$928')).toBeInTheDocument()
  })

  it('el cobro de extras prepagado tampoco muestra impuesto con tasa 0', () => {
    render(<CartTotals subtotalCents={15000} prepaidTotalCents={40000} />)
    expect(screen.getByText(/^pagado antes$/i)).toBeInTheDocument()
    expect(screen.getByText(/^a cobrar$/i)).toBeInTheDocument()
    expect(screen.queryByText(/^subtotal$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^impuesto$/i)).not.toBeInTheDocument()
  })
})
