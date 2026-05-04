import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TileButton } from './TileButton'

describe('TileButton', () => {
  it('renders title and subtitle', () => {
    render(<TileButton title="Corte clásico" subtitle="$250" onClick={() => {}} />)
    expect(screen.getByText('Corte clásico')).toBeInTheDocument()
    expect(screen.getByText('$250')).toBeInTheDocument()
  })

  it('renders without subtitle if omitted', () => {
    render(<TileButton title="Pomada" onClick={() => {}} />)
    expect(screen.getByText('Pomada')).toBeInTheDocument()
    expect(screen.queryByText('$')).not.toBeInTheDocument()
  })

  it('calls onClick when tapped', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<TileButton title="Corte" onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applies selected styles when selected prop is true', () => {
    render(<TileButton title="Corte" selected onClick={() => {}} />)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('border-[var(--color-bravo)]')
  })

  it('disables click when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<TileButton title="Corte" disabled onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
