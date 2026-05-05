import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ReviewCloseStep } from './ReviewCloseStep'

const PERFECT = {
  expected: { cashCents: 184000, cardCents: 254000, transferCents: 126000 },
  counted: { cashCents: 184000, cardCents: 254000, transferCents: 126000 },
}
const SMALL_DIFF = {
  expected: { cashCents: 184000, cardCents: 254000, transferCents: 126000 },
  counted: { cashCents: 181000, cardCents: 254000, transferCents: 126000 },
}
const LARGE_DIFF = {
  expected: { cashCents: 184000, cardCents: 254000, transferCents: 126000 },
  counted: { cashCents: 164000, cardCents: 254000, transferCents: 126000 },
}

describe('ReviewCloseStep', () => {
  it('shows green banner when diff is 0', () => {
    render(<ReviewCloseStep {...PERFECT} confirmAck={false} onConfirmAckChange={() => {}} />)
    expect(screen.getByText(/todo cuadra/i)).toBeInTheDocument()
  })

  it('shows amber faltante banner when |diff| <= $50', () => {
    render(<ReviewCloseStep {...SMALL_DIFF} confirmAck={false} onConfirmAckChange={() => {}} />)
    expect(screen.getByText(/faltante de \$30/i)).toBeInTheDocument()
  })

  it('shows bravo banner when |diff| > $50', () => {
    render(<ReviewCloseStep {...LARGE_DIFF} confirmAck={false} onConfirmAckChange={() => {}} />)
    expect(screen.getByText(/faltante de \$200/i)).toBeInTheDocument()
  })

  it('renders the comparison table with three rows', () => {
    render(<ReviewCloseStep {...PERFECT} confirmAck={false} onConfirmAckChange={() => {}} />)
    expect(screen.getByText(/efectivo/i)).toBeInTheDocument()
    expect(screen.getAllByText(/tarjeta/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/stripe/i).length).toBeGreaterThan(0)
  })

  it('confirmAck checkbox calls onConfirmAckChange', async () => {
    const onConfirmAckChange = vi.fn()
    const user = userEvent.setup()
    render(<ReviewCloseStep {...SMALL_DIFF} confirmAck={false} onConfirmAckChange={onConfirmAckChange} />)
    await user.click(screen.getByRole('checkbox'))
    expect(onConfirmAckChange).toHaveBeenCalledWith(true)
  })

  it('does NOT show checkbox when diff is 0', () => {
    render(<ReviewCloseStep {...PERFECT} confirmAck={false} onConfirmAckChange={() => {}} />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
