import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CheckoutPage } from './CheckoutPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { CatalogVersionContext } from '@/core/bootstrap/BootstrapProvider'
import { CheckoutRejectedError, type StaffSaleRejectionCode } from '../domain/checkout.types'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() { return MOCK_VIEWER }
}

const SVC_CORTE = { id: 'svc-corte', name: 'Corte', priceCents: 28000, durationMin: 30, isAddOn: false, imageUrl: null, categoryId: 'cat-cortes', sortOrder: 0, extras: [], excludedStaffIds: [] }
const PROD_SHAMPOO = { id: 'prod-shampoo', name: 'Shampoo', priceCents: 25000, sku: null, imageUrl: null, categoryId: 'cat-prod' }
const BARBERS = [
  { id: 'b1', fullName: 'Antonio', photoUrl: null },
  { id: 'b2', fullName: 'Beto', photoUrl: null },
  { id: 'b3', fullName: 'Carlos', photoUrl: null },
]
const SESSION = {
  id: 'sess-1', status: 'OPEN' as const, openedAt: '2026-05-04T09:15:00.000Z', closedAt: null,
  expectedCashCents: 0, expectedCardCents: 0, expectedTransferCents: 0,
  countedCashCents: null, countedCardCents: null, countedTransferCents: null,
}
const REGISTER = { id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1', openSession: SESSION }
const MOSTRADOR = { id: 'cust-mostrador', fullName: 'Mostrador' }

function makeRepos() {
  const repos = createMockRepositories()
  repos.checkout.getServices = vi.fn().mockResolvedValue([SVC_CORTE])
  repos.checkout.getProducts = vi.fn().mockResolvedValue([PROD_SHAMPOO])
  repos.checkout.getCombos = vi.fn().mockResolvedValue([])
  repos.checkout.getCategories = vi.fn().mockResolvedValue([
    { id: 'cat-cortes', name: 'Cortes', sortOrder: 1, slug: 'cortes', appliesTo: 'SERVICE' },
    { id: 'cat-prod', name: 'Productos', sortOrder: 2, slug: 'productos', appliesTo: 'PRODUCT' },
  ])
  repos.checkout.getBarbers = vi.fn().mockResolvedValue(BARBERS)
  // A1: checkout ahora carga barberos con estado de turno (getAvailableBarbers).
  // Mockeamos clocked-in para que sean asignables en el test.
  repos.checkout.getAvailableBarbers = vi
    .fn()
    .mockResolvedValue(BARBERS.map((b: { id: string }) => ({ ...b, hasClockedIn: true, isOccupied: false })))
  repos.checkout.getStockLevels = vi.fn().mockResolvedValue([{ productId: 'prod-shampoo', quantity: 10 }])
  repos.checkout.searchCustomers = vi.fn().mockResolvedValue([])
  repos.checkout.findOrCreateCustomer = vi.fn().mockResolvedValue({ id: 'c-new', fullName: 'New', email: null, phone: null })
  repos.checkout.findOrCreateMostradorCustomer = vi.fn().mockResolvedValue(MOSTRADOR)
  repos.checkout.getCustomer = vi.fn().mockResolvedValue(null)
  repos.checkout.getWalkIn = vi.fn().mockResolvedValue(null)
  // Default realista: resolveServicePriceForBarber devuelve el precio del
  // catálogo del corte (28000). Al cablear addCatalogItem, cada add de un
  // servicio re-resuelve vía esta ruta; sin un default los tests que agregan
  // "Corte" caerían al 0 del InMemoryCheckoutRepository y romperían los checks
  // de $280 / $840. Tests que prueban overrides lo sobre-escriben (p.ej. 35000).
  repos.checkout.resolveServicePriceForBarber = vi.fn().mockResolvedValue({ priceCents: 28000, isExcluded: false })
  repos.checkout.createSale = vi.fn().mockResolvedValue({
    id: 'sale-1', status: 'PAID', paymentStatus: 'PAID', totalCents: 28000, paidTotalCents: 28000,
  })
  repos.register.getRegisters = vi.fn().mockResolvedValue([REGISTER])
  return repos
}

// Tap enough $500 bills on the cash counter to cover any test ticket. The
// real PaymentSheet now blocks Confirmar until received >= total; without
// this the integration tests click a disabled button and the sale never
// fires. Plus order in CashCounter is $500/$200/$100/$50/$20/MONEDAS, so
// inside the dialog index 0 is +$500. Scope to the dialog because the cart
// line rows ALSO have "Aumentar cantidad" buttons that would otherwise win.
async function payInCash(user: ReturnType<typeof userEvent.setup>, fiveHundredTaps: number = 2) {
  const dialog = await screen.findByRole('dialog', { name: /pago/i })
  for (let i = 0; i < fiveHundredTaps; i++) {
    const plusButtons = within(dialog).getAllByRole('button', { name: /aumentar/i })
    await user.click(plusButtons[0])
  }
}

describe('CheckoutPage (integration)', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('free sale happy path: catalog → cart → CASH → success', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    // Wait for catalog to load
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    // Add corte to cart
    await user.click(screen.getAllByText('Corte')[0])
    // Open payment sheet via Cobrar CTA
    const cobrarBtn = await screen.findByRole('button', { name: /cobrar.*280/i })
    await user.click(cobrarBtn)
    // Pick CASH and count enough bills to cover $280
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await payInCash(user, 1)
    // Confirm
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    // Mostrador fallback used (no customer selected)
    await waitFor(() => {
      expect(repos.checkout.findOrCreateMostradorCustomer).toHaveBeenCalled()
      expect(repos.checkout.createSale).toHaveBeenCalled()
    })
  })

  it('loads stock with force:true so post-sale stock is never stale (overselling risk)', async () => {
    const repos = makeRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    expect(repos.checkout.getStockLevels).toHaveBeenCalledWith('loc1', { force: true })
  })

  it('walk-in completion: pre-fills customer + barber from WalkIn', async () => {
    const repos = makeRepos()
    repos.checkout.getWalkIn = vi.fn().mockResolvedValue({
      id: 'w1',
      status: 'ASSIGNED',
      customer: { id: 'c-papa', fullName: 'Papá Test', email: null, phone: null },
      assignedStaffUser: { id: 'b2', fullName: 'Beto' },
    })
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeWalkInId=w1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/papá test/i, {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it('walk-in completion: does NOT pre-fill a barber who has clocked out (A1 gate)', async () => {
    const repos = makeRepos()
    // b2 (Beto) is the walk-in's assignedStaffUser but has since clocked
    // out. b1 (Antonio) stays clocked in — it's the display fallback when
    // no valid default barber is set (ck.barbers[0]).
    repos.checkout.getAvailableBarbers = vi.fn().mockResolvedValue([
      { id: 'b1', fullName: 'Antonio', photoUrl: null, hasClockedIn: true, isOccupied: false },
      { id: 'b2', fullName: 'Beto', photoUrl: null, hasClockedIn: false, isOccupied: false },
      { id: 'b3', fullName: 'Carlos', photoUrl: null, hasClockedIn: true, isOccupied: false },
    ])
    repos.checkout.getWalkIn = vi.fn().mockResolvedValue({
      id: 'w1',
      status: 'ASSIGNED',
      customer: { id: 'c-papa', fullName: 'Papá Test', email: null, phone: null },
      assignedStaffUser: { id: 'b2', fullName: 'Beto' },
    })
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeWalkInId=w1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    // Customer still pre-fills (unaffected by the barber gate).
    expect(await screen.findByText(/papá test/i, {}, { timeout: 3000 })).toBeInTheDocument()
    // The "Atendiendo" strip must NOT show the clocked-out barber — it falls
    // back to the first clocked-in barber instead of crediting Beto.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cambiar barbero: beto/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cambiar barbero: antonio/i })).toBeInTheDocument()
    })
  })

  it('prefill de walk-in usa precio resuelto con overrides, no el base', async () => {
    const repos = makeRepos()
    repos.checkout.getWalkIn = vi.fn().mockResolvedValue({
      id: 'w1',
      customer: { id: 'c1', fullName: 'Fabián' },
      assignedStaffUser: { id: 'b1' },
      requestedServices: [{ id: 'svc-corte', name: 'Corte', basePriceCents: 20000, categoryId: 'cat-cortes' }],
    })
    repos.checkout.resolveServicePriceForBarber = vi.fn().mockResolvedValue({ priceCents: 35000, isExcluded: false })
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeWalkInId=w1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findByText('Fabián', {}, { timeout: 3000 })
    expect(repos.checkout.resolveServicePriceForBarber).toHaveBeenCalledWith('svc-corte', 'loc1', 'b1')
    // El precio ($350) aparece en la línea del carrito y en el Total; el base
    // ($200) no debe verse en ningún lado.
    expect((await screen.findAllByText('$350')).length).toBeGreaterThan(0)
    expect(screen.queryByText('$200')).not.toBeInTheDocument()
  })

  it('add manual con barbero default re-resuelve el precio para ese barbero', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.checkout.resolveServicePriceForBarber = vi.fn().mockResolvedValue({ priceCents: 35000, isExcluded: false })
    // Walk-in sin servicios: solo fija el barbero default (b2 = Beto, distinto
    // del fallback de display barbers[0]=Antonio, para poder esperar de forma
    // determinista a que el prefill del barbero se aplique antes del tap).
    repos.checkout.getWalkIn = vi.fn().mockResolvedValue({
      id: 'w1', customer: null, assignedStaffUser: { id: 'b2' }, requestedServices: [],
    })
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeWalkInId=w1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    // Espera a que el barbero default (Beto) quede aplicado — el header cambia
    // de Antonio (fallback) a Beto (prefill). Sin esto el tap podría ganarle al
    // dispatch del prefill y re-resolver con el staff inicial.
    await screen.findByRole('button', { name: /cambiar barbero: beto/i }, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    // La línea entra optimista con el precio del catálogo ($280) y se corrige a
    // $350 (override del barbero) — $350 aparece en la línea y en el Total.
    await waitFor(() => expect(screen.getAllByText('$350').length).toBeGreaterThan(0))
    expect(repos.checkout.resolveServicePriceForBarber).toHaveBeenCalledWith('svc-corte', 'loc1', 'b2')
  })

  it('multi-barber split: 3 cortes with 3 different barbers → mutation has 3 distinct staffUserIds', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    // Add 3 cortes — click the catalog tile button (role=button, containing 'Corte')
    // After first click, 'Corte' appears in both catalog and cart; use getAllByText
    await user.click(screen.getAllByText('Corte')[0])
    await user.click(screen.getAllByText('Corte')[0])
    await user.click(screen.getAllByText('Corte')[0])
    // Las filas de cart ahora se ven compactas por default. Para cambiar el
    // barbero hay que: 1) tap la fila → expande controles, 2) tap "Cambiar
    // barbero" → abre picker, 3) tap el barbero. Hacemos eso para las 3 líneas.
    const lineRows = screen.getAllByRole('button', { name: /toca para modificar/i })
    await user.click(lineRows[lineRows.length - 1])
    let changeBarberBtns = screen.getAllByRole('button', { name: /cambiar barbero/i })
    await user.click(changeBarberBtns[changeBarberBtns.length - 1])
    await user.click(await screen.findByLabelText('Carlos'))
    // Re-busca las filas porque el DOM se actualizó.
    const lineRowsAgain = screen.getAllByRole('button', { name: /toca para modificar/i })
    await user.click(lineRowsAgain[lineRowsAgain.length - 1])
    changeBarberBtns = screen.getAllByRole('button', { name: /cambiar barbero/i })
    await user.click(changeBarberBtns[changeBarberBtns.length - 1])
    await user.click(await screen.findByLabelText('Beto'))
    // Cobrar — 3 cortes = $840, two $500 bills cover it
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await payInCash(user, 2)
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => {
      const call = (repos.checkout.createSale as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.items.length).toBe(3)
    }, { timeout: 5000 })
  })

  it('customer skip → Mostrador fallback used at submit', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    // Don't touch customer chip
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await payInCash(user, 1)
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => {
      expect(repos.checkout.findOrCreateMostradorCustomer).toHaveBeenCalled()
      const call = (repos.checkout.createSale as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(call.customerId).toBe(MOSTRADOR.id)
    })
  })

  it('stock insufficient error: shows error banner', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.checkout.createSale = vi.fn().mockRejectedValue(new Error('Stock insuficiente: Shampoo'))
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    // Default = primera categoría (Cortes); Shampoo vive en Productos. Hay que
    // cambiar de chip para verlo (el default a primera categoría lo oculta).
    await user.click(await screen.findByRole('button', { name: 'Productos' }, { timeout: 3000 }))
    await user.click((await screen.findAllByText('Shampoo'))[0])
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await payInCash(user, 1)
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    // Error appears in both the PaymentSheet alert and the cart panel error region.
    await waitFor(() => expect(screen.getAllByText(/stock insuficiente/i).length).toBeGreaterThan(0))
  })

  it('no open register session: shows error', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.register.getRegisters = vi.fn().mockResolvedValue([{ ...REGISTER, openSession: null }])
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await payInCash(user, 1)
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    // Error appears in both the PaymentSheet alert and the cart panel error region.
    await waitFor(() => expect(screen.getAllByText(/no hay caja abierta/i).length).toBeGreaterThan(0))
  })

  // FIX 6: closeAppointmentSale (cita prepagada) debe invalidar Hoy/Mi Día
  // igual que createSale — de lo contrario el cajero cierra la cita y las
  // ganancias del día / estado de caja se quedan mostrando el snapshot viejo
  // hasta un refresh manual. El repo mock expone `closeAppointmentSale`
  // directamente (la eviction real vive en ApolloCheckoutRepository, probada
  // ahí contra el cache de Apollo); aquí verificamos que CheckoutPage llame
  // al repo (no a un `useMutation` sin evict) con el saleId correcto.
  it('prepaid appointment close (sin extras): calls repo.closeAppointmentSale (which evicts Hoy/Mi Día) and navigates home', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.checkout.getAppointmentPrepayState = vi.fn().mockResolvedValue({
      isPrepaid: true,
      hasPendingLink: false,
      prepaidSaleId: 'sale-prepaid-99',
      prepaidMethod: 'STRIPE',
      prepaidAt: '2026-07-01T12:00:00.000Z',
      staffNote: null,
      prepaidItems: [
        { id: 'pi-1', itemType: 'SERVICE', name: 'Corte', qty: 1, unitPriceCents: 28000, totalCents: 28000, serviceId: 'svc-corte', productId: null, catalogComboId: null, staffUserId: 'b1' },
      ],
      prepaidTotalCents: 28000,
    })
    repos.checkout.closeAppointmentSale = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeAppointmentId=appt-1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    // Sin extras en el carrito → el CTA es "Finalizar servicio" (cierre en $0).
    const closeBtn = await screen.findByRole('button', { name: /finalizar servicio/i }, { timeout: 3000 })
    await user.click(closeBtn)
    await waitFor(() => {
      expect(repos.checkout.closeAppointmentSale).toHaveBeenCalledWith('sale-prepaid-99')
    })
  })

  /* ── Cita PREPAGADA: items PAGADO read-only + extras cobrables por delta +
        finalizar en $0. El API devuelve appointment.sale con items; el checkout
        los pinta PAGADO (no suman al total a cobrar) y el operador puede agregar
        extras que se cobran por el delta vía addItemsToAppointmentSale. ── */

  // El viewer (staff-1) debe estar en el roster para poder acreditar los extras
  // — el default barber de una venta libre es el operador logueado.
  const PREPAID_ROSTER = [
    { id: 'staff-1', fullName: 'Carlos Barbero', photoUrl: null },
    ...BARBERS,
  ]
  function makePrepaidRepos(prepayState: Record<string, unknown>) {
    const repos = makeRepos()
    repos.checkout.getBarbers = vi.fn().mockResolvedValue(PREPAID_ROSTER)
    repos.checkout.getAvailableBarbers = vi
      .fn()
      .mockResolvedValue(PREPAID_ROSTER.map((b) => ({ ...b, hasClockedIn: true, isOccupied: false })))
    repos.checkout.getAppointmentPrepayState = vi.fn().mockResolvedValue(prepayState)
    return repos
  }
  const PREPAID_ITEM = {
    id: 'pi-1', itemType: 'SERVICE', name: 'Corte VIP de la cita', qty: 1,
    unitPriceCents: 50000, totalCents: 50000, serviceId: 'svc-vip', productId: null,
    catalogComboId: null, staffUserId: 'b1',
  }
  const PREPAID_STATE = {
    isPrepaid: true, hasPendingLink: false, prepaidSaleId: 'sale-prepaid-99',
    prepaidMethod: 'STRIPE', prepaidAt: '2026-07-01T12:00:00.000Z', staffNote: null,
    prepaidItems: [PREPAID_ITEM], prepaidTotalCents: 50000,
  }

  it('prepaid: pinta las líneas pagadas como PAGADO read-only (sin controles) y CTA finalizar', async () => {
    const repos = makePrepaidRepos(PREPAID_STATE)
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeAppointmentId=appt-1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    // La línea pagada se muestra con su nombre + chip PAGADO + precio.
    expect(await screen.findByText('Corte VIP de la cita', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('Pagado')).toBeInTheDocument()
    expect(screen.getAllByText('$500').length).toBeGreaterThan(0)
    // NO tiene controles: no es una fila editable (sin "toca para modificar"),
    // sin botón de quitar la línea pagada.
    expect(screen.queryByRole('button', { name: /toca para modificar/i })).not.toBeInTheDocument()
    // Sin extras → el CTA es "Finalizar servicio", no "Cobrar".
    expect(screen.getByRole('button', { name: /finalizar servicio/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^cobrar/i })).not.toBeInTheDocument()
  })

  it('prepaid: la nota de la cita se ve también en el flujo prepago', async () => {
    const repos = makePrepaidRepos({ ...PREPAID_STATE, staffNote: 'Cliente alérgico a la loción' })
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeAppointmentId=appt-1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/cliente alérgico a la loción/i, {}, { timeout: 3000 })).toBeInTheDocument()
  })

  it('prepaid: "A cobrar" = solo los extras (no lo pagado); muestra "Pagado antes"', async () => {
    const user = userEvent.setup()
    const repos = makePrepaidRepos(PREPAID_STATE)
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeAppointmentId=appt-1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    // Agrega un extra ($280). El total a cobrar debe ser $280, NO $780.
    await user.click(screen.getAllByText('Corte')[0])
    // CTA "Cobrar extras" con el delta de los extras ($280), nunca el prepagado.
    expect(await screen.findByRole('button', { name: /cobrar extras.*280/i }, { timeout: 3000 })).toBeInTheDocument()
    // "Pagado antes" muestra el monto prepagado ($500) — transparencia.
    expect(screen.getByText(/pagado antes/i)).toBeInTheDocument()
    expect(screen.getAllByText('$500').length).toBeGreaterThan(0)
    // "A cobrar" (label del total) presente; el total combinado ($780) NO aparece.
    expect(screen.getByText(/a cobrar/i)).toBeInTheDocument()
    expect(screen.queryByText('$780')).not.toBeInTheDocument()
  })

  it('prepaid: cobrar extras → addItemsToAppointmentSale con saleId, items, payments del delta y registerSessionId', async () => {
    const user = userEvent.setup()
    const repos = makePrepaidRepos(PREPAID_STATE)
    repos.checkout.addItemsToAppointmentSale = vi.fn().mockResolvedValue({
      id: 'sale-prepaid-99', status: 'PAID', paymentStatus: 'PAID', totalCents: 78000, paidTotalCents: 78000,
    })
    repos.checkout.closeAppointmentSale = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeAppointmentId=appt-1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    // El operador elige el barbero que atiende el extra (Antonio / b1) — así la
    // línea extra se acredita a ese barbero, como en una venta normal.
    await user.click(await screen.findByRole('button', { name: /cambiar barbero: carlos barbero/i }, { timeout: 3000 }))
    const barberSheet = await screen.findByRole('dialog', { name: /seleccionar barbero/i })
    await user.click(within(barberSheet).getByRole('button', { name: /antonio/i }))
    await screen.findByRole('button', { name: /cambiar barbero: antonio/i }, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    // Cobrar extras → wizard de pago normal → efectivo $280.
    await user.click(await screen.findByRole('button', { name: /cobrar extras/i }, { timeout: 3000 }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await payInCash(user, 1)
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => {
      expect(repos.checkout.addItemsToAppointmentSale).toHaveBeenCalled()
    })
    const call = (repos.checkout.addItemsToAppointmentSale as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.saleId).toBe('sale-prepaid-99')
    expect(call.registerSessionId).toBe('sess-1')
    expect(call.tipCents).toBe(0)
    // Pagos SOLO por el delta de los extras ($280), no por el total de la venta.
    expect(call.payments).toEqual([{ provider: 'CASH', amountCents: 28000 }])
    // Una línea extra: el corte resuelto a $280, acreditado al barbero elegido (b1).
    expect(call.items).toEqual([
      { serviceId: 'svc-corte', productId: null, catalogComboId: null, qty: 1, unitPriceCents: 28000, staffUserId: 'b1' },
    ])
    // NO se llamó createSale ni closeAppointmentSale — es la ruta de extras.
    expect(repos.checkout.createSale).not.toHaveBeenCalled()
    expect(repos.checkout.closeAppointmentSale).not.toHaveBeenCalled()
  })

  it('prepaid: un rechazo del server al cobrar extras se muestra al operador', async () => {
    const user = userEvent.setup()
    const repos = makePrepaidRepos(PREPAID_STATE)
    repos.checkout.addItemsToAppointmentSale = vi
      .fn()
      .mockRejectedValue(new Error('Stock insuficiente: Cera para cabello'))
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeAppointmentId=appt-1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    await user.click(await screen.findByRole('button', { name: /cobrar extras/i }, { timeout: 3000 }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await payInCash(user, 1)
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    // El error del server (español) aparece — nunca se traga en silencio.
    await waitFor(() => expect(screen.getAllByText(/stock insuficiente/i).length).toBeGreaterThan(0))
  })

  it('sin categorías muestra EmptyState accionable en lugar del grid', async () => {
    const repos = makeRepos()
    repos.checkout.getCategories = vi.fn().mockResolvedValue([])
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findByText(/Catálogo sin categorías/i, {}, { timeout: 3000 })
    expect(screen.queryByText('Corte')).not.toBeInTheDocument()
  })

  // Bug de dinero $0: elegir un barbero excluido de un servicio resolvía $0 en
  // silencio. Red de seguridad en resolveAndCommitLinePrice: si el precio
  // resuelto viene con isExcluded=true NO se comitea — la línea conserva su
  // precio anterior y sale un toast. (El catálogo no marca la exclusión aquí,
  // simulando catálogo stale: la única barrera es la del helper.)
  it('barbero excluido: NO comitea $0, conserva el precio y avisa con toast', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    // Carlos (b3) está excluido del corte → el resolve devuelve {0, excluded}.
    // El resto de barberos resuelve normal ($280).
    repos.checkout.resolveServicePriceForBarber = vi.fn().mockImplementation(
      (_svc: string, _loc: string, staff: string | null) =>
        Promise.resolve(staff === 'b3' ? { priceCents: 0, isExcluded: true } : { priceCents: 28000, isExcluded: false }),
    )
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    // Expandir la fila → abrir picker → elegir a Carlos (excluido).
    const lineRows = screen.getAllByRole('button', { name: /toca para modificar/i })
    await user.click(lineRows[lineRows.length - 1])
    const changeBarberBtns = screen.getAllByRole('button', { name: /cambiar barbero/i })
    await user.click(changeBarberBtns[changeBarberBtns.length - 1])
    await user.click(await screen.findByLabelText('Carlos'))
    // Toast claro + precio intacto ($280); nunca $0.
    expect(await screen.findByText(/carlos no ofrece corte/i)).toBeInTheDocument()
    expect(screen.getAllByText('$280').length).toBeGreaterThan(0)
    expect(screen.queryByText('$0')).not.toBeInTheDocument()
  })

  // UX proactiva: los barberos excluidos de un servicio se OCULTAN del picker
  // de esa línea (dato de exclusión traído en el catálogo STATIC, sin queries
  // por render).
  it('picker de línea oculta a los barberos excluidos del servicio', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    // Beto (b2) excluido del corte según el catálogo.
    repos.checkout.getServices = vi.fn().mockResolvedValue([{ ...SVC_CORTE, excludedStaffIds: ['b2'] }])
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    const lineRows = screen.getAllByRole('button', { name: /toca para modificar/i })
    await user.click(lineRows[lineRows.length - 1])
    const changeBarberBtns = screen.getAllByRole('button', { name: /cambiar barbero/i })
    await user.click(changeBarberBtns[changeBarberBtns.length - 1])
    expect(await screen.findByLabelText('Antonio')).toBeInTheDocument()
    expect(screen.getByLabelText('Carlos')).toBeInTheDocument()
    // Beto queda fuera del picker.
    expect(screen.queryByLabelText('Beto')).not.toBeInTheDocument()
  })

  // Basura en el carrito: el tap manual de un servicio que el barbero
  // atendiendo no realiza (catálogo stale, la card se alcanzó a mostrar) NO
  // debe dejar una línea en $0/sin barbero — se elimina y solo queda el toast.
  it('tap manual de servicio excluido para el atendiendo NO deja línea en el carrito', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    // El walk-in fija el barbero atendiendo (b2 = Beto) sin prefill de servicios
    // — un free sale no tiene default barber y no dispararía el camino de add.
    repos.checkout.getWalkIn = vi.fn().mockResolvedValue({
      id: 'w1', customer: null, assignedStaffUser: { id: 'b2' }, requestedServices: [],
    })
    // Catálogo stale: Corte se muestra en el grid (excludedStaffIds vacío) pero
    // el resolve para el barbero atendiendo devuelve excluido.
    repos.checkout.resolveServicePriceForBarber = vi
      .fn()
      .mockResolvedValue({ priceCents: 0, isExcluded: true })
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeWalkInId=w1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    // Espera a que Beto quede como atendiendo antes del tap (determinismo).
    await screen.findByRole('button', { name: /cambiar barbero: beto/i }, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    // El toast avisa…
    expect(await screen.findByText(/no ofrece corte/i)).toBeInTheDocument()
    // …y la línea nunca queda en el carrito (se elimina): no queda ninguna fila
    // de carrito. (El Total del carrito vacío es $0 legítimo, no una línea
    // basura.)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /toca para modificar/i })).not.toBeInTheDocument()
    })
    // Y el CTA de Cobrar queda deshabilitado (carrito vacío).
    expect(screen.getByRole('button', { name: /cobrar/i })).toBeDisabled()
  })

  // EXCEPCIÓN: el prefill de walk-in conserva la línea aunque el barbero
  // asignado esté excluido — el servicio lo pidió el cliente, no se descarta.
  // Entra SIN barbero y re-resuelto al precio de sucursal (nunca $0, nunca
  // eliminado).
  it('prefill de walk-in con barbero excluido conserva la línea (sin barbero, precio de sucursal)', async () => {
    const repos = makeRepos()
    repos.checkout.getWalkIn = vi.fn().mockResolvedValue({
      id: 'w1',
      customer: { id: 'c1', fullName: 'Fabián' },
      assignedStaffUser: { id: 'b1' },
      requestedServices: [{ id: 'svc-corte', name: 'Corte', basePriceCents: 20000, categoryId: 'cat-cortes' }],
    })
    // b1 (Antonio) excluido del corte; el precio de sucursal (staff=null) = $300.
    repos.checkout.resolveServicePriceForBarber = vi.fn().mockImplementation(
      (_svc: string, _loc: string, staff: string | null) =>
        Promise.resolve(staff === 'b1' ? { priceCents: 0, isExcluded: true } : { priceCents: 30000, isExcluded: false }),
    )
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeWalkInId=w1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findByText('Fabián', {}, { timeout: 3000 })
    // La línea se conserva a precio de sucursal ($300), no $0, no eliminada.
    expect((await screen.findAllByText('$300')).length).toBeGreaterThan(0)
    expect(screen.queryByText('$0')).not.toBeInTheDocument()
    // Y avisa que el barbero asignado no ofrece el servicio.
    expect(await screen.findByText(/no ofrece corte/i)).toBeInTheDocument()
  })

  // Bug de prod: las cards conservaban el precio resuelto para el VIEWER y no
  // reaccionaban al cambio de atendiendo. Fix: overlay de precios (capa LIVE)
  // que re-consulta el precio por barbero. Al cambiar el atendiendo la card
  // debe re-resolver, y el add posterior debe crear la línea con ese precio.
  it('cambiar el atendiendo re-resuelve el precio de las cards y el add usa ese precio', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    // Atendiendo inicial fijado por walk-in = b1 (Antonio), sin servicios.
    repos.checkout.getWalkIn = vi.fn().mockResolvedValue({
      id: 'w1', customer: null, assignedStaffUser: { id: 'b1' }, requestedServices: [],
    })
    // Overlay por barbero: Antonio (b1) $350, Beto (b2) precio de sucursal $300.
    // El estático del catálogo es $280 (SVC_CORTE) — distinto de ambos, así que
    // ver $350/$300 prueba que el overlay se aplicó y reaccionó al atendiendo.
    repos.checkout.getServicePricing = vi.fn().mockImplementation(
      (_loc: string, staff: string | null) =>
        Promise.resolve([{ id: 'svc-corte', priceCents: staff === 'b2' ? 30000 : 35000, isExcluded: false }]),
    )
    // La autoridad de la línea (resolveAndCommitLinePrice) alineada con el
    // overlay de Beto ($300) para el paso "agregar tras cambiar".
    repos.checkout.resolveServicePriceForBarber = vi.fn().mockImplementation(
      (_svc: string, _loc: string, staff: string | null) =>
        Promise.resolve({ priceCents: staff === 'b2' ? 30000 : 35000, isExcluded: false }),
    )
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeWalkInId=w1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    // Antonio (b1) queda como atendiendo y su overlay carga → card $350, nunca
    // el estático del viewer ($280).
    await screen.findByRole('button', { name: /cambiar barbero: antonio/i }, { timeout: 3000 })
    await waitFor(() => expect(screen.getAllByText('$350').length).toBeGreaterThan(0))
    expect(screen.queryByText('$280')).not.toBeInTheDocument()

    // Cambia el atendiendo a Beto (b2) vía el sheet.
    await user.click(screen.getByRole('button', { name: /cambiar barbero: antonio/i }))
    const sheet = await screen.findByRole('dialog', { name: /seleccionar barbero/i })
    await user.click(within(sheet).getByRole('button', { name: /beto/i }))

    // La card ahora muestra el precio de Beto ($300) — reaccionó al atendiendo.
    await waitFor(() => expect(screen.getAllByText('$300').length).toBeGreaterThan(0))
    expect(repos.checkout.getServicePricing).toHaveBeenCalledWith('loc1', 'b2')

    // Agregar tras cambiar: la línea (y por tanto el total del CTA Cobrar) usa
    // el precio de Beto ($300), no el de Antonio ($350).
    await user.click(screen.getAllByText('Corte')[0])
    expect(await screen.findByRole('button', { name: /cobrar.*300/i }, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cobrar.*350/i })).not.toBeInTheDocument()
    expect(repos.checkout.resolveServicePriceForBarber).toHaveBeenCalledWith('svc-corte', 'loc1', 'b2')
  })

  it('picker de línea muestra estado vacío cuando todos los barberos están excluidos', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.checkout.getServices = vi.fn().mockResolvedValue([{ ...SVC_CORTE, excludedStaffIds: ['b1', 'b2', 'b3'] }])
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    const lineRows = screen.getAllByRole('button', { name: /toca para modificar/i })
    await user.click(lineRows[lineRows.length - 1])
    const changeBarberBtns = screen.getAllByRole('button', { name: /cambiar barbero/i })
    await user.click(changeBarberBtns[changeBarberBtns.length - 1])
    expect(await screen.findByText(/ningún barbero disponible para este servicio/i)).toBeInTheDocument()
  })

  /* ── COMBOS: espejo del fix de servicios (overlay + exclusión + venta con
        precio resuelto). Mata el bug latente: hoy el combo mandaba el base y
        cualquier override lo dejaría invendible (PRICE_MISMATCH). ── */

  const COMBO_VIP = {
    id: 'combo-vip', name: 'Combo VIP', priceCents: 40000, imageUrl: null,
    effectiveCategoryIds: ['cat-cortes'], categoryId: 'cat-cortes', sortOrder: 5,
    items: [], excludedStaffIds: [] as string[],
  }

  it('combo: la venta manda el precio RESUELTO por barbero, no el base (evita PRICE_MISMATCH)', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    // Walk-in fija el barbero default (b2 = Beto), que es quien aterriza el
    // precio de la línea vía resolveComboPriceForBarber — la ruta única. (En un
    // free sale el default barber queda vacío al mount, igual que en servicios,
    // y la línea toma el precio del overlay directo; aquí probamos la ruta de
    // resolución por barbero de punta a punta.)
    repos.checkout.getWalkIn = vi.fn().mockResolvedValue({
      id: 'w1', customer: null, assignedStaffUser: { id: 'b2' }, requestedServices: [],
    })
    repos.checkout.getCombos = vi.fn().mockResolvedValue([COMBO_VIP])
    // Overlay (display) y autoridad de línea alineados en el override del barbero
    // ($450). El base es $400 — si la venta mandara el base, el API lo rechazaría.
    repos.checkout.getComboPricing = vi.fn().mockResolvedValue([{ id: 'combo-vip', priceCents: 45000, isExcluded: false }])
    repos.checkout.resolveComboPriceForBarber = vi.fn().mockResolvedValue({ priceCents: 45000, isExcluded: false })
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeWalkInId=w1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Combo VIP', {}, { timeout: 3000 })
    // Espera a que Beto quede como atendiendo antes del tap (determinismo).
    await screen.findByRole('button', { name: /cambiar barbero: beto/i }, { timeout: 3000 })
    await user.click(screen.getAllByText('Combo VIP')[0])
    // El CTA usa el precio resuelto ($450), nunca el base ($400).
    const cobrarBtn = await screen.findByRole('button', { name: /cobrar.*450/i }, { timeout: 3000 })
    await user.click(cobrarBtn)
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await payInCash(user, 1)
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => {
      const call = (repos.checkout.createSale as ReturnType<typeof vi.fn>).mock.calls[0][0]
      const comboLine = call.items.find((it: { catalogComboId: string | null }) => it.catalogComboId === 'combo-vip')
      expect(comboLine).toBeDefined()
      expect(comboLine.unitPriceCents).toBe(45000)
    })
    // La línea de combo se resolvió por la ruta única, con el barbero de la línea.
    expect(repos.checkout.resolveComboPriceForBarber).toHaveBeenCalledWith('combo-vip', 'loc1', 'b2')
  })

  it('combo: cambiar el atendiendo re-resuelve el precio de la card', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    // Atendiendo inicial fijado por walk-in = b1 (Antonio), sin servicios.
    repos.checkout.getWalkIn = vi.fn().mockResolvedValue({
      id: 'w1', customer: null, assignedStaffUser: { id: 'b1' }, requestedServices: [],
    })
    repos.checkout.getCombos = vi.fn().mockResolvedValue([COMBO_VIP])
    // Overlay por barbero: Antonio (b1) $450, Beto (b2) $420. El base es $400 —
    // distinto de ambos, así que ver $450/$420 prueba que el overlay reaccionó.
    repos.checkout.getComboPricing = vi.fn().mockImplementation(
      (_loc: string, staff: string | null) =>
        Promise.resolve([{ id: 'combo-vip', priceCents: staff === 'b2' ? 42000 : 45000, isExcluded: false }]),
    )
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeWalkInId=w1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findByRole('button', { name: /cambiar barbero: antonio/i }, { timeout: 3000 })
    await waitFor(() => expect(screen.getAllByText('$450').length).toBeGreaterThan(0))
    expect(screen.queryByText('$400')).not.toBeInTheDocument()
    // Cambia el atendiendo a Beto (b2) → la card del combo reacciona a $420.
    await user.click(screen.getByRole('button', { name: /cambiar barbero: antonio/i }))
    const sheet = await screen.findByRole('dialog', { name: /seleccionar barbero/i })
    await user.click(within(sheet).getByRole('button', { name: /beto/i }))
    await waitFor(() => expect(screen.getAllByText('$420').length).toBeGreaterThan(0))
    expect(repos.checkout.getComboPricing).toHaveBeenCalledWith('loc1', 'b2')
  })

  it('combo: tap de combo excluido para el atendiendo NO deja línea (se elimina) + toast', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    // Walk-in fija el atendiendo (b2 = Beto) sin servicios.
    repos.checkout.getWalkIn = vi.fn().mockResolvedValue({
      id: 'w1', customer: null, assignedStaffUser: { id: 'b2' }, requestedServices: [],
    })
    // Catálogo stale: el combo se muestra (excludedStaffIds vacío, overlay vacío)
    // pero el resolve para el atendiendo devuelve excluido → única barrera.
    repos.checkout.getCombos = vi.fn().mockResolvedValue([COMBO_VIP])
    repos.checkout.resolveComboPriceForBarber = vi.fn().mockResolvedValue({ priceCents: 0, isExcluded: true })
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeWalkInId=w1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Combo VIP', {}, { timeout: 3000 })
    await screen.findByRole('button', { name: /cambiar barbero: beto/i }, { timeout: 3000 })
    await user.click(screen.getAllByText('Combo VIP')[0])
    // Toast claro…
    expect(await screen.findByText(/no ofrece combo vip/i)).toBeInTheDocument()
    // …y la línea nunca queda en el carrito.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /toca para modificar/i })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /cobrar/i })).toBeDisabled()
  })

  it('combo: picker de línea oculta a los barberos excluidos del combo', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    // Beto (b2) excluido del combo según el catálogo STATIC.
    repos.checkout.getCombos = vi.fn().mockResolvedValue([{ ...COMBO_VIP, excludedStaffIds: ['b2'] }])
    // El default (staff-1) no está excluido → la línea se agrega normal.
    repos.checkout.resolveComboPriceForBarber = vi.fn().mockResolvedValue({ priceCents: 40000, isExcluded: false })
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Combo VIP', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Combo VIP')[0])
    const lineRows = screen.getAllByRole('button', { name: /toca para modificar/i })
    await user.click(lineRows[lineRows.length - 1])
    const changeBarberBtns = screen.getAllByRole('button', { name: /cambiar barbero/i })
    await user.click(changeBarberBtns[changeBarberBtns.length - 1])
    expect(await screen.findByLabelText('Antonio')).toBeInTheDocument()
    expect(screen.getByLabelText('Carlos')).toBeInTheDocument()
    // Beto queda fuera del picker de la línea de combo.
    expect(screen.queryByLabelText('Beto')).not.toBeInTheDocument()
  })
})

