import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CartLineRow } from './CartLineRow'

const BARBERS = [
  { id: 'b1', fullName: 'Antonio', photoUrl: null },
  { id: 'b2', fullName: 'Beto', photoUrl: null },
]

const LINE = {
  id: 'l1',
  kind: 'service' as const,
  itemId: 'svc-1',
  name: 'Corte',
  qty: 2,
  unitPriceCents: 28000,
  staffUserId: 'b1',
}

// Línea de PRODUCTO ya convertida a precio staff: `unitPriceCents` es lo que
// se cobra hoy ($150 c/u) y el público congelado ($280 c/u) llega por prop.
const PRODUCT_LINE = {
  id: 'l2',
  kind: 'product' as const,
  itemId: 'prod-1',
  name: 'Pomada mate',
  qty: 2,
  unitPriceCents: 15000,
  staffUserId: 'b1',
}

const NOOP_HANDLERS = {
  onIncQty: () => {},
  onDecQty: () => {},
  onSetBarber: () => {},
  onRemove: () => {},
}

describe('CartLineRow', () => {
  it('renders name, qty, line total', () => {
    render(<CartLineRow line={LINE} barbers={BARBERS} onIncQty={() => {}} onDecQty={() => {}} onSetBarber={() => {}} onRemove={() => {}} />)
    expect(screen.getByText('Corte')).toBeInTheDocument()
    expect(screen.getByText('$560')).toBeInTheDocument()
  })

  it('renders barber chip with current barber name', () => {
    render(<CartLineRow line={LINE} barbers={BARBERS} onIncQty={() => {}} onDecQty={() => {}} onSetBarber={() => {}} onRemove={() => {}} />)
    expect(screen.getByText(/antonio/i)).toBeInTheDocument()
  })

  // El nuevo CartLineRow esconde controles (qty stepper, barbero picker)
  // por default — la fila se ve compacta. Tap en la fila la expande. Estos
  // tests primero expanden y después interactúan con los controles internos.
  it('+ button fires onIncQty after expanding the row', async () => {
    const onIncQty = vi.fn()
    const user = userEvent.setup()
    render(<CartLineRow line={LINE} barbers={BARBERS} onIncQty={onIncQty} onDecQty={() => {}} onSetBarber={() => {}} onRemove={() => {}} />)
    await user.click(screen.getByRole('button', { name: /toca para modificar/i }))
    await user.click(screen.getByRole('button', { name: /aumentar/i }))
    expect(onIncQty).toHaveBeenCalledWith('l1')
  })

  it('− button fires onDecQty after expanding the row', async () => {
    const onDecQty = vi.fn()
    const user = userEvent.setup()
    render(<CartLineRow line={LINE} barbers={BARBERS} onIncQty={() => {}} onDecQty={onDecQty} onSetBarber={() => {}} onRemove={() => {}} />)
    await user.click(screen.getByRole('button', { name: /toca para modificar/i }))
    await user.click(screen.getByRole('button', { name: /disminuir/i }))
    expect(onDecQty).toHaveBeenCalledWith('l1')
  })

  it('tap row → tap "Cambiar barbero" expands BarberPickerInline', async () => {
    const user = userEvent.setup()
    render(<CartLineRow line={LINE} barbers={BARBERS} onIncQty={() => {}} onDecQty={() => {}} onSetBarber={() => {}} onRemove={() => {}} />)
    await user.click(screen.getByRole('button', { name: /toca para modificar/i }))
    await user.click(screen.getByRole('button', { name: /cambiar barbero/i }))
    expect(screen.getByLabelText('Beto')).toBeInTheDocument()
  })

  it('oculta del picker a los barberos excluidos del servicio de la línea', async () => {
    const user = userEvent.setup()
    render(
      <CartLineRow
        line={LINE}
        barbers={BARBERS}
        excludedBarberIds={['b2']}
        onIncQty={() => {}}
        onDecQty={() => {}}
        onSetBarber={() => {}}
        onRemove={() => {}}
      />,
    )
    await user.click(screen.getByRole('button', { name: /toca para modificar/i }))
    await user.click(screen.getByRole('button', { name: /cambiar barbero/i }))
    // Antonio (b1) sigue disponible; Beto (b2) está excluido y no aparece.
    expect(screen.getByLabelText('Antonio')).toBeInTheDocument()
    expect(screen.queryByLabelText('Beto')).not.toBeInTheDocument()
  })

  // ── Modo venta a staff (spec §4.5) ──
  describe('modo venta a staff', () => {
    it('pinta el precio staff con el público tachado y anuncia los dos', () => {
      render(
        <CartLineRow
          line={PRODUCT_LINE}
          barbers={BARBERS}
          staffListUnitPriceCents={28000}
          {...NOOP_HANDLERS}
        />,
      )
      // Los dos precios son totales de línea (×2): staff $300, público $560.
      const previo = screen.getByRole('deletion')
      expect(previo).toHaveTextContent('$560')
      expect(screen.getByText('$300')).toBeInTheDocument()
      // El tachado no puede ser solo visual: la fila nombra ambos precios.
      expect(
        screen.getByRole('button', {
          name: /precio staff \$300, precio público anterior \$560/i,
        }),
      ).toBeInTheDocument()
    })

    it('sin precio staff no aparece ningún precio extra', () => {
      render(<CartLineRow line={PRODUCT_LINE} barbers={BARBERS} {...NOOP_HANDLERS} />)
      expect(screen.queryByRole('deletion')).not.toBeInTheDocument()
      expect(screen.getByText('$300')).toBeInTheDocument()
      expect(screen.queryByText('$560')).not.toBeInTheDocument()
      // Y la fila se anuncia como siempre: un solo precio, sin rótulos nuevos.
      expect(screen.queryByRole('button', { name: /precio staff/i })).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /pomada mate, antonio, \$300\. toca para modificar\./i }),
      ).toBeInTheDocument()
    })

    it('canta el motivo por el que la línea no se puede cobrar a staff', () => {
      render(
        <CartLineRow
          line={PRODUCT_LINE}
          barbers={BARBERS}
          staffBlockMessage="Aún no hay selector de presentación — cóbralo fuera del modo staff"
          {...NOOP_HANDLERS}
        />,
      )
      expect(screen.getByText('Aún no hay selector de presentación — cóbralo fuera del modo staff')).toBeInTheDocument()
      // También viaja en la etiqueta de la fila (el motivo bloquea el cobro).
      expect(
        screen.getByRole('button', { name: /no hay selector de presentación/i }),
      ).toBeInTheDocument()
    })
  })
})
