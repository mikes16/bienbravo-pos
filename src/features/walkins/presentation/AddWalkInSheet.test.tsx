import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AddWalkInSheet } from './AddWalkInSheet'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories } from '@/test/mocks/repositories'
import { CustomerNameTakenException } from '@/shared/lib/customer-errors'
import type { WalkIn } from '../domain/walkins.types'

function baseWalkIn(overrides: Partial<WalkIn> = {}): WalkIn {
  return {
    id: 'wi-1',
    status: 'PENDING',
    customerName: null,
    customerPhone: null,
    customerEmail: null,
    createdAt: new Date().toISOString(),
    sortOrder: 1,
    assignedStaffUser: null,
    customer: null,
    ...overrides,
  }
}

function setup() {
  const repos = createMockRepositories()
  const onClose = vi.fn()
  const onCreated = vi.fn()
  renderWithProviders(<AddWalkInSheet open locationId="loc-1" onClose={onClose} onCreated={onCreated} />, { repos })
  return { repos, onClose, onCreated }
}

// Servicio del catálogo mock por defecto (InMemoryCheckoutRepository.getServices):
// 'Corte Clásico' (svc-1, no add-on). Esperar a que aparezca confirma que el
// Promise.all inicial (barbers + services + combos + categories) resolvió.
async function selectFirstService(user: ReturnType<typeof userEvent.setup>) {
  const card = await screen.findByRole('button', { name: /corte clásico/i })
  await user.click(card)
}

describe('AddWalkInSheet', () => {
  it('submits with name only — phone is optional, matching the "Teléfono · opcional" label', async () => {
    const user = userEvent.setup()
    const { repos, onCreated } = setup()
    repos.walkins.create = vi.fn().mockResolvedValue(baseWalkIn({ customerName: 'Juan Pérez' }))

    await selectFirstService(user)
    await user.type(screen.getByPlaceholderText('Nombre o teléfono…'), 'Juan Pérez')
    await user.click(screen.getByRole('button', { name: /agregar a cola/i }))

    expect(repos.walkins.create).toHaveBeenCalledWith(
      expect.objectContaining({
        locationId: 'loc-1',
        customerId: null,
        customerName: 'Juan Pérez',
        customerPhone: null,
      }),
    )
    expect(onCreated).toHaveBeenCalledTimes(1)
  })

  it('links a customer from search results and sends customerId instead of re-typing the name', async () => {
    const user = userEvent.setup()
    const { repos } = setup()
    repos.checkout.searchCustomers = vi.fn().mockResolvedValue([
      { id: 'cust-42', fullName: 'Ana López', email: null, phone: '+528111111111' },
    ])
    repos.walkins.create = vi.fn().mockResolvedValue(baseWalkIn({ id: 'wi-2' }))

    await selectFirstService(user)
    await user.type(screen.getByPlaceholderText('Nombre o teléfono…'), 'Ana')
    const result = await screen.findByRole('button', { name: /ana lópez/i })
    await user.click(result)
    // Linking swaps the free-text input for the selected-customer card.
    expect(screen.getByText('+528111111111')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /agregar a cola/i }))

    expect(repos.walkins.create).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cust-42', customerName: 'Ana López' }),
    )
  })

  it('surfaces the server CUSTOMER_NAME_TAKEN message instead of a generic error', async () => {
    const user = userEvent.setup()
    const { repos } = setup()
    const message = 'Ya existe un cliente llamado "Juan Pérez". Usa el existente o escribe un nombre que lo distinga.'
    repos.walkins.create = vi.fn().mockRejectedValue(new CustomerNameTakenException(message, null))

    await selectFirstService(user)
    await user.type(screen.getByPlaceholderText('Nombre o teléfono…'), 'Juan Pérez')
    await user.click(screen.getByRole('button', { name: /agregar a cola/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })

  it('auto-links the existing customer on a CUSTOMER_NAME_TAKEN race so the operator can just retry', async () => {
    const user = userEvent.setup()
    const { repos } = setup()
    repos.walkins.create = vi
      .fn()
      .mockRejectedValueOnce(new CustomerNameTakenException('Ya existe un cliente llamado "Juan Pérez".', 'cust-existing'))
    repos.checkout.getCustomer = vi.fn().mockResolvedValue({
      id: 'cust-existing',
      fullName: 'Juan Pérez',
      email: null,
      phone: '+528111112222',
    })

    await selectFirstService(user)
    await user.type(screen.getByPlaceholderText('Nombre o teléfono…'), 'Juan Pérez')
    await user.click(screen.getByRole('button', { name: /agregar a cola/i }))

    await screen.findByRole('alert')
    // The "Cliente" section now shows the linked existing customer (phone +
    // "Quitar" only render when selectedCustomer is set) — retrying submit
    // would send customerId this time, which can't collide again.
    expect(await screen.findByText('+528111112222')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /quitar/i })).toBeInTheDocument()
  })
})
