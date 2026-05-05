import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AtendiendoHeader } from './AtendiendoHeader'

const ANTONIO = { id: 'b1', fullName: 'Antonio Pérez', photoUrl: null }

describe('AtendiendoHeader', () => {
  it('renders atendiendo eyebrow + barber name', () => {
    render(<AtendiendoHeader barber={ANTONIO} onTap={() => {}} />)
    expect(screen.getByText(/atendiendo/i)).toBeInTheDocument()
    expect(screen.getByText(/antonio/i)).toBeInTheDocument()
  })

  it('clicking calls onTap', async () => {
    const onTap = vi.fn()
    const user = userEvent.setup()
    render(<AtendiendoHeader barber={ANTONIO} onTap={onTap} />)
    await user.click(screen.getByRole('button'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('renders avatar fallback initial when no photoUrl', () => {
    render(<AtendiendoHeader barber={ANTONIO} onTap={() => {}} />)
    expect(screen.getByText('A')).toBeInTheDocument()
  })
})
