import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TouchButton } from './TouchButton'

describe('TouchButton', () => {
  it('renders children as label', () => {
    render(<TouchButton onClick={() => {}}>Cobrar</TouchButton>)
    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeInTheDocument()
  })

  it('calls onClick when tapped', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<TouchButton onClick={onClick}>Cobrar</TouchButton>)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies primary variant by default at primary touch height', () => {
    render(<TouchButton onClick={() => {}}>Cobrar</TouchButton>)
    const btn = screen.getByRole('button')
    // primary = bg-bravo, height 64px
    expect(btn.className).toContain('bg-[var(--color-bravo)]')
    expect(btn.className).toContain('h-[var(--pos-touch-primary)]')
  })

  it('applies secondary variant + size when requested', () => {
    render(<TouchButton variant="secondary" size="secondary" onClick={() => {}}>Editar</TouchButton>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('h-[var(--pos-touch-secondary)]')
    expect(btn.className).toContain('border-[var(--color-leather-muted)]')
  })

  it('disables click when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<TouchButton onClick={onClick} disabled>Cobrar</TouchButton>)
    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
