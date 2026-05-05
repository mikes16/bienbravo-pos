import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { HoyRow } from './HoyRow'

const baseProps = {
  id: 'a1',
  kind: 'pending' as const,
  timeLabel: '12:30',
  customerName: 'Pedro Soto',
  customerPhotoUrl: null as string | null,
  customerInitials: 'PS',
  serviceLabel: 'Corte + barba',
  meta: null as string | null,
  pillLabel: 'Cita',
  pillTone: 'appt' as const,
  sourceKind: 'appointment' as const,
  sourceId: 'appt-1',
  onClick: () => {},
}

describe('HoyRow', () => {
  it('renders customer name and service', () => {
    render(<HoyRow {...baseProps} />)
    expect(screen.getByText('Pedro Soto')).toBeInTheDocument()
    expect(screen.getByText(/corte \+ barba/i)).toBeInTheDocument()
  })

  it('renders time label', () => {
    render(<HoyRow {...baseProps} timeLabel="12:30" />)
    expect(screen.getByText('12:30')).toBeInTheDocument()
  })

  it('renders initials when no photo', () => {
    render(<HoyRow {...baseProps} customerPhotoUrl={null} customerInitials="PS" />)
    expect(screen.getByText('PS')).toBeInTheDocument()
  })

  it('renders photo when provided', () => {
    render(<HoyRow {...baseProps} customerPhotoUrl="https://example.com/p.jpg" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://example.com/p.jpg')
  })

  it('renders meta when provided', () => {
    render(<HoyRow {...baseProps} meta="esperando 8 min" />)
    expect(screen.getByText(/esperando 8 min/i)).toBeInTheDocument()
  })

  it('does not render meta when null', () => {
    render(<HoyRow {...baseProps} meta={null} />)
    expect(screen.queryByText(/esperando/i)).not.toBeInTheDocument()
  })

  it('renders pill label', () => {
    render(<HoyRow {...baseProps} pillLabel="Walk-in" pillTone="walkin" />)
    expect(screen.getByText('Walk-in')).toBeInTheDocument()
  })

  it('calls onClick when row tapped', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<HoyRow {...baseProps} onClick={onClick} />)
    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('active kind shows EN SERVICIO and bravo styling', () => {
    const { container } = render(
      <HoyRow {...baseProps} kind="active" timeLabel="EN SERVICIO · 12 MIN" pillTone="serving" pillLabel="Servicio" />,
    )
    expect(screen.getByText(/en servicio/i)).toBeInTheDocument()
    expect((container.firstChild as Element)?.className).toMatch(/bravo/)
  })

  it('queue kind shows EN COLA', () => {
    render(
      <HoyRow {...baseProps} kind="queue" timeLabel="EN COLA" pillLabel="Walk-in" pillTone="walkin" />,
    )
    expect(screen.getByText(/en cola/i)).toBeInTheDocument()
  })

  it('next kind has cuero-viejo styling', () => {
    const { container } = render(<HoyRow {...baseProps} kind="next" />)
    expect((container.firstChild as Element)?.className).toMatch(/cuero-viejo|leather/)
  })
})
