import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CajaOpenView } from './CajaOpenView'
import type { RegisterSession } from '../domain/register.types'

const SESSION: RegisterSession = {
  id: 'sess-1',
  status: 'OPEN',
  openedAt: '2026-05-04T09:15:00.000Z',
  closedAt: null,
  expectedCashCents: 184000,
  expectedCardCents: 254000,
  expectedTransferCents: 126000,
  countedCashCents: null,
  countedCardCents: null,
  countedTransferCents: null,
}

describe('CajaOpenView', () => {
  it('renders the open status banner', () => {
    render(<CajaOpenView session={SESSION} todayTransactions={[]} fondoCents={50000} onCerrar={() => {}} />)
    expect(screen.getByText(/caja abierta/i)).toBeInTheDocument()
    // openedAt = '2026-05-04T09:15:00.000Z'; America/Monterrey is UTC-6 year-round → 03:15
    expect(screen.getByText(/Desde 03:15/)).toBeInTheDocument()
  })

  it('shows the three totals cards with formatted amounts', () => {
    render(<CajaOpenView session={SESSION} todayTransactions={[]} fondoCents={50000} onCerrar={() => {}} />)
    expect(screen.getByText('$1,840')).toBeInTheDocument()
    expect(screen.getByText('$2,540')).toBeInTheDocument()
    expect(screen.getByText('$1,260')).toBeInTheDocument()
  })

  it('renders empty transactions state when no sales', () => {
    render(<CajaOpenView session={SESSION} todayTransactions={[]} fondoCents={50000} onCerrar={() => {}} />)
    expect(screen.getByText(/sin ventas|0 ventas/i)).toBeInTheDocument()
  })

  it('renders transaction rows when sales exist', () => {
    const txs = [
      {
        id: 's1',
        createdAt: '2026-05-04T16:18:00.000Z',
        totalCents: 28000,
        paymentStatus: 'PAID',
        customer: { fullName: 'Carlos Méndez' } as any,
        appointmentId: null,
        walkInId: 'w1',
      } as any,
    ]
    render(<CajaOpenView session={SESSION} todayTransactions={txs} fondoCents={50000} onCerrar={() => {}} />)
    expect(screen.getByText(/carlos méndez/i)).toBeInTheDocument()
    expect(screen.getByText('$280')).toBeInTheDocument()
  })

  it('calls onCerrar when CERRAR CAJA button tapped', async () => {
    const onCerrar = vi.fn()
    const user = userEvent.setup()
    render(<CajaOpenView session={SESSION} todayTransactions={[]} fondoCents={50000} onCerrar={onCerrar} />)
    await user.click(screen.getByRole('button', { name: /cerrar caja/i }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })
})
