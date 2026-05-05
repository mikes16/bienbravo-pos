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

  it('clicking Otro reveals input', async () => {
    const user = userEvent.setup()
    render(<TipInput totalCents={100000} tipCents={0} onChange={() => {}} />)
    await user.click(screen.getByText(/otro/i))
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })
})