/* ── R9 (variante A): el botón de cobro dice a nombre de quién se cobra. El
      error que reportó el negocio pasa AL COBRAR —un barbero cobra dentro de
      la sesión de otro—, así que el nombre va en el botón, y es el de la
      SESIÓN ACTIVA, no el del barbero atribuido a las líneas. ── */

// Segunda sesión para contrastar: mismo POS, otro operador en la tablet.
class OtherSessionAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return { ...MOCK_VIEWER, staff: { ...MOCK_VIEWER.staff, id: 'staff-9', fullName: 'Aarón Cruz' } }
  }
}

describe('CheckoutPage — cobrar como {operador}', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  // Roster sin "Carlos" (b3) para que el nombre del CTA solo pueda venir de la
  // sesión (MOCK_VIEWER = Carlos Barbero) y nunca del barbero de la línea.
  function reposSinCarlos() {
    const repos = makeRepos()
    const roster = BARBERS.filter((b) => b.id !== 'b3')
    repos.checkout.getBarbers = vi.fn().mockResolvedValue(roster)
    repos.checkout.getAvailableBarbers = vi
      .fn()
      .mockResolvedValue(roster.map((b) => ({ ...b, hasClockedIn: true, isOccupied: false })))
    return repos
  }

  it('el CTA de cobro lleva el nombre del operador de la sesión y conserva el monto', async () => {
    const user = userEvent.setup()
    const repos = reposSinCarlos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    // Nombre accesible = acción + monto + operador.
    const cta = await screen.findByRole('button', { name: /cobrar · \$280 como carlos/i }, { timeout: 3000 })
    // Y las dos líneas siguen siendo visibles (el monto no se perdió).
    expect(within(cta).getByText(/\$280/)).toBeInTheDocument()
    expect(within(cta).getByText(/^Como Carlos$/)).toBeInTheDocument()
  })

  it('el nombre es el de la sesión, no el del barbero atribuido a la línea', async () => {
    const user = userEvent.setup()
    const repos = reposSinCarlos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    // El servicio se acredita a Antonio (atendiendo)…
    expect(
      await screen.findByRole('button', { name: /cambiar barbero: antonio/i }, { timeout: 3000 }),
    ).toBeInTheDocument()
    // …y aun así el cobro se hace a nombre de quien opera la tablet.
    expect(screen.getByRole('button', { name: /^cobrar/i })).toHaveAccessibleName(/como carlos/i)
    expect(screen.queryByRole('button', { name: /cobrar.*como antonio/i })).not.toBeInTheDocument()
  })

  it('con otra sesión activa el CTA cambia de nombre', async () => {
    const user = userEvent.setup()
    const repos = reposSinCarlos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new OtherSessionAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    expect(
      await screen.findByRole('button', { name: /cobrar · \$280 como aarón/i }, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /como carlos/i })).not.toBeInTheDocument()
  })

  it('la confirmación de pago repite a nombre de quién se cobra', async () => {
    const user = userEvent.setup()
    const repos = reposSinCarlos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    await user.click(await screen.findByRole('button', { name: /cobrar.*como carlos/i }, { timeout: 3000 }))
    const dialog = await screen.findByRole('dialog', { name: /pago/i })
    await user.click(within(dialog).getByRole('button', { name: /tarjeta/i }))
    expect(
      within(dialog).getByRole('button', { name: /confirmar pago · como carlos/i }),
    ).toBeInTheDocument()
  })

  it('el nombre en el CTA no cambia la lógica de cobro: sigue cerrando la venta', async () => {
    const user = userEvent.setup()
    const repos = reposSinCarlos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    await user.click(await screen.findByRole('button', { name: /cobrar.*como carlos/i }, { timeout: 3000 }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await payInCash(user, 1)
    await user.click(screen.getByRole('button', { name: /confirmar pago · como carlos/i }))
    await waitFor(() => {
      expect(repos.checkout.createSale).toHaveBeenCalled()
    })
  })
})

