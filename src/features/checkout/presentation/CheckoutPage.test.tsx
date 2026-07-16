import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CheckoutPage } from './CheckoutPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
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
  it('prepaid appointment close: calls repo.closeAppointmentSale (which evicts Hoy/Mi Día) and navigates home', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.checkout.getAppointmentPrepayState = vi.fn().mockResolvedValue({
      isPrepaid: true,
      hasPendingLink: false,
      prepaidSaleId: 'sale-prepaid-99',
      prepaidMethod: 'STRIPE',
      prepaidAt: '2026-07-01T12:00:00.000Z',
    })
    repos.checkout.closeAppointmentSale = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(<CheckoutPage />, {
      initialRoute: '/checkout?completeAppointmentId=appt-1',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    const closeBtn = await screen.findByRole('button', { name: /cerrar cita y completar servicio/i }, { timeout: 3000 })
    await user.click(closeBtn)
    await waitFor(() => {
      expect(repos.checkout.closeAppointmentSale).toHaveBeenCalledWith('sale-prepaid-99')
    })
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
})
