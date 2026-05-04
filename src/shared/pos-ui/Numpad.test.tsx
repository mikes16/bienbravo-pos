import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Numpad } from './Numpad'

describe('Numpad', () => {
  it('renders 0-9 + decimal + backspace', () => {
    render(<Numpad onKey={() => {}} />)
    for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      expect(screen.getByRole('button', { name: d })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: '.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument()
  })

  it('calls onKey with the digit when a number is pressed', async () => {
    const onKey = vi.fn()
    const user = userEvent.setup()
    render(<Numpad onKey={onKey} />)
    await user.click(screen.getByRole('button', { name: '7' }))
    expect(onKey).toHaveBeenCalledWith('7')
  })

  it('calls onKey with "." when decimal pressed', async () => {
    const onKey = vi.fn()
    const user = userEvent.setup()
    render(<Numpad onKey={onKey} />)
    await user.click(screen.getByRole('button', { name: '.' }))
    expect(onKey).toHaveBeenCalledWith('.')
  })

  it('calls onKey with "backspace" when backspace pressed', async () => {
    const onKey = vi.fn()
    const user = userEvent.setup()
    render(<Numpad onKey={onKey} />)
    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(onKey).toHaveBeenCalledWith('backspace')
  })

  it('hides decimal when allowDecimal is false', () => {
    render(<Numpad onKey={() => {}} allowDecimal={false} />)
    expect(screen.queryByRole('button', { name: '.' })).not.toBeInTheDocument()
  })
})
