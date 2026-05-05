export interface CashCounts {
  d500: number
  d200: number
  d100: number
  d50: number
  d20: number
  coinsCents: number
}

export function totalCountedCents(c: CashCounts): number {
  return (
    c.d500 * 50000 +
    c.d200 * 20000 +
    c.d100 * 10000 +
    c.d50 * 5000 +
    c.d20 * 2000 +
    c.coinsCents
  )
}
