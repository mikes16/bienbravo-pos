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

  it('Guardar applies adjusted amount via onChange', async () => {
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
    // Open adjust mode for tarjeta
    const adjustButtons = screen.getAllByRole('button', { name: /ajustar/i })
    await user.click(adjustButtons[0])

    // Type a different amount
    const input = screen.getAllByRole('spinbutton')[0]
    await user.clear(input)
    await user.type(input, '2530')

    // Click Guardar
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    // onChange called with adjusted cents
    expect(onChange).toHaveBeenCalledWith({ cardCents: 253000, transferCents: null })
  })

  it('re-adjusting from confirmed state seeds input with confirmed value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmDigitalStep
        expectedCardCents={254000}
        expectedTransferCents={126000}
        counted={{ cardCents: 250000, transferCents: 126000 }}
        onChange={onChange}
      />,
    )
    // First Ajustar button is the confirmed-state one for tarjeta
    const adjustButtons = screen.getAllByRole('button', { name: /ajustar/i })
    await user.click(adjustButtons[0])

    // The input should default to 2500 (pesos), not 2540 (the expected value)
    const inputs = screen.getAllByRole('spinbutton')
    expect((inputs[0] as HTMLInputElement).value).toBe('2500')
  })
})
