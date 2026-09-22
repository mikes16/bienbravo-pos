import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DaySaleSheet } from './DaySaleSheet'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import type { DaySale } from '../domain/day-sales.types'

function sale(over: Partial<DaySale> & { id: string; status: DaySale['status'] }): DaySale {
  return {
    createdAt: new Date().toISOString(),
    subtotalCents: 10000,
    taxTotalCents: 0,
    totalCents: 10000,
    tipCents: 0,
    customer: { id: 'c1', fullName: 'Pedro Multi' },
    sellerStaffUserId: null,
    items: [{ id: 'i1', name: 'Corte', qty: 1, unitPriceCents: 10000, totalCents: 10000, staffUser: null }],
    payments: [{ provider: 'CASH', amountCents: 10000 }],
    discounts: [],
    barbers: [],
    ...over,
  }
}

const PAID = sale({ id: 's-paid', status: 'PAID' })
const VOIDED = sale({ id: 's-void', status: 'VOID' })

describe('DaySaleSheet', () => {
  it('opens with the sale ticket', async () => {
    renderWithProviders(<DaySaleSheet sale={PAID} onClose={vi.fn()} onReprint={vi.fn()} />)
    const dialog = await screen.findByRole('dialog', { name: /ticket de venta/i })
    expect(within(dialog).getByText('Pedro Multi')).toBeInTheDocument()
    expect(within(dialog).getByText('Corte')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderWithProviders(<DaySaleSheet sale={PAID} onClose={onClose} onReprint={vi.fn()} />)
    await screen.findByRole('dialog', { name: /ticket de venta/i })
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('disables reprint for a voided sale', async () => {
    renderWithProviders(<DaySaleSheet sale={VOIDED} onClose={vi.fn()} onReprint={vi.fn()} />)
    const dialog = await screen.findByRole('dialog', { name: /ticket de venta/i })
    expect(within(dialog).getByRole('button', { name: /reimprimir ticket/i })).toBeDisabled()
  })
})
