import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BarberSelectorSheet } from './BarberSelectorSheet'

const BARBERS = [
  { id: 'b1', fullName: 'Antonio', photoUrl: null },
  { id: 'b2', fullName: 'Beto', photoUrl: null },
  { id: 'b3', fullName: 'Carlos', photoUrl: null },
]

describe('BarberSelectorSheet', () => {
  it('renders all barbers when open', () => {
    render(<BarberSelectorSheet open barbers={BARBERS} currentBarberId="b1" onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Antonio')).toBeInTheDocument()
    expect(screen.getByText('Beto')).toBeInTheDocument()
    expect(screen.getByText('Carlos')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<BarberSelectorSheet open={false} barbers={BARBERS} currentBarberId="b1" onSelect={() => {}} onClose={() => {}} />)
    expect(screen.queryByText('Antonio')).not.toBeInTheDocument()
  })

  it('clicking barber calls onSelect + onClose', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<BarberSelectorSheet open barbers={BARBERS} currentBarberId="b1" onSelect={onSelect} onClose={onClose} />)
    await user.click(screen.getByText('Beto'))
    expect(onSelect).toHaveBeenCalledWith('b2')
    expect(onClose).toHaveBeenCalled()
  })
})
