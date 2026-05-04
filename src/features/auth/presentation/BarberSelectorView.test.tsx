import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { BarberSelectorView } from './BarberSelectorView'
import type { PosStaffUser } from '@/core/auth/auth.types'

const SAMPLE_BARBERS: PosStaffUser[] = [
  {
    id: 'b1', fullName: 'Juan Pérez', email: 'juan@example.com',
    phone: null, photoUrl: null, isActive: true, hasPosPin: true,
    pinAttempts: 0, pinLockedUntil: null,
  },
  {
    id: 'b2', fullName: 'Pedro García', email: 'pedro@example.com',
    phone: null, photoUrl: 'https://example.com/p.jpg', isActive: true, hasPosPin: false,
    pinAttempts: 0, pinLockedUntil: null,
  },
]

describe('BarberSelectorView', () => {
  it('renders all barbers as tiles with names', () => {
    render(
      <BarberSelectorView
        barbers={SAMPLE_BARBERS}
        loading={false}
        onSelect={() => {}}
        onChangeLocation={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /juan pérez/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pedro garcía/i })).toBeInTheDocument()
  })

  it('calls onSelect when a barber is tapped', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <BarberSelectorView
        barbers={SAMPLE_BARBERS}
        loading={false}
        onSelect={onSelect}
        onChangeLocation={() => {}}
      />,
    )
    await user.click(screen.getByRole('button', { name: /juan pérez/i }))
    expect(onSelect).toHaveBeenCalledWith(SAMPLE_BARBERS[0])
  })

  it('renders empty state when no barbers', () => {
    render(
      <BarberSelectorView
        barbers={[]}
        loading={false}
        onSelect={() => {}}
        onChangeLocation={() => {}}
      />,
    )
    expect(screen.getByText(/no hay barberos activos/i)).toBeInTheDocument()
  })

  it('calls onChangeLocation when "Cambiar sucursal" is tapped', async () => {
    const onChangeLocation = vi.fn()
    const user = userEvent.setup()
    render(
      <BarberSelectorView
        barbers={SAMPLE_BARBERS}
        loading={false}
        onSelect={() => {}}
        onChangeLocation={onChangeLocation}
      />,
    )
    await user.click(screen.getByRole('button', { name: /cambiar sucursal/i }))
    expect(onChangeLocation).toHaveBeenCalledTimes(1)
  })

  it('renders loading state', () => {
    render(
      <BarberSelectorView
        barbers={[]}
        loading={true}
        onSelect={() => {}}
        onChangeLocation={() => {}}
      />,
    )
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })
})