/* ── Entrar a "Nueva venta" revisa la versión del catálogo (spec § 3.4): es el
      momento en que un precio viejo hace daño (el API rechaza el cobro con
      PRICE_MISMATCH). La revisión la expone el gate por contexto. ── */

describe('CheckoutPage — revisión de versión de catálogo al entrar', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('revisa la versión al montar, una sola vez y sin bloquear el catálogo', async () => {
    const checkCatalogVersion = vi.fn().mockResolvedValue(undefined)
    const repos = makeRepos()
    renderWithProviders(
      <CatalogVersionContext.Provider value={{ checkCatalogVersion }}>
        <CheckoutPage />
      </CatalogVersionContext.Provider>,
      { initialRoute: '/checkout', repos: { ...repos, auth: new TestAuthRepo() } },
    )

    // La revisión sale al entrar, sin esperar a que el catálogo termine.
    expect(checkCatalogVersion).toHaveBeenCalledTimes(1)
    // Y la pantalla sigue su curso normal (no bloquea el render).
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    expect(checkCatalogVersion).toHaveBeenCalledTimes(1)
  })

  it('sin el gate arriba la pantalla abre igual (revisión no-op)', async () => {
    const repos = makeRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
  })
})

/* ── Aviso del canal en el tema `catalog` ──────────────────────────────────
 *
 * El gate de § 3.4 evicta el catálogo y avisa al canal, pero hasta aquí ningún
 * cargador del checkout estaba registrado en `catalog`: la visita que DETECTABA
 * el cambio seguía pintando el precio viejo y la puesta al día sólo llegaba a
 * la siguiente entrada. Ahora el aviso (del gate o del admin publicando) recarga
 * grid y overlay en la misma visita — sin tocar las líneas ya capturadas, que
 * sólo se re-precian con confirmación explícita del operador ([D-035]).
 */
