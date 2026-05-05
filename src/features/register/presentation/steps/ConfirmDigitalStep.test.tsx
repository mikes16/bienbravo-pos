import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ConfirmDigitalStep, type DigitalCounted } from './ConfirmDigitalStep'

const PENDING: DigitalCounted = { cardCents: null, transferCents: null }
const CONFIRMED: DigitalCounted = { cardCents: 254000, transferCents: 126000 }

describe('ConfirmDigitalStep', () => {
  it('renders both expected amounts', () => {
    render(
      <ConfirmDigitalStep
        expectedCardCents={254000}
        expectedTransferCents={126000}
        counted={PENDING}
        onChange={() => {}}
      />,
    )
    expect(screen.getAllByText('$2,540').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$1,260').length).toBeGreaterThan(0)
  })

  it('clicking "Sí, $2,540" confirms tarjeta', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmDigitalStep
        expectedCardCents={254000}
        expectedTransferCents={126000}
        counted={PENDING}
        onChange={onChange}
      />,
    )
    await user.click(screen.getByRole('button', { name: /sí, \$2,540/i }))
    expect(onChange).toHaveBeenCalledWith({ cardCents: 254000, transferCents: null })
  })

  it('clicking "Ajustar" reveals an input', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmDigitalStep
        expectedCardCents={254000}
        expectedTransferCents={126000}
        counted={PENDING}
        onChange={() => {}}
      />,
    )
    const adjustButtons = screen.getAllByRole('button', { name: /ajustar/i })
    await user.click(adjustButtons[0])
    expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0)
  })

  it('shows confirmed state when both counted', () => {
    render(
      <ConfirmDigitalStep
        expectedCardCents={254000}
        expectedTransferCents={126000}
        counted={CONFIRMED}
        onChange={() => {}}
      />,
    )
    const confirmedTexts = screen.getAllByText(/confirmado|✓/i)
    expect(confirmedTexts.length).toBeGreaterThan(0)
  })
})
