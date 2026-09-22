import type { ComponentProps } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { StaffSaleBar } from './StaffSaleBar'
import type { QuotaTopeView, StaffQuotaView } from '../lib/staff-sale'

/**
 * Barra de venta a staff (spec §4.5). La barra NO decide: sólo pinta lo que
 * `useCheckout().staffSale` le pasa. Lo que se prueba aquí es que no se ofrezca
 * sin permiso, que no se encienda sola con la política apagada ([D-055]) y que
 * nunca muestre una cifra de cupo que no sea vigente.
 */

type StaffSaleState = ComponentProps<typeof StaffSaleBar>['staffSale']

const BARBERS = [
  { id: 'b1', fullName: 'Antonio', photoUrl: null },
  { id: 'b2', fullName: 'Beto', photoUrl: null },
]

function tope(over: Partial<QuotaTopeView> = {}): QuotaTopeView {
  return { used: 0, inCart: 0, limit: null, remaining: null, exceeded: false, ...over }
}

function quota(units: QuotaTopeView, listAmountCents: QuotaTopeView): StaffQuotaView {
  return {
    units,
    listAmountCents,
    perProduct: [],
    exceeded: units.exceeded || listAmountCents.exceeded,
  }
}

function makeState(over: Partial<StaffSaleState> = {}): StaffSaleState {
  return {
    available: true,
    canSellForOthers: false,
    enabled: false,
    buyerStaffUserId: 'b2',
    loading: false,
    error: null,
    quotaView: null,
    blockMessage: null,
    ...over,
  }
}

function renderBar(over: Partial<StaffSaleState> = {}) {
  const onToggle = vi.fn()
  const onSelectBuyer = vi.fn()
  render(
    <StaffSaleBar
      staffSale={makeState(over)}
      barbers={BARBERS}
      onToggle={onToggle}
      onSelectBuyer={onSelectBuyer}
    />,
  )
  return { onToggle, onSelectBuyer }
}

describe('StaffSaleBar', () => {
  /* ── Visibilidad ── */

  it('sin pos.staff_sale.* no se renderiza nada: el cobro se ve como siempre', () => {
    renderBar({ available: false, enabled: true, blockMessage: 'Se pasó un tope' })
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByText(/venta a staff/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/se pasó un tope/i)).not.toBeInTheDocument()
  })

  it('apagado: sólo el interruptor — ni franja, ni comprador, ni cupo', () => {
    renderBar({ quotaView: quota(tope({ limit: 6 }), tope({ limit: 120000 })) })
    expect(screen.getByRole('switch', { name: /venta a staff/i })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByText(/compra:/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Cupo del mes' })).not.toBeInTheDocument()
  })

  it('con la política apagada el interruptor se queda apagado y canta el motivo', () => {
    // [D-055]: encender es asíncrono y pide el cupo primero; si la política
    // viene apagada el modo NO se activa y el hook deja el motivo en `error`.
    renderBar({ enabled: false, error: 'La venta a staff está desactivada.' })
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('alert')).toHaveTextContent('La venta a staff está desactivada.')
    expect(screen.queryByText(/compra:/i)).not.toBeInTheDocument()
  })

  it('el interruptor sólo PIDE el cambio: quien decide es el hook', async () => {
    const user = userEvent.setup()
    const { onToggle } = renderBar()
    await user.click(screen.getByRole('switch'))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('encendido, el interruptor apaga', async () => {
    const user = userEvent.setup()
    const { onToggle } = renderBar({ enabled: true })
    await user.click(screen.getByRole('switch'))
    expect(onToggle).toHaveBeenCalledWith(false)
  })

  /* ── Comprador ── */

  it('encendido: franja de aviso y el comprador con su nombre del roster', () => {
    renderBar({ enabled: true, buyerStaffUserId: 'b2' })
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    // La franja rotula el modo para que nadie cobre a precio staff por error.
    expect(screen.getByRole('heading', { name: /venta a staff/i })).toBeInTheDocument()
    expect(screen.getByText(/compra: beto/i)).toBeInTheDocument()
  })

  it('un comprador que no está en el roster no se inventa un nombre', () => {
    renderBar({ enabled: true, buyerStaffUserId: 'quien-sabe' })
    expect(screen.getByText(/compra: sin identificar/i)).toBeInTheDocument()
  })

  it('sin create_for_others no hay botón para cambiar de comprador', () => {
    renderBar({ enabled: true, canSellForOthers: false })
    expect(screen.queryByRole('button', { name: /cambiar/i })).not.toBeInTheDocument()
  })

  it('con create_for_others, Cambiar abre el selector y elige al comprador', async () => {
    const user = userEvent.setup()
    const { onSelectBuyer } = renderBar({ enabled: true, canSellForOthers: true })
    await user.click(screen.getByRole('button', { name: /cambiar/i }))
    const sheet = await screen.findByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: /antonio/i }))
    expect(onSelectBuyer).toHaveBeenCalledWith('b1')
  })

  /* ── Cupo del mes ── */

  it('con tope: unidades del mes más las del carrito, y el valor con MoneyValue', () => {
    renderBar({
      enabled: true,
      quotaView: quota(
        tope({ used: 3, inCart: 1, limit: 6, remaining: 2 }),
        tope({ used: 45000, inCart: 10000, limit: 120000, remaining: 65000 }),
      ),
    })
    expect(screen.getByText(/productos: 4 de 6/i)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Valor usado este mes' })).toHaveTextContent('$550')
    expect(screen.getByRole('group', { name: 'Tope de valor del mes' })).toHaveTextContent('$1,200')
  })

  it('sin tope: lo dice con todas sus letras, sin inventar un límite', () => {
    renderBar({ enabled: true, quotaView: quota(tope({ used: 4 }), tope({ used: 90000 })) })
    expect(screen.getByText(/sin tope este mes/i)).toBeInTheDocument()
    expect(screen.queryByText(/productos:/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Valor usado este mes' })).not.toBeInTheDocument()
  })

  it('tope rebasado: el motivo que bloquea el cobro se ve en la barra', () => {
    renderBar({
      enabled: true,
      quotaView: quota(
        tope({ used: 5, inCart: 2, limit: 6, remaining: -1, exceeded: true }),
        tope({ limit: 120000, remaining: 120000 }),
      ),
      blockMessage: 'Llevas 7 de 6 productos este mes',
    })
    expect(screen.getByText('Llevas 7 de 6 productos este mes')).toBeInTheDocument()
  })

  it('cargando: ni un dígito del cupo anterior y el interruptor no acepta toques', () => {
    // El cupo en memoria es el del comprador ANTERIOR mientras el nuevo viaja:
    // mostrarlo sería afirmar un tope que no es el de esta compra.
    renderBar({
      enabled: true,
      loading: true,
      quotaView: quota(
        tope({ used: 3, inCart: 1, limit: 6, remaining: 2 }),
        tope({ used: 45000, inCart: 10000, limit: 120000, remaining: 65000 }),
      ),
    })
    const group = screen.getByRole('group', { name: 'Cupo del mes' })
    expect(group).not.toHaveTextContent(/\d/)
    expect(screen.getByRole('group', { name: 'Valor usado este mes' })).not.toHaveTextContent(/\d/)
    expect(screen.getByRole('group', { name: 'Tope de valor del mes' })).not.toHaveTextContent(/\d/)
    expect(screen.getByRole('switch')).toBeDisabled()
  })
})
