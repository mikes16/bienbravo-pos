import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CartTotals } from './CartTotals'

describe('CartTotals', () => {
  it('renders total label + amount', () => {
    render(<CartTotals subtotalCents={81000} />)
    expect(screen.getByText(/total/i)).toBeInTheDocument()
    expect(screen.getByText('$810')).toBeInTheDocument()
  })

  it('renders zero state with $0', () => {
    render(<CartTotals subtotalCents={0} />)
    expect(screen.getByText('$0')).toBeInTheDocument()
  })
})
