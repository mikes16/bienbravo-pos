import { describe, it, expect } from 'vitest'
import { cartReducer, computeTotals, creditedBarberIds, findUnavailableCreditedBarberId, initialCart } from './cart'
import type { CartLine } from './cart'

const SERVICE_ITEM = {
  kind: 'service' as const,
  itemId: 'svc-1',
  name: 'Corte',
  unitPriceCents: 28000,
}
const PRODUCT_ITEM = {
  kind: 'product' as const,
  itemId: 'prod-1',
  name: 'Shampoo',
  unitPriceCents: 25000,
}

describe('cart reducer', () => {
  it('add appends a new line with qty=1 + default barber', () => {
    const state = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    expect(state.lines.length).toBe(1)
    expect(state.lines[0].qty).toBe(1)
    expect(state.lines[0].staffUserId).toBe('barber-1')
    expect(state.lines[0].itemId).toBe('svc-1')
  })

  it('add respeta lineId explícito', () => {
    const s = cartReducer(initialCart('barber-1'), {
      type: 'add',
      lineId: 'line-x',
      item: { kind: 'service', itemId: 'svc1', name: 'Corte', unitPriceCents: 20000, categoryId: null },
    })
    expect(s.lines[0].id).toBe('line-x')
  })

  it('add of same item creates a new line (multi-barber support)', () => {
    const a = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    const b = cartReducer(a, { type: 'add', item: SERVICE_ITEM })
    expect(b.lines.length).toBe(2)
  })

  it('incQty bumps qty', () => {
    const a = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    const b = cartReducer(a, { type: 'incQty', lineId: a.lines[0].id })
    expect(b.lines[0].qty).toBe(2)
  })

  it('decQty decrements; reaches 0 removes line', () => {
    const a = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    const b = cartReducer(a, { type: 'decQty', lineId: a.lines[0].id })
    expect(b.lines.length).toBe(0)
  })

  it('removeLine removes specified line, keeps others', () => {
    let s = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'add', item: PRODUCT_ITEM })
    s = cartReducer(s, { type: 'removeLine', lineId: s.lines[0].id })
    expect(s.lines.length).toBe(1)
    expect(s.lines[0].itemId).toBe('prod-1')
  })

  it('setLineBarber updates barber on specified line only', () => {
    let s = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'setLineBarber', lineId: s.lines[1].id, staffUserId: 'barber-2' })
    expect(s.lines[0].staffUserId).toBe('barber-1')
    expect(s.lines[1].staffUserId).toBe('barber-2')
  })

  it('clearLineBarber deja la línea sin asignar (null) sin tocar otras', () => {
    let s = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'clearLineBarber', lineId: s.lines[1].id })
    expect(s.lines[0].staffUserId).toBe('barber-1')
    expect(s.lines[1].staffUserId).toBeNull()
  })

  it('setDefaultBarber changes default for future adds, not existing lines', () => {
    let s = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'setDefaultBarber', staffUserId: 'barber-2' })
    expect(s.lines[0].staffUserId).toBe('barber-1')
    s = cartReducer(s, { type: 'add', item: PRODUCT_ITEM })
    expect(s.lines[1].staffUserId).toBe('barber-2')
  })

  it('setCustomer assigns', () => {
    const c = { id: 'c1', fullName: 'Carlos' } as any
    const s = cartReducer(initialCart('b'), { type: 'setCustomer', customer: c })
    expect(s.customer?.id).toBe('c1')
  })

  it('clear empties everything except defaultBarber', () => {
    let s = cartReducer(initialCart('b'), { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'setCustomer', customer: { id: 'c1', fullName: 'X' } as any })
    s = cartReducer(s, { type: 'clear' })
    expect(s.lines.length).toBe(0)
    expect(s.customer).toBeNull()
    expect(s.defaultBarberId).toBe('b')
  })
})

describe('computeTotals', () => {
  it('returns 0 for empty cart', () => {
    expect(computeTotals([]).subtotalCents).toBe(0)
  })

  it('sums lines correctly', () => {
    const lines: CartLine[] = [
      { id: '1', kind: 'service', itemId: 'a', name: 'A', qty: 2, unitPriceCents: 28000, staffUserId: null },
      { id: '2', kind: 'product', itemId: 'b', name: 'B', qty: 1, unitPriceCents: 25000, staffUserId: null },
    ]
    expect(computeTotals(lines).subtotalCents).toBe(81000)
  })
})

// A1: "al cobrar, solo puedas asignar barberos con sesión activa que ya
// iniciaron su día." — re-validación en el momento de cobrar, no solo en el
// picker de UI.
describe('creditedBarberIds', () => {
  it('includes the default barber even with no lines', () => {
    const s = initialCart('barber-1')
    expect(creditedBarberIds(s)).toEqual(['barber-1'])
  })

  it('includes per-line overrides plus the default for lines without one', () => {
    let s = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'add', item: PRODUCT_ITEM })
    s = cartReducer(s, { type: 'setLineBarber', lineId: s.lines[1].id, staffUserId: 'barber-2' })
    expect(creditedBarberIds(s).sort()).toEqual(['barber-1', 'barber-2'])
  })

  it('omits null/empty default when no barber is set', () => {
    const s = initialCart('')
    expect(creditedBarberIds(s)).toEqual([])
  })
})

describe('findUnavailableCreditedBarberId', () => {
  const CLOCKED_IN = [
    { id: 'barber-1', hasClockedIn: true },
    { id: 'barber-2', hasClockedIn: true },
  ]

  it('returns null when every credited barber is clocked in', () => {
    let s = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'setDefaultBarber', staffUserId: 'barber-2' })
    expect(findUnavailableCreditedBarberId(s, CLOCKED_IN)).toBeNull()
  })

  it('blocks when the default barber has clocked out', () => {
    const s = initialCart('barber-1')
    const barbers = [{ id: 'barber-1', hasClockedIn: false }]
    expect(findUnavailableCreditedBarberId(s, barbers)).toBe('barber-1')
  })

  it('blocks when a per-line override barber has clocked out, even if the default is fine', () => {
    let s = cartReducer(initialCart('barber-1'), { type: 'add', item: SERVICE_ITEM })
    s = cartReducer(s, { type: 'setLineBarber', lineId: s.lines[0].id, staffUserId: 'barber-2' })
    const barbers = [
      { id: 'barber-1', hasClockedIn: true },
      { id: 'barber-2', hasClockedIn: false },
    ]
    expect(findUnavailableCreditedBarberId(s, barbers)).toBe('barber-2')
  })

  it('blocks when the credited barber is not in the available roster at all', () => {
    const s = initialCart('ghost-barber')
    expect(findUnavailableCreditedBarberId(s, CLOCKED_IN)).toBe('ghost-barber')
  })

  it('allows a barber with no hasClockedIn info (undefined), same rule as the picker gate', () => {
    const s = initialCart('barber-3')
    const barbers = [{ id: 'barber-3' }]
    expect(findUnavailableCreditedBarberId(s, barbers)).toBeNull()
  })

  it('returns null for an empty cart with no default barber', () => {
    const s = initialCart('')
    expect(findUnavailableCreditedBarberId(s, CLOCKED_IN)).toBeNull()
  })
})
