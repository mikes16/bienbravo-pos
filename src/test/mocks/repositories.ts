import type { AuthRepository } from '@/core/auth/auth.repository.ts'
import type { PosViewer, PosStaffUser, PosLocation, PosPinLockoutStatus } from '@/core/auth/auth.types.ts'
import type { Repositories } from '@/core/repositories/registry.ts'
import type { AppointmentPrepayState, CheckoutRepository, CustomerResult, SaleDetail, ServicePricingOverlay } from '@/features/checkout/data/checkout.repository.ts'
import type {
  AddItemsToAppointmentSaleInput,
  CatalogCategory,
  CatalogCombo,
  CatalogProduct,
  CatalogService,
  CreateSaleInput,
  SaleResult,
  StockLevel,
} from '@/features/checkout/domain/checkout.types.ts'
import type { RegisterRepository } from '@/features/register/data/register.repository.ts'
import type { Register, RegisterSession, CloseSessionInput } from '@/features/register/domain/register.types.ts'
import type { ClockRepository, TimeClockEvent, ShiftTemplate } from '@/features/clock/data/clock.repository.ts'
import type { AgendaRepository } from '@/features/agenda/data/agenda.repository.ts'
import type { Appointment, AppointmentStatus } from '@/features/agenda/domain/agenda.types.ts'
import type { WalkInsRepository } from '@/features/walkins/data/walkins.repository.ts'
import type { WalkIn } from '@/features/walkins/domain/walkins.types.ts'

export const MOCK_STAFF: PosStaffUser = {
  id: 'staff-1',
  fullName: 'Carlos Barbero',
  email: 'carlos@bienbravo.com',
  phone: '+521234567890',
  photoUrl: null,
  photoPublicId: null,
  isActive: true,
  hasPosPin: true,
  pinAttempts: 0,
  pinLockedUntil: null,
}

// Mock viewer con permisos completos del catálogo POS — los tests asumen un
// operador con acceso total a POS. Si un test específico quiere validar un
// operador restringido, sobreescribe usando `{ ...MOCK_VIEWER, permissions: [...] }`.
export const MOCK_VIEWER: PosViewer = {
  kind: 'STAFF',
  staff: MOCK_STAFF,
  permissions: [
    // POS / caja
    'pos.sale.create',
    'pos.sale.close',
    'pos.sale.void',
    'pos.tip.add',
    'pos.discount.apply',
    'pos.refund.request',
    'pos.refund.approve',
    'pos.register.open',
    'pos.register.close',
    // Citas
    'appointments.read',
    'appointments.create',
    'appointments.check_in',
    'appointments.start_service',
    'appointments.complete',
    'appointments.cancel',
    'appointments.reschedule',
    'appointments.no_show',
    'appointments.prepay.cancel_link',
    // Walk-ins
    'walkins.read',
    'walkins.create',
    'walkins.assign',
    'walkins.reorder',
    'walkins.pause',
    'walkins.drop',
    'walkins.no_show',
    // Catálogo + customers + inventario (read-only desde POS)
    'catalog.services.read',
    'catalog.products.read',
    'customers.read',
    'inventory.read',
    // Reloj
    'timeclock.read',
  ],
  locationScopes: [{ scopeType: 'GLOBAL', locationId: null }],
}

export class InMemoryAuthRepository implements AuthRepository {
  #viewer: PosViewer | null = null
  #barbers: PosStaffUser[] = [MOCK_STAFF]

  async getViewer(): Promise<PosViewer | null> {
    return this.#viewer
  }

  /**
   * Cache helpers en el mock delegan a getViewer() para que subclasses que
   * override getViewer (común en tests) automáticamente afecten también el
   * cached / revalidate sin necesidad de overridear tres métodos por test.
   * En la real Apollo implementation las tres rutas son distintas
   * (cache vs network); aquí no hay diferencia.
   */
  getCachedViewer(): PosViewer | null {
    // No es async — los tests que necesitan resolución asincrónica usan
    // revalidate(). Devolvemos lo último que getViewer() devolvió si
    // existe en el state local, sino null.
    return this.#viewer
  }

  async revalidateViewer(): Promise<PosViewer | null> {
    // Delega a getViewer() para que overrides en subclases lo intercepten.
    return this.getViewer()
  }

