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

  it('+ button fires onIncQty', async () => {
    const onIncQty = vi.fn()
    const user = userEvent.setup()
    render(<CartLineRow line={LINE} barbers={BARBERS} onIncQty={onIncQty} onDecQty={() => {}} onSetBarber={() => {}} onRemove={() => {}} />)
    await user.click(screen.getByRole('button', { name: /aumentar/i }))
    expect(onIncQty).toHaveBeenCalledWith('l1')
  })

  it('− button fires onDecQty', async () => {
    const onDecQty = vi.fn()
    const user = userEvent.setup()
    render(<CartLineRow line={LINE} barbers={BARBERS} onIncQty={() => {}} onDecQty={onDecQty} onSetBarber={() => {}} onRemove={() => {}} />)
    await user.click(screen.getByRole('button', { name: /disminuir/i }))
    expect(onDecQty).toHaveBeenCalledWith('l1')
  })

  it('tap barber chip expands BarberPickerInline', async () => {
    const user = userEvent.setup()
    render(<CartLineRow line={LINE} barbers={BARBERS} onIncQty={() => {}} onDecQty={() => {}} onSetBarber={() => {}} onRemove={() => {}} />)
    await user.click(screen.getByRole('button', { name: /antonio/i }))
    expect(screen.getByLabelText('Beto')).toBeInTheDocument()
  })
})
