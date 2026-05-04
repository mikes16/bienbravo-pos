import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MoneyDisplay } from './MoneyDisplay'

describe('MoneyDisplay', () => {
  it('renders cents as MXN with peso sign', () => {
    render(<MoneyDisplay cents={82000} />)
    expect(screen.getByText('$')).toBeInTheDocument()
    expect(screen.getByText('820')).toBeInTheDocument()
  })

  it('renders zero correctly', () => {
    render(<MoneyDisplay cents={0} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('formats thousands with commas', () => {
    render(<MoneyDisplay cents={342000} />)
    expect(screen.getByText('3,420')).toBeInTheDocument()
  })

  it('shows fractional cents in the decimals span when nonzero', () => {
    render(<MoneyDisplay cents={82050} />)
    expect(screen.getByText('820')).toBeInTheDocument()
    expect(screen.getByText('.50')).toBeInTheDocument()
  })

  it('omits decimals when value is whole', () => {
    render(<MoneyDisplay cents={82000} />)
    expect(screen.queryByText(/\.\d{2}/)).not.toBeInTheDocument()
  })

  it('applies size class for the chosen variant', () => {
    const { container } = render(<MoneyDisplay cents={82000} size="L" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('text-[var(--pos-text-numeral-l)]')
  })
})
