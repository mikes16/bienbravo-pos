import type { DaySale, DaySaleBarber } from '../domain/day-sales.types'

/** Barberos que participaron en alguna venta del día — chips del filtro.
 *  Solo quienes realizaron líneas; el cajero-sin-líneas no es "barbero". */
export function barbersInSales(sales: readonly DaySale[]): DaySaleBarber[] {
  const seen = new Map<string, DaySaleBarber>()
  for (const s of sales) for (const b of s.barbers) if (!seen.has(b.id)) seen.set(b.id, b)
  return Array.from(seen.values()).sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
}

/** Una venta "es" del barbero si la registró o realizó cualquiera de sus
 *  líneas — un ticket con varios barberos aparece para cada uno. */
export function saleInvolvesBarber(sale: DaySale, barberId: string): boolean {
  return sale.sellerStaffUserId === barberId || sale.barbers.some((b) => b.id === barberId)
}

export function filterByBarber(sales: readonly DaySale[], barberId: string | null): DaySale[] {
  if (!barberId) return [...sales]
  return sales.filter((s) => saleInvolvesBarber(s, barberId))
}

export interface DaySalesTotals {
  /** Ventas cobradas (PAID). Anuladas/reembolsadas no cuentan. */
  paidCount: number
  paidTotalCents: number
  voidedCount: number
}

export function totalsOf(sales: readonly DaySale[]): DaySalesTotals {
  let paidCount = 0
  let paidTotalCents = 0
  let voidedCount = 0
  for (const s of sales) {
    if (s.status === 'PAID') {
      paidCount += 1
      paidTotalCents += s.totalCents
    } else {
      voidedCount += 1
    }
  }
  return { paidCount, paidTotalCents, voidedCount }
}
