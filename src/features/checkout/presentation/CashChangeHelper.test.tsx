import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CashChangeHelper } from './CashChangeHelper'

describe('CashChangeHelper', () => {
  it('renders 0 change when received < total', () => {
    render(<CashChangeHelper totalCents={81000} receivedPesos={500} onReceivedChange={() => {}} />)
    expect(screen.getByText(/cambio.*\$0/i)).toBeInTheDocument()
  })

  it('renders correct change when received > total', () => {
    render(<CashChangeHelper totalCents={81000} receivedPesos={1000} onReceivedChange={() => {}} />)
    expect(screen.getByText(/cambio.*\$190/i)).toBeInTheDocument()
  })

  it('input fires onReceivedChange', async () => {
    const onReceivedChange = vi.fn()
    const user = userEvent.setup()
    render(<CashChangeHelper totalCents={81000} receivedPesos={0} onReceivedChange={onReceivedChange} />)
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '1000')
    expect(onReceivedChange).toHaveBeenLastCalledWith(1000)
  })
})
