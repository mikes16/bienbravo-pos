import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AddWalkInSheet } from './AddWalkInSheet'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'
import { CustomerNameTakenException } from '@/shared/lib/customer-errors'
import type { PosViewer } from '@/core/auth/auth.types'
import type { WalkIn } from '../domain/walkins.types'

// Espiamos `addToast` mockeando el hook: el ToastViewport no se renderiza en el
// harness de pruebas (solo el ToastProvider), así que el tono/texto del toast
// no llega al DOM. Mockear el hook nos da un spy directo sobre (mensaje, tono).
const { addToastMock } = vi.hoisted(() => ({ addToastMock: vi.fn() }))
vi.mock('@/core/toast/useToast', () => ({
  useToast: () => ({ addToast: addToastMock, toasts: [], removeToast: vi.fn() }),
}))

// Teléfono es PII gateado por `customers.phone.view`. MOCK_VIEWER NO lo trae,
// así que lo usamos tal cual para el operador sin permiso y una variante con el
// permiso para el operador que sí puede ver/capturar teléfono.
const VIEWER_WITH_PHONE: PosViewer = {
  ...MOCK_VIEWER,
  permissions: [...MOCK_VIEWER.permissions, 'customers.phone.view'],
}
const VIEWER_NO_PHONE: PosViewer = MOCK_VIEWER

// Auth repo de prueba que hidrata el viewer de forma SÍNCRONA (getCachedViewer),
// igual que en producción (viewer cacheado al boot). Así el gateo de teléfono es
// determinista desde el primer render y no depende de que resuelva un effect.
class TestAuthRepo extends InMemoryAuthRepository {
  #v: PosViewer
  constructor(v: PosViewer) {
    super()
    this.#v = v
  }
  override getCachedViewer(): PosViewer | null {
    return this.#v
  }
  override async getViewer(): Promise<PosViewer | null> {
    return this.#v
  }
}

// Catálogo categorizado por defecto para el sheet. El picker ahora se alinea 1:1
// con el cobro: onlyCategorized (sin categoría = no existe) + tabs por categoría
// en orden de sortOrder. Sin categorías/categoryId no habría nada que mostrar.
const CAT_CORTES = { id: 'cat-cortes', name: 'Cortes', slug: 'cortes', sortOrder: 1, appliesTo: 'SERVICE' }
const CAT_BARBA = { id: 'cat-barba', name: 'Barba', slug: 'barba', sortOrder: 2, appliesTo: 'SERVICE' }

function makeRepos(viewer: PosViewer = VIEWER_WITH_PHONE) {
  const repos = createMockRepositories({ auth: new TestAuthRepo(viewer) })
  repos.checkout.getCategories = vi.fn().mockResolvedValue([CAT_CORTES, CAT_BARBA])
  repos.checkout.getServices = vi.fn().mockResolvedValue([
    { id: 'svc-1', name: 'Corte Clásico', priceCents: 35000, durationMin: 30, isAddOn: false, imageUrl: null, categoryId: 'cat-cortes', sortOrder: 0, extras: [], excludedStaffIds: [] },
    // Add-on: el picker lo filtra (los add-ons son upsells, no razón de visita).
    { id: 'svc-2', name: 'Barba', priceCents: 15000, durationMin: 15, isAddOn: true, imageUrl: null, categoryId: 'cat-barba', sortOrder: 0, extras: [], excludedStaffIds: [] },
  ])
  repos.checkout.getCombos = vi.fn().mockResolvedValue([])
  return repos
}

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

function setup(viewer: PosViewer = VIEWER_WITH_PHONE) {
  const repos = makeRepos(viewer)
  const onClose = vi.fn()
  const onCreated = vi.fn()
  renderWithProviders(<AddWalkInSheet open locationId="loc-1" onClose={onClose} onCreated={onCreated} />, { repos })
  return { repos, onClose, onCreated }
}

