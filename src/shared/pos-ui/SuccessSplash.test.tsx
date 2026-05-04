import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SuccessSplash } from './SuccessSplash'

describe('SuccessSplash', () => {
  it('renders the title', () => {
    render(<SuccessSplash title="¡Cobrado!" />)
    expect(screen.getByText('¡Cobrado!')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<SuccessSplash title="¡Cobrado!" subtitle="Mesa 3 · $820" />)
    expect(screen.getByText('Mesa 3 · $820')).toBeInTheDocument()
  })

  it('renders action button and triggers callback', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    render(
      <SuccessSplash
        title="¡Cobrado!"
        action={{ label: 'Nueva venta', onClick: onAction }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Nueva venta' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
