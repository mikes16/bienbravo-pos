import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CajaOpenView } from './CajaOpenView'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { localDayInTz } from '@/shared/lib/date'
import type { RegisterSession } from '../domain/register.types'

const BASE: Omit<RegisterSession, 'openedAt'> = {
  id: 'sess-1',
  status: 'OPEN',
  closedAt: null,
  openingCashCents: 50000,
  expectedCashCents: 184000,
  expectedCardCents: 254000,
  expectedTransferCents: 126000,
  countedCashCents: null,
  countedCardCents: null,
  countedTransferCents: null,
}

// Sesión abierta HOY. Monterrey es UTC-6 todo el año → 15:15 UTC = 09:15 local,
// mismo día. Derivamos el día local real para que el test no dependa de la fecha
// de ejecución.
const todayLocal = localDayInTz(new Date(), 'America/Monterrey')
const TODAY_SESSION: RegisterSession = { ...BASE, openedAt: `${todayLocal}T15:15:00.000Z` }
// Sesión abierta hace semanas (2026-05-04) — nunca es "hoy".
const OLD_SESSION: RegisterSession = { ...BASE, openedAt: '2026-05-04T09:15:00.000Z' }

describe('CajaOpenView', () => {
  it('renders the open status banner', () => {
    renderWithProviders(<CajaOpenView session={TODAY_SESSION} todayTransactions={[]} fondoCents={50000} onCerrar={() => {}} />)
    expect(screen.getByText(/caja abierta/i)).toBeInTheDocument()
  })

  it('muestra solo la hora cuando la sesión abrió hoy', () => {
    renderWithProviders(<CajaOpenView session={TODAY_SESSION} todayTransactions={[]} fondoCents={50000} onCerrar={() => {}} />)
    // 15:15 UTC = 09:15 local Monterrey; abierta hoy → "Desde 09:15" sin fecha.
    expect(screen.getByText(/Desde 09:15/)).toBeInTheDocument()
    // No debe prefijar mes en una sesión de hoy.
    expect(screen.queryByText(/Desde\s+\d+\s+\w+\s+·\s+09:15/)).not.toBeInTheDocument()
  })

  it('prefija fecha corta cuando la sesión NO abrió hoy (una de hace semanas no parece de hoy)', () => {
    renderWithProviders(<CajaOpenView session={OLD_SESSION} todayTransactions={[]} fondoCents={50000} onCerrar={() => {}} />)
    // 2026-05-04 09:15 UTC = 03:15 local → "Desde 4 may · 03:15".
    expect(screen.getByText(/Desde\s+4\s+may\s+·\s+03:15/i)).toBeInTheDocument()
  })

  it('muestra el fondo inicial real que recibe (no un placeholder)', () => {
    renderWithProviders(<CajaOpenView session={TODAY_SESSION} todayTransactions={[]} fondoCents={73500} onCerrar={() => {}} />)
    expect(screen.getByText(/fondo \$735/i)).toBeInTheDocument()
  })

  it('shows the three totals cards with formatted amounts', () => {
    renderWithProviders(<CajaOpenView session={TODAY_SESSION} todayTransactions={[]} fondoCents={50000} onCerrar={() => {}} />)
    expect(screen.getByText('$1,840')).toBeInTheDocument()
    expect(screen.getByText('$2,540')).toBeInTheDocument()
    expect(screen.getByText('$1,260')).toBeInTheDocument()
  })

  it('oculta la sección VENTAS DE HOY cuando no hay ventas (ledger sin cablear)', () => {
    // Con todayTransactions=[] la sección entera se oculta — mostrar
    // "Sin ventas todavía" hardcodeado sería una mentira permanente.
    renderWithProviders(<CajaOpenView session={TODAY_SESSION} todayTransactions={[]} fondoCents={50000} onCerrar={() => {}} />)
    expect(screen.queryByText(/ventas de hoy/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sin ventas todavía/i)).not.toBeInTheDocument()
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
    renderWithProviders(<CajaOpenView session={TODAY_SESSION} todayTransactions={txs} fondoCents={50000} onCerrar={() => {}} />)
    // Con ventas reales, la sección sí aparece.
    expect(screen.getByText(/ventas de hoy/i)).toBeInTheDocument()
    expect(screen.getByText(/carlos méndez/i)).toBeInTheDocument()
    expect(screen.getByText('$280')).toBeInTheDocument()
  })

  it('calls onCerrar when CERRAR CAJA button tapped', async () => {
    const onCerrar = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<CajaOpenView session={TODAY_SESSION} todayTransactions={[]} fondoCents={50000} onCerrar={onCerrar} />)
    await user.click(screen.getByRole('button', { name: /cerrar caja/i }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })
})