describe('CheckoutPage — aviso del canal en el tema catalog', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  /** Catálogo cuyo precio del corte puede cambiar entre lecturas (admin publica). */
  function makeChannelRepos() {
    const repos = makeRepos()
    const state = { priceCents: 28000 }
    repos.checkout.evictCatalogCache = vi.fn()
    repos.checkout.getServices = vi
      .fn()
      .mockImplementation(async () => [{ ...SVC_CORTE, priceCents: state.priceCents }])
    // Overlay vacío a propósito: la card cae al precio estático del catálogo,
    // que es justo el número que queremos ver cambiar en el grid.
    repos.checkout.getServicePricing = vi.fn().mockResolvedValue([])
    repos.checkout.getComboPricing = vi.fn().mockResolvedValue([])
    repos.checkout.resolveServicePriceForBarber = vi
      .fn()
      .mockImplementation(async () => ({ priceCents: state.priceCents, isExcluded: false }))
    return { repos, state }
  }

  /** Veces que se pidió el catálogo. */
  function catalogReads(repos: ReturnType<typeof makeChannelRepos>['repos']) {
    return (repos.checkout.getServices as ReturnType<typeof vi.fn>).mock.calls.length
  }

  /**
   * Lecturas de catálogo que deja la ENTRADA a la pantalla, todas de la carga
   * inicial: corre dos veces porque el viewer resuelve después del primer
   * render y `staffUserId` es dependencia del efecto (`loc1`+null, luego
   * `loc1`+`staff-1`). Comportamiento previo a T-043, no del canal.
   */
  const MOUNT_CATALOG_READS = 2

  it('el cargador NO corre al montar: sólo lee la carga inicial y nadie evicta', async () => {
    const { repos } = makeChannelRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    expect(catalogReads(repos)).toBe(MOUNT_CATALOG_READS)
    expect((repos.checkout.getServices as ReturnType<typeof vi.fn>).mock.calls).toEqual([
      ['loc1', null],
      ['loc1', 'staff-1'],
    ])
    // Huella inconfundible del cargador del canal: SIEMPRE tira el catálogo
    // cacheado antes de pedir. Sin evict, ninguna de esas lecturas fue suya.
    expect(repos.checkout.evictCatalogCache).not.toHaveBeenCalled()
  })

  it('un aviso catalog recarga grid y overlay en la MISMA visita, sin re-preciar el carrito', async () => {
    const user = userEvent.setup()
    const { repos, state } = makeChannelRepos()
    const { announce } = renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    // La línea entró con el precio con el que el operador la capturó ($280).
    expect(await screen.findByRole('button', { name: /cobrar.*280/i })).toBeEnabled()
    expect(catalogReads(repos)).toBe(MOUNT_CATALOG_READS)

    // El admin sube el corte a $350 y el canal avisa del tema catalog.
    state.priceCents = 35000
    await announce('catalog')

    // Se pidió otra vez A LA RED: se tiró el catálogo cacheado (sin eso, las
    // lecturas cache-first devolverían el precio viejo) y el overlay fue force.
    expect(repos.checkout.evictCatalogCache).toHaveBeenCalled()
    expect(catalogReads(repos)).toBe(MOUNT_CATALOG_READS + 1)
    const pricingCalls = (repos.checkout.getServicePricing as ReturnType<typeof vi.fn>).mock.calls
    expect(pricingCalls[pricingCalls.length - 1][2]).toEqual({ force: true })
    expect(repos.checkout.getComboPricing).toHaveBeenCalled()

    // El grid ya muestra el precio nuevo: el operador no vuelve a agregar el
    // viejo (que el API rechazaría con PRICE_MISMATCH).
    await waitFor(() => expect(screen.getAllByText('$350').length).toBeGreaterThan(0))
    // Y la línea ya capturada conserva su precio: un aviso del canal NO re-precia
    // el carrito ([D-035] — eso exige confirmación explícita tras un rechazo).
    expect(screen.getByRole('button', { name: /cobrar.*280/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /cobrar.*350/i })).not.toBeInTheDocument()
  })

  it('un aviso de otro tema (sales) no recarga el catálogo', async () => {
    const { repos } = makeChannelRepos()
    const { announce } = renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    expect(catalogReads(repos)).toBe(MOUNT_CATALOG_READS)

    await announce('sales')

    expect(catalogReads(repos)).toBe(MOUNT_CATALOG_READS)
    expect(repos.checkout.evictCatalogCache).not.toHaveBeenCalled()
  })
})

