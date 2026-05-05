import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CustomerLookupSheet } from './CustomerLookupSheet'

const RESULTS = [
  { id: 'c1', fullName: 'Carlos Méndez', email: 'carlos@test.com', phone: null },
  { id: 'c2', fullName: 'Carla Soto', email: null, phone: '+528111234567' },
]

describe('CustomerLookupSheet', () => {
  it('renders search input when open', () => {
    render(<CustomerLookupSheet open results={[]} onSearchChange={() => {}} onSelect={() => {}} onCreate={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('textbox', { name: /buscar/i })).toBeInTheDocument()
  })

  it('renders results when search returns matches', () => {
    render(<CustomerLookupSheet open results={RESULTS} onSearchChange={() => {}} onSelect={() => {}} onCreate={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Carlos Méndez')).toBeInTheDocument()
    expect(screen.getByText('Carla Soto')).toBeInTheDocument()
  })

  it('renders empty-state CTA "Crear nuevo" when results empty', () => {
    render(<CustomerLookupSheet open results={[]} onSearchChange={() => {}} onSelect={() => {}} onCreate={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /crear/i })).toBeInTheDocument()
  })

  it('clicking a result fires onSelect with the customer', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<CustomerLookupSheet open results={RESULTS} onSearchChange={() => {}} onSelect={onSelect} onCreate={() => {}} onClose={() => {}} />)
    await user.click(screen.getByText('Carlos Méndez'))
    expect(onSelect).toHaveBeenCalledWith(RESULTS[0])
  })
})