// Servicio del catálogo mock por defecto (makeRepos): 'Corte Clásico' (svc-1, no
// add-on, categoría Cortes). Esperar a que aparezca confirma que el Promise.all
// inicial (barbers + services + combos + categories) resolvió.
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

  // ── Teléfono gateado por permiso (customers.phone.view) ──────────────────

  it('sin customers.phone.view no renderiza el campo Teléfono y el buscador dice "Nombre…"', async () => {
    setup(VIEWER_NO_PHONE)

    // Confirmamos que el catálogo (y por tanto el viewer) ya montó.
    await screen.findByRole('button', { name: /corte clásico/i })

    expect(screen.getByPlaceholderText('Nombre…')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Nombre o teléfono…')).not.toBeInTheDocument()
    // El campo "Teléfono · opcional" desaparece por completo.
    expect(screen.queryByText(/Teléfono · opcional/i)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('55 1234 5678')).not.toBeInTheDocument()
  })

  it('sin customers.phone.view el submit manda el walk-in sin teléfono', async () => {
    const user = userEvent.setup()
    const { repos } = setup(VIEWER_NO_PHONE)
    repos.walkins.create = vi.fn().mockResolvedValue(baseWalkIn({ customerName: 'Luis' }))

    await selectFirstService(user)
    // El operador teclea un teléfono en el buscador de nombre — el server igual
    // matchea, pero nosotros no lo capturamos.
    await user.type(screen.getByPlaceholderText('Nombre…'), 'Luis')
    await user.click(screen.getByRole('button', { name: /agregar a cola/i }))

    expect(repos.walkins.create).toHaveBeenCalledWith(
      expect.objectContaining({ customerName: 'Luis', customerPhone: null }),
    )
  })

  it('con customers.phone.view sí renderiza el campo Teléfono', async () => {
    setup(VIEWER_WITH_PHONE)
    await screen.findByRole('button', { name: /corte clásico/i })
    expect(screen.getByPlaceholderText('Nombre o teléfono…')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('55 1234 5678')).toBeInTheDocument()
  })

  // ── Picker alineado con el catálogo del cobro ────────────────────────────

  it('el picker muestra solo servicios y combos, sin tab "Todo", en el orden del cobro', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.checkout.getServices = vi.fn().mockResolvedValue([
      { id: 'svc-fade', name: 'Fade', priceCents: 30000, durationMin: 30, isAddOn: false, imageUrl: null, categoryId: 'cat-cortes', sortOrder: 1, extras: [], excludedStaffIds: [] },
      { id: 'svc-barba', name: 'Perfilado', priceCents: 12000, durationMin: 15, isAddOn: false, imageUrl: null, categoryId: 'cat-barba', sortOrder: 0, extras: [], excludedStaffIds: [] },
    ])
    repos.checkout.getCombos = vi.fn().mockResolvedValue([
      { id: 'combo-1', name: 'Combo Doble', priceCents: 40000, imageUrl: null, effectiveCategoryIds: ['cat-cortes'], categoryId: 'cat-cortes', sortOrder: 0, items: [], excludedStaffIds: [] },
    ])
    renderWithProviders(<AddWalkInSheet open locationId="loc-1" onClose={vi.fn()} onCreated={vi.fn()} />, { repos })

    // Arranca en la primera categoría real (Cortes, sortOrder 1 < Barba 2). Sin
    // tab "Todo".
    await screen.findByRole('button', { name: /combo doble/i })
    expect(screen.queryByRole('button', { name: /^todo$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^cortes$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^barba$/i })).toBeInTheDocument()

    // Dentro de Cortes: combo (sortOrder 0) antes que servicio (sortOrder 1),
    // intercalados por orden — no en secciones separadas por tipo.
    const buttons = screen.getAllByRole('button')
    const texts = buttons.map((b) => b.textContent ?? '')
    const idxCombo = texts.findIndex((t) => t.includes('Combo Doble'))
    const idxFade = texts.findIndex((t) => t.includes('Fade'))
    expect(idxCombo).toBeGreaterThanOrEqual(0)
    expect(idxFade).toBeGreaterThan(idxCombo)

    // El servicio de otra categoría no aparece hasta cambiar de tab.
    expect(screen.queryByRole('button', { name: /perfilado/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^barba$/i }))
    expect(await screen.findByRole('button', { name: /perfilado/i })).toBeInTheDocument()
    // Fade (Cortes) ya no está en la vista de Barba.
    expect(screen.queryByRole('button', { name: /fade/i })).not.toBeInTheDocument()
  })

  it('el picker omite los add-ons (upsells, no razón de visita)', async () => {
    // makeRepos define svc-2 "Barba" como add-on → nunca debe aparecer como card.
    setup()
    await screen.findByRole('button', { name: /corte clásico/i })
    // El tab "Barba" tampoco existe: su única entrada es un add-on filtrado, así
    // que la categoría queda vacía y no genera chip.
    expect(screen.queryByRole('button', { name: /^barba$/i })).not.toBeInTheDocument()
  })

  // ── Exclusión por barbero (igual que el grid del cobro) ──────────────────

  it('al elegir barbero preferido oculta los servicios que ese barbero no ofrece', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.checkout.getServices = vi.fn().mockResolvedValue([
      { id: 'svc-degradado', name: 'Degradado', priceCents: 30000, durationMin: 30, isAddOn: false, imageUrl: null, categoryId: 'cat-cortes', sortOrder: 0, extras: [], excludedStaffIds: [] },
      // Carlos (staff-1) NO ofrece Tinte.
      { id: 'svc-tinte', name: 'Tinte', priceCents: 50000, durationMin: 45, isAddOn: false, imageUrl: null, categoryId: 'cat-cortes', sortOrder: 1, extras: [], excludedStaffIds: ['staff-1'] },
    ])
    repos.checkout.getCombos = vi.fn().mockResolvedValue([])
    repos.checkout.getAvailableBarbers = vi.fn().mockResolvedValue([
      { id: 'staff-1', fullName: 'Carlos', photoUrl: null, hasClockedIn: true, isOccupied: false },
      { id: 'staff-2', fullName: 'Antonio', photoUrl: null, hasClockedIn: true, isOccupied: false },
    ])
    renderWithProviders(<AddWalkInSheet open locationId="loc-1" onClose={vi.fn()} onCreated={vi.fn()} />, { repos })

    // Sin barbero preferido, ambos servicios visibles.
    expect(await screen.findByRole('button', { name: /degradado/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tinte/i })).toBeInTheDocument()

    // Elegir a Carlos como preferido (modo cola: "Espera a") oculta Tinte.
    await user.click(screen.getByRole('button', { name: /carlos/i }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /tinte/i })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /degradado/i })).toBeInTheDocument()
  })

  it('viceversa: al elegir un servicio, oculta del selector a los barberos que no lo ofrecen', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.checkout.getServices = vi.fn().mockResolvedValue([
      // Carlos (staff-1) NO ofrece Tinte; Antonio (staff-2) sí.
      { id: 'svc-tinte', name: 'Tinte', priceCents: 50000, durationMin: 45, isAddOn: false, imageUrl: null, categoryId: 'cat-cortes', sortOrder: 0, extras: [], excludedStaffIds: ['staff-1'] },
    ])
    repos.checkout.getCombos = vi.fn().mockResolvedValue([])
    repos.checkout.getAvailableBarbers = vi.fn().mockResolvedValue([
      { id: 'staff-1', fullName: 'Carlos', photoUrl: null, hasClockedIn: true, isOccupied: false },
      { id: 'staff-2', fullName: 'Antonio', photoUrl: null, hasClockedIn: true, isOccupied: false },
    ])
    renderWithProviders(<AddWalkInSheet open locationId="loc-1" onClose={vi.fn()} onCreated={vi.fn()} />, { repos })

    // Ambos barberos visibles antes de elegir servicio.
    expect(await screen.findByRole('button', { name: /carlos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /antonio/i })).toBeInTheDocument()

    // Elegir Tinte oculta a Carlos del selector (no lo ofrece); Antonio queda.
    await user.click(screen.getByRole('button', { name: /tinte/i }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /carlos/i })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /antonio/i })).toBeInTheDocument()
  })

  // Overrides de duración por barbero: pricingFor resuelve barbero > sucursal
  // > base. El sheet debe re-resolver el catálogo con el barbero seleccionado
  // — un corte de 45 min base puede ser de 35 con el override de Javi — y
  // volver a la resolución por sucursal al regresar a "Sin preferencia".
  it('re-resolves service durations with the selected barber and falls back to sucursal on "Sin preferencia"', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.checkout.getServices = vi.fn(async (_locationId: string, staffUserId?: string | null) => [
      {
        id: 'svc-1',
        name: 'Corte Clásico',
        priceCents: 35000,
        // staff-1 (Carlos) tiene override de duración; sin barbero, sucursal/base.
        durationMin: staffUserId === 'staff-1' ? 35 : 45,
        isAddOn: false,
        imageUrl: null,
        categoryId: 'cat-cortes',
        sortOrder: 0,
        extras: [],
        excludedStaffIds: [],
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
    const repos = makeRepos()
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
    const repos = makeRepos()
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
    const repos = makeRepos()
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
