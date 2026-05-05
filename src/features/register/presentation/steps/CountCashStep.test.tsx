import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CountCashStep, type CashCounts } from './CountCashStep'

const ZERO: CashCounts = {
  d500: 0, d200: 0, d100: 0, d50: 0, d20: 0, coinsCents: 0,
}

describe('CountCashStep', () => {
  it('renders all 5 bill denominations + monedas row', () => {
    render(
      <CountCashStep counts={ZERO} expectedCashCents={0} onChange={() => {}} />,
    )
    expect(screen.getByText('$500')).toBeInTheDocument()
    expect(screen.getByText('$200')).toBeInTheDocument()
    expect(screen.getByText('$100')).toBeInTheDocument()
    expect(screen.getByText('$50')).toBeInTheDocument()
    expect(screen.getByText('$20')).toBeInTheDocument()
    expect(screen.getAllByText(/monedas/i).length).toBeGreaterThan(0)
  })

  it('clicking + on a denomination invokes onChange with incremented count', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CountCashStep counts={ZERO} expectedCashCents={0} onChange={onChange} />)
    const plusButtons = screen.getAllByRole('button', { name: /aumentar cantidad/i })
    await user.click(plusButtons[0])  // first + is for $500
    expect(onChange).toHaveBeenCalledWith({ ...ZERO, d500: 1 })
  })

  it('shows total contado matching the sum', () => {
    const counts: CashCounts = {
      d500: 2, d200: 5, d100: 3, d50: 0, d20: 25, coinsCents: 4000,
    }
    render(<CountCashStep counts={counts} expectedCashCents={284000} onChange={() => {}} />)
    // total = 2*50000 + 5*20000 + 3*10000 + 0 + 25*2000 + 4000 = 284000 → $2,840
    expect(screen.getByText('$2,840')).toBeInTheDocument()
    expect(screen.getByText(/esperado: \$2,840/i)).toBeInTheDocument()
  })

  it('shows total $0 when all counts are 0', () => {
    render(<CountCashStep counts={ZERO} expectedCashCents={0} onChange={() => {}} />)
    expect(screen.getAllByText('$0').length).toBeGreaterThan(0)
  })

  it('coins input updates lump sum cents', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CountCashStep counts={ZERO} expectedCashCents={0} onChange={onChange} />)
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '40')
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall.coinsCents).toBe(4000)
  })
})
