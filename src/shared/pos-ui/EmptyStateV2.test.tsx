import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { EmptyStateV2 } from './EmptyStateV2'

describe('EmptyStateV2', () => {
  it('renders title and description', () => {
    render(
      <EmptyStateV2
        title="Sin actividad"
        description="No hay ventas hoy todavía"
      />,
    )
    expect(screen.getByText('Sin actividad')).toBeInTheDocument()
    expect(screen.getByText('No hay ventas hoy todavía')).toBeInTheDocument()
  })

  it('renders without action by default', () => {
    render(<EmptyStateV2 title="Vacío" description="Sin items" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders action button when provided and triggers callback', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    render(
      <EmptyStateV2
        title="Vacío"
        description="Sin items"
        action={{ label: 'Agregar primero', onClick: onAction }}
      />,
    )
    const btn = screen.getByRole('button', { name: 'Agregar primero' })
    await user.click(btn)
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
