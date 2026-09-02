import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TipInput } from './TipInput'

describe('TipInput', () => {
  it('renders preset chips', () => {
    render(<TipInput totalCents={100000} tipCents={0} onChange={() => {}} />)
    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.getByText('15%')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
    expect(screen.getByText(/otro/i)).toBeInTheDocument()
  })

  it('clicking 15% sets tip to 15% of total', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TipInput totalCents={100000} tipCents={0} onChange={onChange} />)
    await user.click(screen.getByText('15%'))
    expect(onChange).toHaveBeenCalledWith(15000)
  })

  it('Otro is selected by default with an empty $0 input', () => {
    render(<TipInput totalCents={100000} tipCents={0} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /otro/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('spinbutton', { name: /otra propina/i })).toHaveValue(null)
  })

  it('renders Otro and Cierre before the presets', () => {
    render(<TipInput totalCents={100000} tipCents={0} onChange={() => {}} />)
    const labels = screen.getAllByRole('button').map((b) => b.textContent)
    expect(labels).toEqual(['Otro', 'Cierre', '10%', '15%', '20%'])
  })

  it('typing in Otro reports the tip in cents', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TipInput totalCents={100000} tipCents={0} onChange={onChange} />)
    await user.type(screen.getByRole('spinbutton', { name: /otra propina/i }), '25')
    expect(onChange).toHaveBeenLastCalledWith(2500)
  })
})
