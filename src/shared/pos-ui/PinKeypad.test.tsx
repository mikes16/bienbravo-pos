import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PinKeypad } from './PinKeypad'

describe('PinKeypad', () => {
  it('does not render decimal key', () => {
    render(<PinKeypad length={4} onComplete={() => {}} />)
    expect(screen.queryByRole('button', { name: '.' })).not.toBeInTheDocument()
  })

  it('renders 4 dot indicators by default for length=4', () => {
    const { container } = render(<PinKeypad length={4} onComplete={() => {}} />)
    const dots = container.querySelectorAll('[data-pin-dot]')
    expect(dots).toHaveLength(4)
  })

  it('fills dots as digits are pressed', async () => {
    const user = userEvent.setup()
    const { container } = render(<PinKeypad length={4} onComplete={() => {}} />)
    await user.click(screen.getByRole('button', { name: '1' }))
    await user.click(screen.getByRole('button', { name: '2' }))
    const filled = container.querySelectorAll('[data-pin-dot="filled"]')
    expect(filled).toHaveLength(2)
  })

  it('calls onComplete with the full PIN when length reached', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<PinKeypad length={4} onComplete={onComplete} />)
    await user.click(screen.getByRole('button', { name: '1' }))
    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: '3' }))
    await user.click(screen.getByRole('button', { name: '4' }))
    expect(onComplete).toHaveBeenCalledWith('1234')
  })

  it('removes the last digit when backspace pressed', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<PinKeypad length={4} onComplete={onComplete} />)
    await user.click(screen.getByRole('button', { name: '1' }))
    await user.click(screen.getByRole('button', { name: '2' }))
    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    const filled = container.querySelectorAll('[data-pin-dot="filled"]')
    expect(filled).toHaveLength(1)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('ignores additional digits after length is reached', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<PinKeypad length={4} onComplete={onComplete} />)
    for (const d of ['1', '2', '3', '4', '5']) {
      await user.click(screen.getByRole('button', { name: d }))
    }
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('1234')
  })

  it('accepts physical-keyboard digits + Backspace', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<PinKeypad length={4} onComplete={onComplete} />)
    // 1 → 12 → 123 → backspace → 12 → 122 → 1224 (complete)
    await user.keyboard('123{Backspace}24')
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith('1224')
  })

  it('does not accept keyboard input when disabled', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(<PinKeypad length={4} onComplete={onComplete} disabled />)
    await user.keyboard('1234')
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('skips keyboard input when an input element is focused', async () => {
    const onComplete = vi.fn()
    const user = userEvent.setup()
    render(
      <div>
        <input data-testid="other" />
        <PinKeypad length={4} onComplete={onComplete} />
      </div>,
    )
    const input = screen.getByTestId('other') as HTMLInputElement
    input.focus()
    await user.keyboard('1234')
    expect(onComplete).not.toHaveBeenCalled()
    expect(input.value).toBe('1234')
  })
})
