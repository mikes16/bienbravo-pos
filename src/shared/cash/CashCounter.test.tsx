import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CashCounter } from './CashCounter'
import { emptyCashCounts } from './cashCounts'

describe('CashCounter', () => {
  it('renders all 6 denomination rows', () => {
    render(<CashCounter counts={emptyCashCounts()} onChange={() => {}} />)
    expect(screen.getByText('$500')).toBeInTheDocument()
    expect(screen.getByText('$200')).toBeInTheDocument()
    expect(screen.getByText('$100')).toBeInTheDocument()
    expect(screen.getByText('$50')).toBeInTheDocument()
    expect(screen.getByText('$20')).toBeInTheDocument()
    expect(screen.getByText('MONEDAS')).toBeInTheDocument()
  })

  it('with showTotal renders the total at the bottom matching counts', () => {
    render(
      <CashCounter
        counts={{ d500: 1, d200: 1, d100: 0, d50: 0, d20: 0, coinsCents: 0 }}
        onChange={() => {}}
        showTotal
      />,
    )
    // 1×500 + 1×200 = $700
    expect(screen.getByText(/\$700/)).toBeInTheDocument()
  })

  it('without showTotal does not render the total row', () => {
    const { container } = render(
      <CashCounter counts={emptyCashCounts()} onChange={() => {}} />,
    )
    expect(container.querySelector('[data-cash-counter-total]')).toBeNull()
  })

  it('plus on $500 row fires onChange with d500=1', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CashCounter counts={emptyCashCounts()} onChange={onChange} />)
    // The $500 row is the first; getAllByRole gives all + buttons
    const plusButtons = screen.getAllByRole('button', { name: /aumentar/i })
    await user.click(plusButtons[0]) // first row = $500
    expect(onChange).toHaveBeenCalledWith({ ...emptyCashCounts(), d500: 1 })
  })

  it('MONEDAS lump-sum input fires onChange with coinsCents in cents', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CashCounter counts={emptyCashCounts()} onChange={onChange} />)
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '45')
    expect(onChange).toHaveBeenLastCalledWith({ ...emptyCashCounts(), coinsCents: 4500 })
  })

  it('totalLabelOverride changes the total label', () => {
    render(
      <CashCounter
        counts={emptyCashCounts()}
        onChange={() => {}}
        showTotal
        totalLabelOverride="Recibido"
      />,
    )
    expect(screen.getByText(/recibido/i)).toBeInTheDocument()
  })

  it('renders bill-color stripes for the 5 bill rows', () => {
    const { container } = render(
      <CashCounter counts={emptyCashCounts()} onChange={() => {}} />,
    )
    expect(container.querySelector('[data-bill-stripe="500"]')).not.toBeNull()
    expect(container.querySelector('[data-bill-stripe="200"]')).not.toBeNull()
    expect(container.querySelector('[data-bill-stripe="100"]')).not.toBeNull()
    expect(container.querySelector('[data-bill-stripe="50"]')).not.toBeNull()
    expect(container.querySelector('[data-bill-stripe="20"]')).not.toBeNull()
  })
})
