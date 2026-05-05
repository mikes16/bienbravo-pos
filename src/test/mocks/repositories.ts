import type { AuthRepository } from '@/core/auth/auth.repository.ts'
import type { PosViewer, PosStaffUser, PosLocation, PosPinLockoutStatus } from '@/core/auth/auth.types.ts'
import type { Repositories } from '@/core/repositories/registry.ts'
import type { CheckoutRepository, CustomerResult } from '@/features/checkout/data/checkout.repository.ts'
import type {
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
  isActive: true,
  hasPosPin: true,
  pinAttempts: 0,
  pinLockedUntil: null,
}

export const MOCK_VIEWER: PosViewer = {
  kind: 'STAFF',
  staff: MOCK_STAFF,
  permissions: ['pos.sale.create', 'appointments.read', 'walkins.manage', 'pos.register.manage', 'timeclock.manage'],
  locationScopes: [{ scopeType: 'GLOBAL', locationId: null }],
}

export class InMemoryAuthRepository implements AuthRepository {
  #viewer: PosViewer | null = null
  #barbers: PosStaffUser[] = [MOCK_STAFF]

  async getViewer(): Promise<PosViewer | null> {
    return this.#viewer
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

  async getLocations(): Promise<PosLocation[]> {
    return [
      { id: 'loc-1', name: 'Sucursal Centro' },
      { id: 'loc-2', name: 'Sucursal Norte' },
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
      { id: 'svc-1', name: 'Corte Clásico', priceCents: 35000, durationMin: 30, isAddOn: false, imageUrl: null, categoryId: null, extras: [] },
      { id: 'svc-2', name: 'Barba', priceCents: 15000, durationMin: 15, isAddOn: true, imageUrl: null, categoryId: null, extras: [] },
    ]
  }

  async getProducts(_locationId: string): Promise<CatalogProduct[]> {
    return [
      { id: 'prod-1', name: 'Cera para cabello', sku: 'WAX-01', priceCents: 25000, imageUrl: null, categoryId: null },
    ]
  }

  async getCombos(): Promise<CatalogCombo[]> {
    return []
  }

  async getStockLevels(_locationId: string): Promise<StockLevel[]> {
    return []
  }

  async createSale(_input: CreateSaleInput): Promise<SaleResult> {
    return { id: 'sale-1', status: 'PAID', paymentStatus: 'PAID', totalCents: 50000, paidTotalCents: 50000 }
  }

  async searchCustomers(_query: string, _limit = 10): Promise<CustomerResult[]> {
    return []
  }

  async findOrCreateCustomer(_name: string, _email?: string | null, _phone?: string | null): Promise<CustomerResult | null> {
    return null
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

  async getCustomer(_id: string): Promise<CustomerResult | null> {
    return null
  }

  async getWalkIn(_walkInId: string, _locationId: string): Promise<{
    id: string
    status: string
    assignedStaffUser: { id: string; fullName: string } | null
    customer: CustomerResult | null
  } | null> {
    return null
  }
}

export class InMemoryRegisterRepository implements RegisterRepository {
  async getRegisters(_locationId: string): Promise<Register[]> {
    return [{ id: 'reg-1', name: 'Caja 1', isActive: true, locationId: 'loc-1', openSession: null }]
  }
  async openSession(_registerId: string, openingCashCents: number): Promise<RegisterSession> {
    return { id: 'sess-1', status: 'OPEN', openedAt: new Date().toISOString(), closedAt: null, expectedCashCents: openingCashCents, expectedCardCents: 0, expectedTransferCents: 0, countedCashCents: null, countedCardCents: null, countedTransferCents: null }
  }
  async closeSession(_input: CloseSessionInput): Promise<RegisterSession> {
    return { id: 'sess-1', status: 'CLOSED', openedAt: new Date().toISOString(), closedAt: new Date().toISOString(), expectedCashCents: 0, expectedCardCents: 0, expectedTransferCents: 0, countedCashCents: 0, countedCardCents: 0, countedTransferCents: 0 }
  }
}

export class InMemoryClockRepository implements ClockRepository {
  async clockIn(_locationId: string): Promise<boolean> { return true }
  async clockOut(_locationId: string): Promise<boolean> { return true }
  async getEvents(_staffUserId: string, _locationId: string, _fromDate: string, _toDate: string): Promise<TimeClockEvent[]> {
    return []
  }

  async getShiftTemplates(_staffUserId: string, _locationId: string): Promise<ShiftTemplate[]> {
    return []
  }
}

export class InMemoryAgendaRepository implements AgendaRepository {
  async getAppointments(_dateFrom: string, _dateTo: string, _locationId: string | null, _status?: AppointmentStatus): Promise<Appointment[]> { return [] }
  async checkIn(_id: string): Promise<void> {}
  async startService(_id: string): Promise<void> {}
  async complete(_id: string): Promise<void> {}
  async noShow(_id: string): Promise<void> {}
}

export class InMemoryWalkInsRepository implements WalkInsRepository {
  async getWalkIns(_locationId: string): Promise<WalkIn[]> { return [] }
  async create(_locationId: string, _customerName: string | null, _customerPhone?: string | null, _customerEmail?: string | null): Promise<WalkIn> {
    return { id: 'wi-1', status: 'PENDING', customerName: null, customerPhone: null, customerEmail: null, createdAt: new Date().toISOString(), assignedStaffUser: null, customer: null }
  }
  async assign(_walkInId: string, _staffUserId: string): Promise<{ walkIn: WalkIn; warning: string | null }> {
    return { walkIn: { id: 'wi-1', status: 'ASSIGNED', customerName: null, customerPhone: null, customerEmail: null, createdAt: new Date().toISOString(), assignedStaffUser: { id: 'staff-1', fullName: 'Carlos' }, customer: null }, warning: null }
  }
  async complete(_walkInId: string): Promise<void> {}
  async drop(_walkInId: string, _reason?: string | null): Promise<void> {}
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
