import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { IdentityStripV2 } from './IdentityStripV2'

const baseProps = {
  sucursalName: 'Sucursal Norte',
  isOnline: true,
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

  it('renders ONLINE pill when isOnline=true', () => {
    render(<IdentityStripV2 {...baseProps} isOnline />)
    expect(screen.getByText(/online/i)).toBeInTheDocument()
  })

  it('hides ONLINE pill when isOnline=false', () => {
    render(<IdentityStripV2 {...baseProps} isOnline={false} />)
    expect(screen.queryByText(/online/i)).not.toBeInTheDocument()
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
