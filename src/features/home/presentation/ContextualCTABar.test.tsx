import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ContextualCTABar } from './ContextualCTABar'

describe('ContextualCTABar', () => {
  it('renders action label', () => {
    render(
      <ContextualCTABar
        actionLabel="Cobrar a Carlos Méndez"
        variant="cobrar"
        onClick={() => {}}
      />,
    )
    expect(screen.getByText('Cobrar a Carlos Méndez')).toBeInTheDocument()
  })

  it('renders meta label when provided', () => {
    render(
      <ContextualCTABar
        metaLabel="EN SERVICIO · 12 MIN"
        actionLabel="Cobrar a Carlos"
        variant="cobrar"
        onClick={() => {}}
      />,
    )
    expect(screen.getByText(/en servicio · 12 min/i)).toBeInTheDocument()
  })

  it('omits meta when not provided', () => {
    render(
      <ContextualCTABar
        actionLabel="Nueva venta"
        variant="nueva-venta"
        onClick={() => {}}
      />,
    )
    expect(screen.queryByText(/en servicio/i)).not.toBeInTheDocument()
  })

  it('calls onClick when tapped', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <ContextualCTABar
        actionLabel="Abrir caja"
        variant="abrir-caja"
        onClick={onClick}
      />,
    )
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('exposes variant via data-variant attribute', () => {
    render(
      <ContextualCTABar
        actionLabel="Atender a Pedro"
        variant="atender"
        onClick={() => {}}
      />,
    )
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'atender')
  })

  it('renders all 4 variants without error', () => {
    const variants: Array<'cobrar' | 'atender' | 'abrir-caja' | 'nueva-venta'> = [
      'cobrar',
      'atender',
      'abrir-caja',
      'nueva-venta',
    ]
    for (const variant of variants) {
      const { unmount } = render(
        <ContextualCTABar actionLabel={`test ${variant}`} variant={variant} onClick={() => {}} />,
      )
      expect(screen.getByRole('button')).toHaveAttribute('data-variant', variant)
      unmount()
    }
  })
})
