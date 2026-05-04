import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PinEntryView } from './PinEntryView'

describe('PinEntryView', () => {
  it('renders barber name', () => {
    render(
      <PinEntryView
        staffName="Juan Pérez"
        photoUrl={null}
        error={null}
        onSubmit={() => {}}
        onBack={() => {}}
      />,
    )
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument()
  })

  it('renders error message when provided', () => {
    render(
      <PinEntryView
        staffName="Juan"
        photoUrl={null}
        error="PIN incorrecto · 5 intentos restantes"
        onSubmit={() => {}}
        onBack={() => {}}
      />,
    )
    expect(screen.getByText(/pin incorrecto/i)).toBeInTheDocument()
    expect(screen.getByText(/5 intentos/i)).toBeInTheDocument()
  })

  it('calls onSubmit with the 4-digit PIN once entered', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <PinEntryView
        staffName="Juan"
        photoUrl={null}
        error={null}
        onSubmit={onSubmit}
        onBack={() => {}}
      />,
    )
    for (const d of ['1', '2', '3', '4']) {
      await user.click(screen.getByRole('button', { name: d }))
    }
    expect(onSubmit).toHaveBeenCalledWith('1234')
  })

  it('calls onBack when "Otro barbero" link is tapped', async () => {
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(
      <PinEntryView
        staffName="Juan"
        photoUrl={null}
        error={null}
        onSubmit={() => {}}
        onBack={onBack}
      />,
    )
    await user.click(screen.getByRole('button', { name: /otro barbero/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('renders photo when photoUrl provided', () => {
    render(
      <PinEntryView
        staffName="Juan"
        photoUrl="https://example.com/j.jpg"
        error={null}
        onSubmit={() => {}}
        onBack={() => {}}
      />,
    )
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/j.jpg')
  })

  it('shows "Validando…" and disables back after PIN is complete', async () => {
    const user = userEvent.setup()
    render(
      <PinEntryView
        staffName="Juan"
        photoUrl={null}
        error={null}
        onSubmit={() => {}}
        onBack={() => {}}
      />,
    )
    expect(screen.getByText(/ingresa tu pin/i)).toBeInTheDocument()
    for (const d of ['1', '2', '3', '4']) {
      await user.click(screen.getByRole('button', { name: d }))
    }
    expect(await screen.findByText(/validando/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /otro barbero/i })).toBeDisabled()
  })
})
