import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MoneyInput } from './MoneyInput'

describe('MoneyInput', () => {
  it('renders the current amount via MoneyDisplay', () => {
    render(<MoneyInput cents={82000} onChange={() => {}} />)
    expect(screen.getByText('820')).toBeInTheDocument()
  })

  it('appends digit when number key pressed', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MoneyInput cents={0} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '5' }))
    expect(onChange).toHaveBeenLastCalledWith(5)
  })

  it('shifts and appends for sequential digits', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<MoneyInput cents={0} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '1' }))
    expect(onChange).toHaveBeenLastCalledWith(1)
    rerender(<MoneyInput cents={1} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '2' }))
    expect(onChange).toHaveBeenLastCalledWith(12)
    rerender(<MoneyInput cents={12} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '5' }))
    expect(onChange).toHaveBeenLastCalledWith(125)
  })

  it('removes the last digit when backspace pressed', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MoneyInput cents={125} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(onChange).toHaveBeenLastCalledWith(12)
  })

  it('ignores decimal key (cents are implicit by digit position)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MoneyInput cents={0} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '.' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
