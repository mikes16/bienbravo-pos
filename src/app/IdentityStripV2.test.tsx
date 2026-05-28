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

  it('renders "En piso" badge when operator is clocked-in and free', () => {
    render(<IdentityStripV2 {...baseProps} operatorStatus="en_piso" />)
    expect(screen.getByText(/en piso/i)).toBeInTheDocument()
  })

  it('renders "En servicio" badge when operator is busy', () => {
    render(<IdentityStripV2 {...baseProps} operatorStatus="en_servicio" />)
    expect(screen.getByText(/en servicio/i)).toBeInTheDocument()
  })

  it('renders "Sin turno" badge when operator has not clocked in', () => {
    render(<IdentityStripV2 {...baseProps} operatorStatus="fuera_de_turno" />)
    expect(screen.getByText(/sin turno/i)).toBeInTheDocument()
  })

  it('hides badge while operator status is loading', () => {
    render(<IdentityStripV2 {...baseProps} operatorStatus={null} />)
    expect(screen.queryByText(/en piso|en servicio|sin turno/i)).not.toBeInTheDocument()
  })

  it('renders the time formatted as HH:MM 24h', () => {
    render(<IdentityStripV2 {...baseProps} now={new Date('2026-05-04T11:47:00')} />)
    expect(screen.getByText(/11:47/)).toBeInTheDocument()
  })

  it('renders staff initials when no photoUrl', () => {
    render(<IdentityStripV2 {...baseProps} staffName="Eli Cruz" staffPhotoUrl={null} />)
    expect(screen.getByText('EC')).toBeInTheDocument()
  })

  it('renders staff photo when photoUrl provided', () => {
    render(
      <IdentityStripV2
        {...baseProps}
        staffName="Eli"
        staffPhotoUrl="https://example.com/eli.jpg"
      />,
    )
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/eli.jpg')
  })

  it('calls onLock when lock button tapped', async () => {
    const onLock = vi.fn()
    const user = userEvent.setup()
    render(<IdentityStripV2 {...baseProps} onLock={onLock} />)
    await user.click(screen.getByRole('button', { name: /bloquear|lock/i }))
    expect(onLock).toHaveBeenCalledTimes(1)
  })

  it('uses custom brand prop when provided', () => {
    render(<IdentityStripV2 {...baseProps} brand="CUSTOM" />)
    expect(screen.getByText('CUSTOM')).toBeInTheDocument()
    expect(screen.queryByText('BIENBRAVO')).not.toBeInTheDocument()
  })
})
