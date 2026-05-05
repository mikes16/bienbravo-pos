import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BarberPickerInline } from './BarberPickerInline'

const BARBERS = [
  { id: 'b1', fullName: 'Antonio', photoUrl: null },
  { id: 'b2', fullName: 'Beto', photoUrl: null },
  { id: 'b3', fullName: 'Carlos', photoUrl: null },
]

describe('BarberPickerInline', () => {
  it('renders all barbers as horizontal row', () => {
    render(<BarberPickerInline barbers={BARBERS} currentBarberId="b1" onSelect={() => {}} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
  })

  it('current barber has selected styling', () => {
    const { container } = render(<BarberPickerInline barbers={BARBERS} currentBarberId="b2" onSelect={() => {}} />)
    const buttons = container.querySelectorAll('button')
    expect(buttons[1].className).toMatch(/bravo/)
  })

  it('clicking a different barber fires onSelect', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<BarberPickerInline barbers={BARBERS} currentBarberId="b1" onSelect={onSelect} />)
    await user.click(screen.getByLabelText('Beto'))
    expect(onSelect).toHaveBeenCalledWith('b2')
  })
})
