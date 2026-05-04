import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PlaceholderPage } from './PlaceholderPage'

describe('PlaceholderPage', () => {
  it('renders title and subtitle', () => {
    render(
      <PlaceholderPage
        title="Mi día"
        subtitle="Disponible próximamente · Verás KPIs personales"
      />,
    )
    expect(screen.getByText('Mi día')).toBeInTheDocument()
    expect(screen.getByText(/disponible próximamente/i)).toBeInTheDocument()
  })

  it('renders title without subtitle when subtitle is omitted', () => {
    render(<PlaceholderPage title="Caja" />)
    expect(screen.getByText('Caja')).toBeInTheDocument()
  })
})
