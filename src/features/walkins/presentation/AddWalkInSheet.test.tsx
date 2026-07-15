import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AddWalkInSheet } from './AddWalkInSheet'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories } from '@/test/mocks/repositories'
import { CustomerNameTakenException } from '@/shared/lib/customer-errors'
import type { WalkIn } from '../domain/walkins.types'

// Espiamos `addToast` mockeando el hook: el ToastViewport no se renderiza en el
// harness de pruebas (solo el ToastProvider), así que el tono/texto del toast
// no llega al DOM. Mockear el hook nos da un spy directo sobre (mensaje, tono).
const { addToastMock } = vi.hoisted(() => ({ addToastMock: vi.fn() }))
vi.mock('@/core/toast/useToast', () => ({
  useToast: () => ({ addToast: addToastMock, toasts: [], removeToast: vi.fn() }),
}))

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

  // Overrides de duración por barbero: pricingFor resuelve barbero > sucursal
  // > base. El sheet debe re-resolver el catálogo con el barbero seleccionado
  // — un corte de 45 min base puede ser de 35 con el override de Javi — y
  // volver a la resolución por sucursal al regresar a "Sin preferencia".
  it('re-resolves service durations with the selected barber and falls back to sucursal on "Sin preferencia"', async () => {
    const user = userEvent.setup()
    const repos = createMockRepositories()
    repos.checkout.getServices = vi.fn(async (_locationId: string, staffUserId?: string | null) => [
      {
        id: 'svc-1',
        name: 'Corte Clásico',
        priceCents: 35000,
        // staff-1 (Carlos) tiene override de duración; sin barbero, sucursal/base.
        durationMin: staffUserId === 'staff-1' ? 35 : 45,
        isAddOn: false,
        imageUrl: null,
        categoryId: null,
        sortOrder: 0,
        extras: [],
      },
    ])
    renderWithProviders(<AddWalkInSheet open locationId="loc-1" onClose={vi.fn()} onCreated={vi.fn()} />, { repos })

    expect(await screen.findByText('45 min')).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /carlos/i }))
    expect(await screen.findByText('35 min')).toBeInTheDocument()
    expect(repos.checkout.getServices).toHaveBeenLastCalledWith('loc-1', 'staff-1')

    await user.click(screen.getByRole('button', { name: /sin preferencia/i }))
    expect(await screen.findByText('45 min')).toBeInTheDocument()
  })

  // "Atiende ya" honesto — bug de prod: el operador ya en servicio se elegía a
  // sí mismo, el API rechazaba el assign y el sheet cerraba como éxito con el
  // cliente aún en cola. Los tres tests cubren las tres defensas.

  it('cambiar a "Atiende ya" limpia la selección si el barbero está ocupado', async () => {
    const user = userEvent.setup()
    const repos = createMockRepositories()
    repos.checkout.getAvailableBarbers = vi.fn().mockResolvedValue([
      { id: 'staff-9', fullName: 'Beto Ocupado', photoUrl: null, hasClockedIn: true, isOccupied: true },
    ])
    renderWithProviders(<AddWalkInSheet open locationId="loc-1" onClose={vi.fn()} onCreated={vi.fn()} />, { repos })

    // En cola, un ocupado ES elegible como preferencia (el cliente puede esperar).
    await user.click(await screen.findByRole('button', { name: /beto/i }))
    expect(screen.getByRole('button', { name: /espera a beto/i })).toBeInTheDocument()

    // Al pasar a "Atiende ya" el ocupado deja de ser elegible → se suelta.
    await user.click(screen.getByRole('button', { name: /con un barbero libre/i }))

    // Sin selección: la CTA vuelve a exigir elegir barbero.
    expect(await screen.findByRole('button', { name: /elige un barbero para empezar/i })).toBeInTheDocument()
  })

  it('submit en "Atiende ya" con barbero ocupado muestra error y no crea nada', async () => {
    const user = userEvent.setup()
    const repos = createMockRepositories()
    // Libre al abrir; el refetch al cambiar a "Atiende ya" lo revela ocupado
    // (otra tablet lo puso en servicio mientras tanto). La selección libre
    // sobrevive el cambio de modo y el guard la caza en el submit.
    repos.checkout.getAvailableBarbers = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'staff-1', fullName: 'Carlos Libre', photoUrl: null, hasClockedIn: true, isOccupied: false }])
      .mockResolvedValue([{ id: 'staff-1', fullName: 'Carlos Libre', photoUrl: null, hasClockedIn: true, isOccupied: true }])
    const createSpy = vi.fn()
    repos.walkins.create = createSpy
    renderWithProviders(<AddWalkInSheet open locationId="loc-1" onClose={vi.fn()} onCreated={vi.fn()} />, { repos })

    await selectFirstService(user)
    await user.type(screen.getByPlaceholderText('Nombre o teléfono…'), 'Luis')
    await user.click(await screen.findByRole('button', { name: /carlos/i }))
    await user.click(screen.getByRole('button', { name: /con un barbero libre/i }))

    // El refetch actualiza el hint del barbero de "libre" a "ocupado".
    expect(await screen.findByText('ocupado')).toBeInTheDocument()

    // La CTA sigue habilitada (hay selección) pero el submit debe abortar.
    await user.click(screen.getByRole('button', { name: /atiende ya con carlos/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/está ocupado/i)
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('si el assign falla, el toast dice EN COLA con el motivo del API y onCreated sí se llama', async () => {
    const user = userEvent.setup()
    const repos = createMockRepositories()
    repos.checkout.getAvailableBarbers = vi.fn().mockResolvedValue([
      { id: 'staff-1', fullName: 'Carlos Libre', photoUrl: null, hasClockedIn: true, isOccupied: false },
    ])
    repos.walkins.create = vi.fn().mockResolvedValue(baseWalkIn({ id: 'wi-9', customerName: 'Luis' }))
    repos.walkins.assign = vi.fn().mockRejectedValue(new Error('El barbero ya tiene un servicio en curso.'))
    const onCreated = vi.fn()
    renderWithProviders(<AddWalkInSheet open locationId="loc-1" onClose={vi.fn()} onCreated={onCreated} />, { repos })

    addToastMock.mockClear()

    await selectFirstService(user)
    await user.type(screen.getByPlaceholderText('Nombre o teléfono…'), 'Luis')
    await user.click(screen.getByRole('button', { name: /con un barbero libre/i }))
    await user.click(await screen.findByRole('button', { name: /carlos/i }))
    await user.click(screen.getByRole('button', { name: /atiende ya con carlos/i }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
    expect(repos.walkins.assign).toHaveBeenCalledWith('wi-9', 'staff-1')
    // Tono error + "quedó EN COLA" + el motivo tal cual lo devolvió el API.
    expect(addToastMock).toHaveBeenCalledWith(expect.stringContaining('quedó EN COLA'), 'error')
    expect(addToastMock).toHaveBeenCalledWith(
      expect.stringContaining('El barbero ya tiene un servicio en curso.'),
      'error',
    )
  })
})