  evictViewerCache(): void {
    // El mock no tiene Apollo cache real — el field viewer está en memoria
    // directa. La operación equivalente es no-op (los tests reset el estado
    // explícitamente entre casos).
  }

  async pinLogin(_email: string, _pin4: string): Promise<PosViewer> {
    this.#viewer = MOCK_VIEWER
    return MOCK_VIEWER
  }

  async logout(): Promise<void> {
    this.#viewer = null
  }

  async getBarbers(_locationId: string): Promise<PosStaffUser[]> {
    return this.#barbers
  }

  async getBarbersFresh(_locationId: string): Promise<PosStaffUser[]> {
    return this.#barbers
  }

  async getBarberStatuses(_locationId: string): Promise<Map<string, 'en_piso' | 'en_servicio' | 'fuera_de_turno'>> {
    return new Map()
  }

  async getLocations(): Promise<PosLocation[]> {
    return [
      { id: 'loc-1', name: 'Sucursal Centro', slug: 'centro', timezone: 'America/Monterrey' },
      { id: 'loc-2', name: 'Sucursal Norte', slug: 'norte', timezone: 'America/Monterrey' },
    ]
  }

  async verifyLocationAccess(_locationId: string, _password: string): Promise<boolean> {
    return true
  }

  async getPinLockoutStatus(_email: string): Promise<PosPinLockoutStatus> {
    return { lockedUntil: null, attemptsRemaining: 8 }
  }
}

export class InMemoryCheckoutRepository implements CheckoutRepository {
  async getCategories(): Promise<CatalogCategory[]> {
    return []
  }

  async getServices(_locationId: string, _staffUserId?: string | null): Promise<CatalogService[]> {
    return [
      { id: 'svc-1', name: 'Corte Clásico', priceCents: 35000, durationMin: 30, isAddOn: false, imageUrl: null, categoryId: null, sortOrder: 0, extras: [], excludedStaffIds: [] },
      { id: 'svc-2', name: 'Barba', priceCents: 15000, durationMin: 15, isAddOn: true, imageUrl: null, categoryId: null, sortOrder: 1, extras: [], excludedStaffIds: [] },
    ]
  }

  async getProducts(_locationId: string): Promise<CatalogProduct[]> {
    return [
      { id: 'prod-1', name: 'Cera para cabello', sku: 'WAX-01', priceCents: 25000, imageUrl: null, categoryId: null, sortOrder: 0 },
    ]
  }

  async getCombos(): Promise<CatalogCombo[]> {
    return []
  }

  async getStockLevels(_locationId: string, _opts?: { force?: boolean }): Promise<StockLevel[]> {
    return []
  }

  async resolveServicePriceForBarber(_serviceId: string, _locationId: string, _staffUserId: string | null): Promise<{ priceCents: number; isExcluded: boolean }> {
    return { priceCents: 0, isExcluded: false }
  }

  // Hermana de resolveServicePriceForBarber para combos. Mismo default {0,false}.
  async resolveComboPriceForBarber(_comboId: string, _locationId: string, _staffUserId: string | null): Promise<{ priceCents: number; isExcluded: boolean }> {
    return { priceCents: 0, isExcluded: false }
  }

  // Overlay de precios por barbero: por defecto vacío → el grid cae al precio
  // estático del catálogo. Tests que verifican la reactividad del precio de las
  // cards al cambiar el atendiendo sobre-escriben con vi.fn por barbero.
  async getServicePricing(_locationId: string, _staffUserId: string | null): Promise<ServicePricingOverlay[]> {
    return []
  }

  // Overlay de precios de combo por barbero — hermana de getServicePricing.
  async getComboPricing(_locationId: string, _staffUserId: string | null): Promise<ServicePricingOverlay[]> {
    return []
  }

  async createSale(_input: CreateSaleInput): Promise<SaleResult> {
    return { id: 'sale-1', status: 'PAID', paymentStatus: 'PAID', totalCents: 50000, paidTotalCents: 50000 }
  }

  async closeAppointmentSale(_saleId: string): Promise<void> {
    // No-op por defecto. Tests del flujo de cierre de cita prepagada
    // sobre-escriben con vi.fn para verificar la llamada.
  }

