import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusBoard } from './StatusBoard'

describe('StatusBoard', () => {
  it('renders all chip labels', () => {
    render(
      <StatusBoard
        chips={[
          { label: 'Sucursal Norte' },
          { label: 'Caja abierta', tone: 'success' },
          { label: 'Entrada 09:15', tone: 'success' },
        ]}
      />,
    )
    expect(screen.getByText('Sucursal Norte')).toBeInTheDocument()
    expect(screen.getByText('Caja abierta')).toBeInTheDocument()
    expect(screen.getByText('Entrada 09:15')).toBeInTheDocument()
  })

  it('applies success tone class to success chips', () => {
    render(
      <StatusBoard
        chips={[
          { label: 'Default' },
          { label: 'Success', tone: 'success' },
        ]}
      />,
    )
    const success = screen.getByText('Success')
    expect(success.className).toMatch(/color-success/)
    const def = screen.getByText('Default')
    expect(def.className).not.toMatch(/color-success/)
  })

  it('renders nothing visible when chips array is empty', () => {
    const { container } = render(<StatusBoard chips={[]} />)
    expect(container.firstChild?.childNodes.length).toBe(0)
  })

  it('chips are not buttons (read-only mental model)', () => {
    render(<StatusBoard chips={[{ label: 'X' }]} />)
    expect(screen.queryByRole('button', { name: 'X' })).not.toBeInTheDocument()
  })
})
