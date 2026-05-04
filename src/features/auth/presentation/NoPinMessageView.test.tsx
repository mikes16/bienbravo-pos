import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { NoPinMessageView } from './NoPinMessageView'

describe('NoPinMessageView', () => {
  it('renders barber name + message', () => {
    render(
      <NoPinMessageView staffName="Juan" photoUrl={null} onBack={() => {}} />,
    )
    expect(screen.getByText('Juan')).toBeInTheDocument()
    expect(screen.getByText(/pin no configurado/i)).toBeInTheDocument()
  })

  it('calls onBack when "Otro barbero" tapped', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(
      <NoPinMessageView staffName="Juan" photoUrl={null} onBack={onBack} />,
    )
    await user.click(screen.getByRole('button', { name: /otro barbero/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
