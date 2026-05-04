import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { FeatureTile } from './FeatureTile'
import { ShoppingCartIcon } from './GoogleIcon'

describe('FeatureTile', () => {
  it('renders name and subtitle', () => {
    render(
      <FeatureTile
        icon={ShoppingCartIcon}
        name="Cobrar"
        subtitle="Iniciar cobro"
        onClick={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /cobrar/i })).toBeInTheDocument()
    expect(screen.getByText('Iniciar cobro')).toBeInTheDocument()
  })

  it('calls onClick when tapped', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <FeatureTile
        icon={ShoppingCartIcon}
        name="Cobrar"
        onClick={onClick}
      />,
    )
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders badge when badge > 0', () => {
    render(
      <FeatureTile
        icon={ShoppingCartIcon}
        name="Walk-ins"
        badge={3}
        onClick={() => {}}
      />,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('does not render badge when badge is 0 or undefined', () => {
    const { rerender } = render(
      <FeatureTile icon={ShoppingCartIcon} name="X" onClick={() => {}} />,
    )
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    rerender(
      <FeatureTile icon={ShoppingCartIcon} name="X" badge={0} onClick={() => {}} />,
    )
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('disabled tile does not fire onClick', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <FeatureTile
        icon={ShoppingCartIcon}
        name="Mi día"
        disabled
        onClick={onClick}
      />,
    )
    await user.click(screen.getByRole('button', { name: /mi día/i }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders subtitle when provided, omits otherwise', () => {
    const { rerender } = render(
      <FeatureTile icon={ShoppingCartIcon} name="X" subtitle="hello" onClick={() => {}} />,
    )
    expect(screen.getByText('hello')).toBeInTheDocument()
    rerender(<FeatureTile icon={ShoppingCartIcon} name="X" onClick={() => {}} />)
    expect(screen.queryByText('hello')).not.toBeInTheDocument()
  })
})