/* ── Rechazo del servidor por datos viejos (spec frescura § 3.5, P5) ────────
 *
 * El servidor decide al cobrar. Si rechaza porque el POS traía datos viejos,
 * el POS se pone al día solo (re-precia / recarga existencias / relee la caja),
 * CONSERVA el carrito y pide confirmación explícita: nunca reintenta el cobro
 * por su cuenta ni deja al operador en un callejón sin salida.
 */
describe('CheckoutPage — rechazo del servidor por datos viejos', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  // El admin sube el precio del corte justo entre "agregar al carrito" y
  // "confirmar pago": el API rechaza con PRICE_MISMATCH y a partir de ahí todo
  // lo que responde el repo ya trae el precio nuevo.
  function makeRepricingRepos() {
    const repos = makeRepos()
    const state = { priceCents: 28000, attempts: 0 }
    repos.checkout.evictCatalogCache = vi.fn()
    repos.checkout.getServicePricing = vi.fn().mockResolvedValue([])
    repos.checkout.getComboPricing = vi.fn().mockResolvedValue([])
    repos.checkout.getServices = vi.fn().mockImplementation(async () => [{ ...SVC_CORTE, priceCents: state.priceCents }])
    repos.checkout.resolveServicePriceForBarber = vi
      .fn()
      .mockImplementation(async () => ({ priceCents: state.priceCents, isExcluded: false }))
    repos.checkout.createSale = vi.fn().mockImplementation(async (input: { items: Array<{ unitPriceCents: number }> }) => {
      state.attempts += 1
      if (state.attempts === 1) {
        state.priceCents = 35000
        throw new CheckoutRejectedError(
          'PRICE_MISMATCH',
          'El precio de "Corte" cambió — recarga el catálogo e intenta de nuevo.',
        )
      }
      const totalCents = input.items[0].unitPriceCents
      return { id: 'sale-1', status: 'PAID', paymentStatus: 'PAID', totalCents, paidTotalCents: totalCents }
    })
    return repos
  }

  async function addCorteAndConfirm(user: ReturnType<typeof userEvent.setup>) {
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    await user.click(await screen.findByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await payInCash(user, 1)
    await user.click(screen.getByRole('button', { name: /confirmar/i }))
  }

  it('PRICE_MISMATCH: re-precia el carrito, muestra ambos totales y NO vuelve a cobrar solo', async () => {
    const user = userEvent.setup()
    const repos = makeRepricingRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await addCorteAndConfirm(user)

    // Aviso con el texto de la spec + el antes y el después.
    expect(await screen.findByText(/los precios cambiaron/i)).toBeInTheDocument()
    expect(screen.getByText(/total anterior \$280 · total nuevo \$350/i)).toBeInTheDocument()
    // Se tiró el catálogo cacheado antes de volver a pedir precios: sin eso el
    // POS re-preciaría con el mismo precio que el servidor acaba de rechazar.
    expect(repos.checkout.evictCatalogCache).toHaveBeenCalled()
    expect(repos.checkout.getServicePricing).toHaveBeenCalledWith('loc1', null, { force: true })
    // El carrito se conserva, ya con el precio nuevo…
    expect(await screen.findByRole('button', { name: /cobrar.*350/i })).toBeEnabled()
    // …y NO se reintentó el cobro solo.
    expect(repos.checkout.createSale).toHaveBeenCalledTimes(1)
  })

  it('PRICE_MISMATCH: la hoja de pago se cierra y cobrar exige otro toque en Cobrar', async () => {
    const user = userEvent.setup()
    const repos = makeRepricingRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await addCorteAndConfirm(user)
    await screen.findByText(/los precios cambiaron/i)
    // La hoja de pago desapareció: no se puede confirmar sin volver a mirar.
    expect(screen.queryByRole('dialog', { name: /pago/i })).not.toBeInTheDocument()

    // Toque explícito en Cobrar → el aviso se va y la hoja vuelve.
    await user.click(await screen.findByRole('button', { name: /cobrar.*350/i }))
    const dialog = await screen.findByRole('dialog', { name: /pago/i })
    expect(screen.queryByText(/los precios cambiaron/i)).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /confirmar/i }))

    // La venta se manda con el precio NUEVO (re-preciado), no con el rechazado.
    await waitFor(() => expect(repos.checkout.createSale).toHaveBeenCalledTimes(2))
    const secondCall = (repos.checkout.createSale as ReturnType<typeof vi.fn>).mock.calls[1][0]
    expect(secondCall.items[0].unitPriceCents).toBe(35000)
  })

  it('STOCK: recarga existencias de la red y marca el faltante, conservando el carrito', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    // Otra tablet vendió el último shampoo entre "agregar" y "confirmar".
    const stock = { qty: 10 }
    repos.checkout.getStockLevels = vi
      .fn()
      .mockImplementation(async () => [{ productId: 'prod-shampoo', quantity: stock.qty }])
    repos.checkout.createSale = vi.fn().mockImplementation(async () => {
      stock.qty = 0
      throw new CheckoutRejectedError(
        'STOCK',
        'Stock insuficiente en esta sucursal:\nShampoo: 0 disponible(s), 1 solicitado(s)\nAjusta inventario antes de cobrar.',
      )
    })
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await user.click(await screen.findByRole('button', { name: 'Productos' }, { timeout: 3000 }))
    await user.click((await screen.findAllByText('Shampoo'))[0])
    await user.click(screen.getByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await payInCash(user, 1)
    const stockReadsBefore = (repos.checkout.getStockLevels as ReturnType<typeof vi.fn>).mock.calls.length
    await user.click(screen.getByRole('button', { name: /confirmar/i }))

    // El faltante se calcula contra el stock que ACABA de responder el API,
    // no contra el texto del mensaje.
    expect(await screen.findByText('Shampoo: 0 disponible(s), 1 solicitado(s)')).toBeInTheDocument()
    expect(repos.checkout.getStockLevels).toHaveBeenCalledTimes(stockReadsBefore + 1)
    expect(repos.checkout.getStockLevels).toHaveBeenLastCalledWith('loc1', { force: true })
    // Carrito intacto (el producto sigue ahí, a su precio) y sin hoja abierta.
    expect(await screen.findByRole('button', { name: /cobrar.*250/i })).toBeEnabled()
    expect(screen.queryByRole('dialog', { name: /pago/i })).not.toBeInTheDocument()
  })

  it('REGISTER_SESSION_STALE: relee la caja de la sucursal y avisa del corte pendiente', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.checkout.createSale = vi
      .fn()
      .mockRejectedValue(
        new CheckoutRejectedError(
          'REGISTER_SESSION_STALE',
          'La caja sigue abierta desde un día anterior. Haz el corte de caja y abre la de hoy antes de cobrar.',
        ),
      )
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])
    await user.click(await screen.findByRole('button', { name: /cobrar/i }))
    await user.click(await screen.findByRole('button', { name: /efectivo/i }))
    await payInCash(user, 1)
    const registerReadsBefore = (repos.register.getRegisters as ReturnType<typeof vi.fn>).mock.calls.length
    await user.click(screen.getByRole('button', { name: /confirmar/i }))

    expect(await screen.findByText(/caja de un día anterior/i)).toBeInTheDocument()
    expect(screen.getByText(/haz el corte de caja/i)).toBeInTheDocument()
    // Se releyó la caja al recuperarse: si otra tablet ya hizo el corte, el
    // checkout se entera sin recargar la pantalla.
    await waitFor(() =>
      expect(repos.register.getRegisters).toHaveBeenCalledTimes(registerReadsBefore + 1),
    )
    expect(await screen.findByRole('button', { name: /cobrar.*280/i })).toBeEnabled()
  })

  it('UNKNOWN: el rechazo se muestra tal cual, sin tocar el carrito ni cerrar la hoja', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.checkout.evictCatalogCache = vi.fn()
    repos.checkout.createSale = vi.fn().mockRejectedValue(new Error('Tu rol no puede cobrar.'))
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await addCorteAndConfirm(user)

    await waitFor(() => expect(screen.getAllByText(/tu rol no puede cobrar/i).length).toBeGreaterThan(0))
    // Nada que poner al día: no se evicta catálogo y la hoja sigue abierta
    // para reintentar (comportamiento de siempre).
    expect(repos.checkout.evictCatalogCache).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: /pago/i })).toBeInTheDocument()
  })

  /* ── Venta a staff ([D-039]) ───────────────────────────────────────────
   *
   * Estos tres códigos viajan en `AnyCheckoutRejectionCode` pero NO son
   * recuperables: no hay catálogo que recargar — los resuelve el operador
   * (elegir variante, quitar la línea) o el dueño (subir el tope). Antes de
   * T-039 caían fuera del `switch` de `recoverFromRejection` y el cobro
   * rechazado dejaba la pantalla MUDA: sin banner y sin aviso.
   */
  const STAFF_SALE_REJECTIONS: Array<[StaffSaleRejectionCode, string]> = [
    ['STAFF_SALE_QUOTA_EXCEEDED', 'Kevin lleva 5 de 6 productos este mes.'],
    ['STAFF_SALE_NOT_ELIGIBLE', 'Shampoo no está disponible para venta a staff.'],
    ['STAFF_SALE_VARIANT_REQUIRED', 'Elige la variante de Shampoo antes de cobrar.'],
  ]

  for (const [code, apiMessage] of STAFF_SALE_REJECTIONS) {
    it(`${code}: muestra el mensaje del API, conserva el carrito y NO abre el aviso de puesta al día`, async () => {
      const user = userEvent.setup()
      const repos = makeRepos()
      repos.checkout.evictCatalogCache = vi.fn()
      repos.checkout.createSale = vi.fn().mockRejectedValue(new CheckoutRejectedError(code, apiMessage))
      renderWithProviders(<CheckoutPage />, {
        initialRoute: '/checkout',
        repos: { ...repos, auth: new TestAuthRepo() },
      })
      await addCorteAndConfirm(user)

      // El texto en español del API se pinta tal cual (banner de error).
      await waitFor(() => expect(screen.getAllByText(apiMessage).length).toBeGreaterThan(0))
      // Y NO como aviso de "ya me puse al día" ([D-035]): ese es el único que
      // remata con "Toca Cobrar para continuar".
      expect(screen.queryByText(/toca cobrar para continuar/i)).not.toBeInTheDocument()
      // Nada que poner al día: el catálogo no se tira.
      expect(repos.checkout.evictCatalogCache).not.toHaveBeenCalled()
      // Carrito intacto y hoja abierta: el operador corrige y vuelve a cobrar.
      expect(await screen.findByRole('button', { name: /cobrar.*280/i })).toBeEnabled()
      expect(screen.getByRole('dialog', { name: /pago/i })).toBeInTheDocument()
    })
  }

  /* ── Venta a staff: la barra montada en el cobro (spec §4.5) ───────────── */

  it('venta a staff: el interruptor enciende el modo y el ticket deja de admitir cupones', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })

    // Con `pos.staff_sale.*` el interruptor existe y arranca apagado; el bloque
    // de cupones es el de siempre.
    const toggle = await screen.findByRole('switch', { name: /venta a staff/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('button', { name: /agregar cupón/i })).toBeInTheDocument()

    await user.click(toggle)

    // Encender pide el cupo ANTES de tocar el carrito ([D-055]); la política del
    // mock viene activa y sin topes.
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    expect(screen.getByRole('group', { name: 'Cupo del mes' })).toHaveTextContent(
      /sin tope este mes/i,
    )
    // Una venta a staff no admite cupones (§4.3.5): el input desaparece y se
    // dice por qué, en vez de dejar un código que el API rechazaría.
    expect(screen.queryByRole('button', { name: /agregar cupón/i })).not.toBeInTheDocument()
    expect(screen.getByText(/no admite cupones/i)).toBeInTheDocument()
  })

  /* ── Un toque que no deja línea tiene que decir por qué ──────────────────
   *
   * Con la política que NO admite servicios en el ticket de staff, tocar un
   * servicio del grid era un no-op MUDO: la card no se atenúa (el grid sólo
   * atenúa productos), la línea no entra y el mensaje que ya calcula el hook
   * no llegaba a ninguna parte — la barra sólo lo pinta cuando el servicio YA
   * está en el carrito, que es justo el caso que no puede ocurrir.
   */
  it('venta a staff sin servicios en el ticket: tocar un servicio anuncia el motivo y el carrito sigue vacío', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.checkout.getStaffSaleQuota = vi.fn().mockResolvedValue({
      enabled: true,
      // La política del tenant: servicios y combos NO van en el mismo ticket.
      allowServicesInTicket: false,
      unitsUsed: 0,
      unitsLimit: null,
      unitsRemaining: null,
      listAmountCentsUsed: 0,
      listAmountCentsLimit: null,
      listAmountCentsRemaining: null,
      perProductLimit: null,
      unitsByProduct: [],
    })
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    const toggle = await screen.findByRole('switch', { name: /venta a staff/i })
    await user.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    // Con el carrito vacío la barra no tiene nada que bloquear todavía: el
    // único camino al mensaje es el toque en el grid.
    expect(screen.queryByText(/no admite servicios ni combos/i)).not.toBeInTheDocument()

    await user.click(screen.getAllByText('Corte')[0])

    // El texto es el del hook (el POS no reimplementa la regla) y se anuncia
    // en la región viva del toast, no en un rincón mudo de la pantalla.
    const aviso = await screen.findByText(/no admite servicios ni combos/i)
    expect(screen.getByRole('status')).toContainElement(aviso)
    // Y la línea NO entró: ni fila en el carrito ni CTA cobrable.
    expect(screen.queryByRole('button', { name: /toca para modificar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cobrar/i })).toBeDisabled()
  })

  it('fuera del modo venta a staff, agregar un servicio no anuncia nada', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findAllByText('Corte', {}, { timeout: 3000 })
    await user.click(screen.getAllByText('Corte')[0])

    // El flujo normal no cambia: la línea entra y el CTA queda cobrable…
    expect(await screen.findByRole('button', { name: /cobrar.*280/i })).toBeEnabled()
    // …sin ningún aviso — `addCatalogItem` sólo rechaza en modo staff.
    expect(screen.queryByText(/no admite servicios ni combos/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