  async addItemsToAppointmentSale(_input: AddItemsToAppointmentSaleInput): Promise<SaleResult> {
    // Default realista: la venta se cierra en PAID. Tests del flujo de cobro
    // de extras sobre-escriben con vi.fn para verificar el payload (saleId,
    // items, payments del delta, tipCents, registerSessionId).
    return { id: 'sale-extras-1', status: 'PAID', paymentStatus: 'PAID', totalCents: 0, paidTotalCents: 0 }
  }

  async searchCustomers(_query: string, _limit = 10): Promise<CustomerResult[]> {
    return []
  }

  async findOrCreateCustomer(name: string, email?: string | null, phone?: string | null): Promise<CustomerResult> {
    // API real: Customer! no-null (spec identidad-clientes) — el mock
    // devuelve un cliente sintético en vez de null para no re-introducir el
    // bug que este mismo esfuerzo corrigió (name-only create fallando en
    // silencio). Tests que necesitan simular CUSTOMER_NAME_TAKEN sobre-escriben
    // con vi.fn(() => Promise.reject(new CustomerNameTakenException(...))).
    return { id: 'cust-new', fullName: name, email: email ?? null, phone: phone ?? null }
  }

  async findOrCreateMostradorCustomer(): Promise<{ id: string; fullName: string }> {
    return { id: 'cust-mostrador', fullName: 'Mostrador' }
  }

  async getBarbers(_locationId: string): Promise<{ id: string; fullName: string; photoUrl: string | null }[]> {
    return [
      { id: 'staff-1', fullName: 'Carlos', photoUrl: null },
      { id: 'staff-2', fullName: 'Antonio', photoUrl: null },
    ]
  }

  async getAvailableBarbers(_locationId: string): Promise<{ id: string; fullName: string; photoUrl: string | null; hasClockedIn: boolean; isOccupied: boolean }[]> {
    return [
      { id: 'staff-1', fullName: 'Carlos', photoUrl: null, hasClockedIn: true, isOccupied: false },
      { id: 'staff-2', fullName: 'Antonio', photoUrl: null, hasClockedIn: true, isOccupied: false },
    ]
  }

  async getCustomer(_id: string): Promise<CustomerResult | null> {
    return null
  }

  async getCustomerHistory(_customerId: string, _limit?: number): Promise<Array<{ id: string; status: string; startAt: string; itemLabels: string[] }>> {
    return []
  }

  async getWalkIn(_walkInId: string, _locationId: string): Promise<{
    id: string
    status: string
    assignedStaffUser: { id: string; fullName: string } | null
    customer: CustomerResult | null
  } | null> {
    return null
  }

  async getAppointmentPrepayState(_appointmentId: string): Promise<AppointmentPrepayState> {
    // Default: no prepago, sin nota de cita ni items pagados. Tests específicos
    // del flujo de prepago / nota de cita / extras pueden sobre-escribir con
    // vi.spyOn al armar su escenario.
    return {
      isPrepaid: false,
      hasPendingLink: false,
      prepaidSaleId: null,
      prepaidMethod: null,
      prepaidAt: null,
      staffNote: null,
      prepaidItems: [],
      prepaidTotalCents: null,
    }
  }

  // Cupones: el mock por defecto reporta "sin cupones aplicados" para que
  // los tests existentes del checkout sigan pasando sin tocarse. Tests
  // específicos del flujo de cupones sobre-escriben con vi.fn al armar el
  // escenario.
  async applyCoupon(): Promise<null> {
    return null
  }

  async removeCoupon(): Promise<null> {
    return null
  }

  // Detalle de venta: por defecto null. Tests del sheet de "Mi Día"
  // sobre-escriben con vi.fn que devuelve un SaleDetail armado.
  async getSaleDetail(_id: string): Promise<SaleDetail | null> {
    return null
  }
}

