import { describe, it, expect } from 'vitest'
import { emptyCashCounts, totalCountedCents, type CashCounts } from './cashCounts'

describe('cashCounts', () => {
  it('emptyCashCounts returns all zero fields', () => {
    expect(emptyCashCounts()).toEqual({
      d500: 0, d200: 0, d100: 0, d50: 0, d20: 0, coinsCents: 0,
    })
  })

  it('totalCountedCents sums denominations correctly', () => {
    const c: CashCounts = { d500: 1, d200: 2, d100: 3, d50: 4, d20: 5, coinsCents: 1000 }
    // 50000 + 40000 + 30000 + 20000 + 10000 + 1000 = 151000
    expect(totalCountedCents(c)).toBe(151000)
  })

  it('totalCountedCents on empty is 0', () => {
    expect(totalCountedCents(emptyCashCounts())).toBe(0)
  })

  it('totalCountedCents handles only coins', () => {
    expect(totalCountedCents({ ...emptyCashCounts(), coinsCents: 4500 })).toBe(4500)
  })
})
