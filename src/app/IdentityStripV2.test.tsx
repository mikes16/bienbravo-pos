import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { IdentityStripV2 } from './IdentityStripV2'

const baseProps = {
  sucursalName: 'Sucursal Norte',
  operatorStatus: 'en_piso' as const,
  now: new Date('2026-05-04T11:47:00'),
  staffName: 'Eli Cruz',
  staffPhotoUrl: null as string | null,
  onLock: () => {},
  timezone: 'America/Monterrey',
}

describe('IdentityStripV2', () => {
  it('renders brand wordmark', () => {
    render(<IdentityStripV2 {...baseProps} />)
    expect(screen.getByText('BIENBRAVO')).toBeInTheDocument()
  })

  it('renders sucursal name', () => {
    render(<IdentityStripV2 {...baseProps} sucursalName="Sucursal Norte" />)
    expect(screen.getByText(/sucursal norte/i)).toBeInTheDocument()
  })

  // R9: el nombre COMPLETO es el ancla de la sesión — con iniciales sueltas
  // un barbero cobraba en el perfil de otro sin darse cuenta.
  it('renders the operator full name as text', () => {
    render(<IdentityStripV2 {...baseProps} staffName="Aarón Cruz" />)
    expect(screen.getByText('Aarón Cruz')).toBeInTheDocument()
  })

  it('keeps the full name in the DOM even when it is long (truncation is visual only)', () => {
    render(<IdentityStripV2 {...baseProps} staffName="Aarón Guadalupe Cruz Martínez" />)
    expect(screen.getByText('Aarón Guadalupe Cruz Martínez')).toBeInTheDocument()
  })

  it('renders "En piso" status under the name when operator is clocked-in and free', () => {
    render(<IdentityStripV2 {...baseProps} operatorStatus="en_piso" />)
    expect(screen.getByText(/en piso · sesión activa/i)).toBeInTheDocument()
  })

  it('renders "En servicio" status when operator is busy', () => {
    render(<IdentityStripV2 {...baseProps} operatorStatus="en_servicio" />)
    expect(screen.getByText(/en servicio · sesión activa/i)).toBeInTheDocument()
  })

  it('renders "Sin checar" status when operator has not clocked in', () => {
    render(<IdentityStripV2 {...baseProps} operatorStatus="fuera_de_turno" />)
    expect(screen.getByText(/sin checar · sesión activa/i)).toBeInTheDocument()
  })

  it('shows only "Sesión activa" while operator status is loading (no invented status)', () => {
    render(<IdentityStripV2 {...baseProps} operatorStatus={null} />)
    expect(screen.queryByText(/en piso|en servicio|sin checar/i)).not.toBeInTheDocument()
    expect(screen.getByText(/sesión activa/i)).toBeInTheDocument()
  })

  it('places the status line after the name (status reads under it)', () => {
    render(<IdentityStripV2 {...baseProps} staffName="Eli Cruz" operatorStatus="en_piso" />)
    const name = screen.getByText('Eli Cruz')
    const status = screen.getByText(/en piso · sesión activa/i)
    // Document order: el estado va después del nombre, no antes.
    expect(name.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders the time formatted as HH:MM 24h', () => {
    render(<IdentityStripV2 {...baseProps} now={new Date('2026-05-04T11:47:00')} />)
    expect(screen.getByText(/11:47/)).toBeInTheDocument()
  })

  it('renders staff initials when no photoUrl', () => {
    render(<IdentityStripV2 {...baseProps} staffName="Eli Cruz" staffPhotoUrl={null} />)
    expect(screen.getByText('EC')).toBeInTheDocument()
  })

  it('renders staff photo labelled with the operator name when photoUrl provided', () => {
    render(
      <IdentityStripV2
        {...baseProps}
        staffName="Eli Cruz"
        staffPhotoUrl="https://example.com/eli.jpg"
      />,
    )
    const photo = screen.getByRole('img', { name: 'Eli Cruz' })
    expect(photo).toHaveAttribute('src', 'https://example.com/eli.jpg')
  })

  it('renders the lock control as a button with visible "Bloquear" text', () => {
    render(<IdentityStripV2 {...baseProps} />)
    const lock = screen.getByRole('button', { name: 'Bloquear sesión' })
    expect(lock).toHaveTextContent('Bloquear')
  })

  it('gives the lock button a 44px touch area', () => {
    render(<IdentityStripV2 {...baseProps} />)
    expect(screen.getByRole('button', { name: 'Bloquear sesión' })).toHaveStyle({
      minHeight: '44px',
    })
  })

  it('calls onLock when lock button tapped', async () => {
    const onLock = vi.fn()
    const user = userEvent.setup()
    render(<IdentityStripV2 {...baseProps} onLock={onLock} />)
    await user.click(screen.getByRole('button', { name: 'Bloquear sesión' }))
    expect(onLock).toHaveBeenCalledTimes(1)
  })

  it('uses custom brand prop when provided', () => {
    render(<IdentityStripV2 {...baseProps} brand="CUSTOM" />)
    expect(screen.getByText('CUSTOM')).toBeInTheDocument()
    expect(screen.queryByText('BIENBRAVO')).not.toBeInTheDocument()
  })
})