export class InMemoryRegisterRepository implements RegisterRepository {
  async getRegisters(_locationId: string, _opts?: { force?: boolean }): Promise<Register[]> {
    return [{ id: 'reg-1', name: 'Caja 1', isActive: true, locationId: 'loc-1', openSession: null }]
  }
  async openSession(_registerId: string, openingCashCents: number): Promise<RegisterSession> {
    return { id: 'sess-1', status: 'OPEN', openedAt: new Date().toISOString(), closedAt: null, openingCashCents, expectedCashCents: openingCashCents, expectedCardCents: 0, expectedTransferCents: 0, countedCashCents: null, countedCardCents: null, countedTransferCents: null }
  }
  async closeSession(_input: CloseSessionInput): Promise<RegisterSession> {
    return { id: 'sess-1', status: 'CLOSED', openedAt: new Date().toISOString(), closedAt: new Date().toISOString(), openingCashCents: 0, expectedCashCents: 0, expectedCardCents: 0, expectedTransferCents: 0, countedCashCents: 0, countedCardCents: 0, countedTransferCents: 0 }
  }
}

export class InMemoryClockRepository implements ClockRepository {
  async clockIn(_locationId: string): Promise<boolean> { return true }
  async clockOut(_locationId: string): Promise<boolean> { return true }
  async getEvents(_staffUserId: string, _locationId: string, _fromDate: string, _toDate: string): Promise<TimeClockEvent[]> {
    return []
  }

  async getShiftTemplates(_staffUserId: string, _locationId: string, _opts?: { force?: boolean }): Promise<ShiftTemplate[]> {
    return []
  }

  async getLatenessThresholdMin(_locationId: string, _opts?: { force?: boolean }): Promise<number> {
    return 10
  }
}

export class InMemoryAgendaRepository implements AgendaRepository {
  async getAppointments(_dateFrom: string, _dateTo: string, _locationId: string | null, _status?: AppointmentStatus, _opts?: { force?: boolean }): Promise<Appointment[]> { return [] }
  async checkIn(_id: string): Promise<void> {}
  async startService(_id: string): Promise<void> {}
  async complete(_id: string): Promise<void> {}
  async noShow(_id: string): Promise<void> {}
  async reassignAppointment(_appointmentId: string, _staffUserId: string): Promise<void> {}
}

export class InMemoryWalkInsRepository implements WalkInsRepository {
  async getWalkIns(_locationId: string, _fromDate?: string, _toDate?: string, _opts?: { force?: boolean }): Promise<WalkIn[]> { return [] }
  async create(_input: { locationId: string; customerId?: string | null; customerName: string | null; customerPhone?: string | null; customerEmail?: string | null }): Promise<WalkIn> {
    return { id: 'wi-1', status: 'PENDING', customerName: null, customerPhone: null, customerEmail: null, createdAt: new Date().toISOString(), sortOrder: 1, assignedStaffUser: null, customer: null }
  }
  async assign(_walkInId: string, _staffUserId: string): Promise<{ walkIn: WalkIn; warning: string | null }> {
    return { walkIn: { id: 'wi-1', status: 'ASSIGNED', customerName: null, customerPhone: null, customerEmail: null, createdAt: new Date().toISOString(), sortOrder: 1, assignedStaffUser: { id: 'staff-1', fullName: 'Carlos' }, customer: null }, warning: null }
  }
  async complete(_walkInId: string): Promise<void> {}
  async drop(_walkInId: string, _reason?: string | null): Promise<void> {}
  async pauseWalkIn(_walkInId: string) {
    return { id: 'wi-1', pausedAt: new Date().toISOString() }
  }
  async resumeWalkIn(_walkInId: string) {
    return { id: 'wi-1', pausedAt: null }
  }
  async markWalkInNoShow(_walkInId: string) {
    return { id: 'wi-1', status: 'NO_SHOW' }
  }
  async reorderWalkIns(_input: { locationId: string; orderedIds: string[] }) {
    return []
  }
  async suggestedNextWalkIn(_input: { locationId: string; staffUserId: string }): Promise<WalkIn | null> {
    return null
  }
}

export function createMockRepositories(overrides?: Partial<Repositories>): Repositories {
  return {
    auth: new InMemoryAuthRepository(),
    checkout: new InMemoryCheckoutRepository(),
    register: new InMemoryRegisterRepository(),
    clock: new InMemoryClockRepository(),
    agenda: new InMemoryAgendaRepository(),
    walkins: new InMemoryWalkInsRepository(),
    ...overrides,
  }
}
