import { describe, it, expect } from 'vitest'
import { deriveHoyViewModel } from './deriveHoyViewModel'
import type { Appointment } from '@/features/agenda/domain/agenda.types'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository'
import type { WalkIn } from '@/features/walkins/domain/walkins.types'

const STAFF_ID = 'staff-1'
const STAFF_NAME = 'Eli Cruz'

function baseInput(overrides: Partial<Parameters<typeof deriveHoyViewModel>[0]> = {}) {
  return {
    staffId: STAFF_ID,
    staffName: STAFF_NAME,
    appointments: [] as Appointment[],
    walkIns: [] as WalkIn[],
    clockEvents: [] as TimeClockEvent[],
    commission: { amountCents: 0, serviceCount: 0, loading: false },
    caja: { isOpen: true, accumulatedCents: 0, openedAt: new Date() },
    ...overrides,
  }
}

describe('deriveHoyViewModel', () => {
  // Empty state
  it('empty day returns empty rows and Nueva venta CTA', () => {
    const vm = deriveHoyViewModel(baseInput())
    expect(vm.rows).toEqual([])
    expect(vm.cta?.variant).toBe('nueva-venta')
    expect(vm.staffName).toBe('Eli Cruz')
  })

  // Privacy filter
  it('appointment assigned to OTHER staff is excluded', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a1',
            status: 'CONFIRMED',
            staffUser: { id: 'other-staff', fullName: 'Luis' },
            customer: { id: 'c1', fullName: 'Pedro', email: null, phone: null },
            items: [{ label: 'corte', priceCents: 0, qty: 1 }],
            startAt: '2026-05-04T13:00:00Z',
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.rows).toEqual([])
  })

  it('appointment assigned to me is included as kind=pending', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a1',
            status: 'CONFIRMED',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c1', fullName: 'Pedro Soto', email: null, phone: null },
            items: [{ label: 'Corte + barba', priceCents: 0, qty: 1 }],
            startAt: '2026-05-04T13:00:00Z',
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.rows).toHaveLength(1)
    expect(vm.rows[0].customerName).toBe('Pedro Soto')
    expect(vm.rows[0].pillLabel).toMatch(/cita/i)
  })

  it('walk-in assigned to me is included', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        walkIns: [
          {
            id: 'w1',
            status: 'ASSIGNED',
            customerName: 'Carlos',
            assignedStaffUser: { id: STAFF_ID, fullName: 'Eli' },
            createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
          } as WalkIn,
        ],
      }),
    )
    expect(vm.rows).toHaveLength(1)
    expect(vm.rows[0].customerName).toBe('Carlos')
    expect(vm.rows[0].pillLabel).toMatch(/walk-in/i)
  })

  it('walk-in assigned to OTHER staff is excluded', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        walkIns: [
          {
            id: 'w1',
            status: 'ASSIGNED',
            customerName: 'Carlos',
            assignedStaffUser: { id: 'other', fullName: 'Luis' },
            createdAt: new Date().toISOString(),
          } as WalkIn,
        ],
      }),
    )
    expect(vm.rows).toEqual([])
  })

  it('PENDING walk-in (queue, unassigned) is included as kind=queue', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        walkIns: [
          {
            id: 'w1',
            status: 'PENDING',
            customerName: 'Juan',
            assignedStaffUser: null,
            createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
          } as WalkIn,
        ],
      }),
    )
    expect(vm.rows).toHaveLength(1)
    expect(vm.rows[0].kind).toBe('queue')
    expect(vm.rows[0].pillTone).toBe('walkin')
  })

  // Active service detection
  it('IN_SERVICE appointment for me marked as kind=active', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a1',
            status: 'IN_SERVICE',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c1', fullName: 'Carlos', email: null, phone: null },
            items: [{ label: 'corte', priceCents: 0, qty: 1 }],
            startAt: new Date(Date.now() - 12 * 60_000).toISOString(),
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.rows[0].kind).toBe('active')
    expect(vm.rows[0].timeLabel).toMatch(/en servicio.*\d+\s*min/i)
  })

  // CTA derivation matrix
  it('CTA = abrir-caja when caja is closed (overrides everything)', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        caja: { isOpen: false, accumulatedCents: null, openedAt: null },
        appointments: [
          {
            id: 'a1',
            status: 'IN_SERVICE',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c1', fullName: 'Carlos', email: null, phone: null },
            items: [{ label: 'corte', priceCents: 0, qty: 1 }],
            startAt: new Date().toISOString(),
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.cta?.variant).toBe('abrir-caja')
    expect(vm.cta?.actionLabel).toMatch(/abrir caja/i)
  })

  it('CTA = cobrar when active service exists', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a1',
            status: 'IN_SERVICE',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c1', fullName: 'Carlos Méndez', email: null, phone: null },
            items: [{ label: 'corte', priceCents: 0, qty: 1 }],
            startAt: new Date().toISOString(),
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.cta?.variant).toBe('cobrar')
    expect(vm.cta?.actionLabel).toMatch(/carlos méndez/i)
  })

  it('CTA = atender when next appointment exists (no active)', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a1',
            status: 'CONFIRMED',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c1', fullName: 'Pedro', email: null, phone: null },
            items: [{ label: 'corte', priceCents: 0, qty: 1 }],
            startAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.cta?.variant).toBe('atender')
    expect(vm.cta?.actionLabel).toMatch(/pedro/i)
  })

  it('CTA = atender al siguiente when only queue walk-in', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        walkIns: [
          {
            id: 'w1',
            status: 'PENDING',
            customerName: 'Juan',
            assignedStaffUser: null,
            createdAt: new Date().toISOString(),
          } as WalkIn,
        ],
      }),
    )
    expect(vm.cta?.variant).toBe('atender')
    expect(vm.cta?.actionLabel).toMatch(/juan/i)
  })

  it('CTA = nueva-venta when nothing pending', () => {
    const vm = deriveHoyViewModel(baseInput())
    expect(vm.cta?.variant).toBe('nueva-venta')
  })

  // Mixed timeline ordering
  it('rows are sorted chronologically by start time', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a-late',
            status: 'CONFIRMED',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c1', fullName: 'Late', email: null, phone: null },
            items: [{ label: 'x', priceCents: 0, qty: 1 }],
            startAt: '2026-05-04T15:00:00Z',
          } as unknown as Appointment,
          {
            id: 'a-early',
            status: 'CONFIRMED',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c2', fullName: 'Early', email: null, phone: null },
            items: [{ label: 'y', priceCents: 0, qty: 1 }],
            startAt: '2026-05-04T11:00:00Z',
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.rows[0].customerName).toBe('Early')
    expect(vm.rows[1].customerName).toBe('Late')
  })

  // Customer initials
  it('computes initials from customer fullName when no photo', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a1',
            status: 'CONFIRMED',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: { id: 'c1', fullName: 'Pedro Soto', email: null, phone: null, photoUrl: null },
            items: [{ label: 'x', priceCents: 0, qty: 1 }],
            startAt: '2026-05-04T13:00:00Z',
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.rows[0].customerInitials).toBe('PS')
    expect(vm.rows[0].customerPhotoUrl).toBeNull()
  })

  it('uses customer.photoUrl when available', () => {
    const vm = deriveHoyViewModel(
      baseInput({
        appointments: [
          {
            id: 'a1',
            status: 'CONFIRMED',
            staffUser: { id: STAFF_ID, fullName: 'Eli' },
            customer: {
              id: 'c1',
              fullName: 'Pedro Soto',
              email: null,
              phone: null,
              photoUrl: 'https://example.com/p.jpg',
            },
            items: [{ label: 'x', priceCents: 0, qty: 1 }],
            startAt: '2026-05-04T13:00:00Z',
          } as unknown as Appointment,
        ],
      }),
    )
    expect(vm.rows[0].customerPhotoUrl).toBe('https://example.com/p.jpg')
  })
})
