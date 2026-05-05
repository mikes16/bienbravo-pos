import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CashChangeHelper } from './CashChangeHelper'
import { emptyCashCounts } from '@/shared/cash/cashCounts'

describe('CashChangeHelper', () => {
  it('renders the 6 denomination rows', () => {
    render(
      <CashChangeHelper totalCents={81000} counts={emptyCashCounts()} onCountsChange={() => {}} />,
    )
    expect(screen.getByText('$500')).toBeInTheDocument()
    expect(screen.getByText('MONEDAS')).toBeInTheDocument()
  })

  it('renders 0 change when received < total', () => {
    render(
      <CashChangeHelper
        totalCents={81000}
        counts={{ ...emptyCashCounts(), d500: 1 }} // $500 received
        onCountsChange={() => {}}
      />,
    )
    expect(screen.getByText(/cambio.*\$0/i)).toBeInTheDocument()
  })

  it('renders correct change when received > total', () => {
    render(
      <CashChangeHelper
        totalCents={81000}
        counts={{ ...emptyCashCounts(), d500: 2 }} // $1,000 received → change $190
        onCountsChange={() => {}}
      />,
    )
    expect(screen.getByText(/cambio.*\$190/i)).toBeInTheDocument()
  })

  it('renders the "Recibido" total derived from counts', () => {
    render(
      <CashChangeHelper
        totalCents={81000}
        counts={{ ...emptyCashCounts(), d500: 2 }}
        onCountsChange={() => {}}
      />,
    )
    expect(screen.getByText(/recibido/i)).toBeInTheDocument()
    // Two $500 = $1,000 displayed somewhere in the total row
    expect(screen.getAllByText(/\$1,000/).length).toBeGreaterThan(0)
  })

  it('tapping + on $500 row fires onCountsChange with d500=1', async () => {
    const onCountsChange = vi.fn()
    const user = userEvent.setup()
    render(
      <CashChangeHelper totalCents={81000} counts={emptyCashCounts()} onCountsChange={onCountsChange} />,
    )
    const plusButtons = screen.getAllByRole('button', { name: /aumentar/i })
    await user.click(plusButtons[0])
    expect(onCountsChange).toHaveBeenCalledWith({ ...emptyCashCounts(), d500: 1 })
  })
})
