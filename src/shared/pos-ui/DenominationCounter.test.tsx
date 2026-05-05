import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DenominationCounter } from './DenominationCounter'

describe('DenominationCounter', () => {
  it('renders amount label and subtotal', () => {
    render(
      <DenominationCounter amountLabel="$500" count={2} subtotalCents={100000} onCountChange={() => {}} />,
    )
    expect(screen.getByText('$500')).toBeInTheDocument()
    expect(screen.getByText('$1,000')).toBeInTheDocument()
  })

  it('renders count when greater than 0', () => {
    render(
      <DenominationCounter amountLabel="$200" count={5} subtotalCents={100000} onCountChange={() => {}} />,
    )
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('plus button increments count', async () => {
    const onCountChange = vi.fn()
    const user = userEvent.setup()
    render(
      <DenominationCounter amountLabel="$100" count={3} subtotalCents={30000} onCountChange={onCountChange} />,
    )
    await user.click(screen.getByRole('button', { name: /aumentar/i }))
    expect(onCountChange).toHaveBeenCalledWith(4)
  })

  it('minus button decrements count', async () => {
    const onCountChange = vi.fn()
    const user = userEvent.setup()
    render(
      <DenominationCounter amountLabel="$100" count={3} subtotalCents={30000} onCountChange={onCountChange} />,
    )
    await user.click(screen.getByRole('button', { name: /disminuir/i }))
    expect(onCountChange).toHaveBeenCalledWith(2)
  })

  it('minus button is disabled at count 0', async () => {
    const onCountChange = vi.fn()
    const user = userEvent.setup()
    render(
      <DenominationCounter amountLabel="$50" count={0} subtotalCents={0} onCountChange={onCountChange} />,
    )
    const minus = screen.getByRole('button', { name: /disminuir/i })
    expect(minus).toBeDisabled()
    await user.click(minus)
    expect(onCountChange).not.toHaveBeenCalled()
  })

  it('renders with hasCount visual class when count > 0', () => {
    const { container, rerender } = render(
      <DenominationCounter amountLabel="$100" count={0} subtotalCents={0} onCountChange={() => {}} />,
    )
    expect((container.firstChild as HTMLElement)?.className).not.toMatch(/bravo/)
    rerender(
      <DenominationCounter amountLabel="$100" count={2} subtotalCents={20000} onCountChange={() => {}} />,
    )
    expect((container.firstChild as HTMLElement)?.className).toMatch(/bravo/)
  })

  it('lump-sum mode renders coins input instead of counter', async () => {
    const onLumpSumChange = vi.fn()
    const user = userEvent.setup()
    render(
      <DenominationCounter
        amountLabel="MONEDAS"
        subtotalCents={4000}
        isLumpSum
        lumpSumCents={4000}
        onLumpSumChange={onLumpSumChange}
      />,
    )
    expect(screen.getByText('MONEDAS')).toBeInTheDocument()
    const input = screen.getByRole('spinbutton')
    expect(input).toHaveValue(40)
    await user.clear(input)
    await user.type(input, '60')
    expect(onLumpSumChange).toHaveBeenLastCalledWith(6000)
  })

  it('does not call onLumpSumChange when input is cleared', async () => {
    const onLumpSumChange = vi.fn()
    const user = userEvent.setup()
    render(
      <DenominationCounter
        amountLabel="MONEDAS"
        subtotalCents={4000}
        isLumpSum
        lumpSumCents={4000}
        onLumpSumChange={onLumpSumChange}
      />,
    )
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    expect(onLumpSumChange).not.toHaveBeenCalled()
  })

  it('renders bill-color stripe when denomination is 500', () => {
    const { container } = render(
      <DenominationCounter
        amountLabel="$500"
        denomination={500}
        count={0}
        subtotalCents={0}
        onCountChange={() => {}}
      />,
    )
    const stripe = container.querySelector('[data-bill-stripe="500"]')
    expect(stripe).not.toBeNull()
  })

  it('renders bill-color stripe for each denomination', () => {
    const denominations = [500, 200, 100, 50, 20] as const
    for (const d of denominations) {
      const { container, unmount } = render(
        <DenominationCounter
          amountLabel={`$${d}`}
          denomination={d}
          count={0}
          subtotalCents={0}
          onCountChange={() => {}}
        />,
      )
      expect(container.querySelector(`[data-bill-stripe="${d}"]`)).not.toBeNull()
      unmount()
    }
  })

  it('does NOT render a stripe in lump-sum mode', () => {
    const { container } = render(
      <DenominationCounter
        amountLabel="MONEDAS"
        subtotalCents={4000}
        isLumpSum
        lumpSumCents={4000}
        onLumpSumChange={() => {}}
      />,
    )
    expect(container.querySelector('[data-bill-stripe]')).toBeNull()
  })

  it('does NOT render a stripe when denomination prop is omitted', () => {
    const { container } = render(
      <DenominationCounter
        amountLabel="$100"
        count={0}
        subtotalCents={0}
        onCountChange={() => {}}
      />,
    )
    expect(container.querySelector('[data-bill-stripe]')).toBeNull()
  })
})
