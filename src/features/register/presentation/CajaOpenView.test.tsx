import type { ComponentProps } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CajaOpenView } from './CajaOpenView'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { localDayInTz } from '@/shared/lib/date'
import type { RegisterSession, SaleLedgerEntry } from '../domain/register.types'

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

type ViewProps = ComponentProps<typeof CajaOpenView>

function renderView(overrides: Partial<ViewProps> = {}) {
  return renderWithProviders(
    <CajaOpenView
      session={TODAY_SESSION}
      todayTransactions={[]}
      fondoCents={50000}
      status="fresh"
      onCerrar={() => {}}
      {...overrides}
    />,
  )
}

/**
 * Las cifras de caja se pintan con `MoneyValue`: el símbolo y el número son
 * spans distintos, así que `getByText('$1,840')` ya no encuentra nada. Se
 * consultan por nombre accesible ([D-006]) y se asertan con `toHaveTextContent`.
 */
const amountOf = (label: string) => screen.getByRole('group', { name: label })
const EXPECTED_LABELS = ['Efectivo esperado', 'Tarjeta', 'Stripe']

describe('CajaOpenView', () => {
  it('renders the open status banner', () => {
    renderView()
    expect(screen.getByText(/caja abierta/i)).toBeInTheDocument()
  })

  it('muestra solo la hora cuando la sesión abrió hoy', () => {
    renderView()
    // 15:15 UTC = 09:15 local Monterrey; abierta hoy → "Desde 09:15" sin fecha.
    expect(screen.getByText(/Desde 09:15/)).toBeInTheDocument()
    // No debe prefijar mes en una sesión de hoy.
    expect(screen.queryByText(/Desde\s+\d+\s+\w+\s+·\s+09:15/)).not.toBeInTheDocument()
  })

  it('prefija fecha corta cuando la sesión NO abrió hoy (una de hace semanas no parece de hoy)', () => {
    renderView({ session: OLD_SESSION })
    // 2026-05-04 09:15 UTC = 03:15 local → "Desde 4 may · 03:15".
    expect(screen.getByText(/Desde\s+4\s+may\s+·\s+03:15/i)).toBeInTheDocument()
  })

  it('muestra el fondo inicial real que recibe (no un placeholder)', () => {
    renderView({ fondoCents: 73500 })
    expect(screen.getByText(/fondo \$735/i)).toBeInTheDocument()
  })

  it('shows the three totals cards with formatted amounts', () => {
    renderView()
    expect(amountOf('Efectivo esperado')).toHaveTextContent('$1,840')
    expect(amountOf('Tarjeta')).toHaveTextContent('$2,540')
    expect(amountOf('Stripe')).toHaveTextContent('$1,260')
  })

  it('primera carga: las tres cifras son esqueleto, sin un solo dígito ni "$"', () => {
    // status="loading" + session=null es "aún no sé" ([D-020]): un $0 aquí
    // haría creer al cajero que la caja no ha movido nada.
    renderView({ session: null, fondoCents: null, status: 'loading' })
    for (const label of EXPECTED_LABELS) {
      const amount = amountOf(label)
      expect(amount).not.toHaveTextContent(/\d/)
      expect(amount.textContent).not.toContain('$')
      expect(amount).toHaveAttribute('aria-busy', 'true')
    }
  })

  it('sin sesión no inventa hora de apertura ni fondo: esa línea también es esqueleto', () => {
    renderView({ session: null, fondoCents: null, status: 'loading' })
    expect(screen.queryByText(/Desde/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/fondo/i)).not.toBeInTheDocument()
    // El banner y el CTA no dependen del dato: siguen ahí.
    expect(screen.getByText(/caja abierta/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cerrar caja/i })).toBeInTheDocument()
  })

  it('error: aviso en vez de la cifra anterior (jamás el monto de la carga previa)', () => {
    // La sesión sigue en props, pero el status manda: un fallo no puede dejar
    // los esperados de antes como si fueran los de ahora ([D-018]).
    renderView({ status: 'error' })
    for (const label of EXPECTED_LABELS) {
      const amount = amountOf(label)
      expect(within(amount).getByText(/no se pudo cargar/i)).toBeInTheDocument()
      expect(amount).not.toHaveTextContent(/\d/)
    }
    expect(screen.queryByText('$1,840')).not.toBeInTheDocument()
  })

  it('sin conexión: guion y aviso, nunca la última cifra como si fuera actual', () => {
    renderView({ status: 'offline' })
    const amount = amountOf('Efectivo esperado')
    expect(within(amount).getByText(/sin conexión/i)).toBeInTheDocument()
    expect(amount).not.toHaveTextContent(/\d/)
  })

  it('un 0 REAL del servidor sí se pinta como $0 (no es un esqueleto)', () => {
    const empty: RegisterSession = { ...TODAY_SESSION, expectedCashCents: 0 }
    renderView({ session: empty, status: 'fresh' })
    const amount = amountOf('Efectivo esperado')
    expect(amount).toHaveTextContent('$0')
    // "Vigente" no está ocupado: el 0 es información, no una carga en curso.
    expect(amount).not.toHaveAttribute('aria-busy')
  })

  it('oculta la sección VENTAS DE HOY cuando no hay ventas (ledger sin cablear)', () => {
    // Con todayTransactions=[] la sección entera se oculta — mostrar
    // "Sin ventas todavía" hardcodeado sería una mentira permanente.
    renderView()
    expect(screen.queryByText(/ventas de hoy/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sin ventas todavía/i)).not.toBeInTheDocument()
  })

  it('renders transaction rows when sales exist', () => {
    const txs: SaleLedgerEntry[] = [
      {
        id: 's1',
        createdAt: '2026-05-04T16:18:00.000Z',
        totalCents: 28000,
        paymentStatus: 'PAID',
        customer: { fullName: 'Carlos Méndez' },
        appointmentId: null,
        walkInId: 'w1',
      },
    ]
    renderView({ todayTransactions: txs })
    // Con ventas reales, la sección sí aparece.
    expect(screen.getByText(/ventas de hoy/i)).toBeInTheDocument()
    expect(screen.getByText(/carlos méndez/i)).toBeInTheDocument()
    expect(screen.getByText('$280')).toBeInTheDocument()
  })

  it('calls onCerrar when CERRAR CAJA button tapped', async () => {
    const onCerrar = vi.fn()
    const user = userEvent.setup()
    renderView({ onCerrar })
    await user.click(screen.getByRole('button', { name: /cerrar caja/i }))
    expect(onCerrar).toHaveBeenCalledTimes(1)
  })
})
