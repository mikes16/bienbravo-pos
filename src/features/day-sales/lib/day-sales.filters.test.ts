import { describe, it, expect } from 'vitest'
import { barbersInSales, filterByBarber, totalsOf } from './day-sales.filters'
import type { DaySale } from '../domain/day-sales.types'

const ANA = { id: 'b-ana', fullName: 'Ana' }
const BETO = { id: 'b-beto', fullName: 'Beto' }
const CARLA = { id: 'b-carla', fullName: 'Carla' }

function sale(over: Partial<DaySale> & { id: string }): DaySale {
  return {
    createdAt: '2026-09-02T16:00:00.000Z',
    status: 'PAID',
    subtotalCents: 10000,
    taxTotalCents: 0,
    totalCents: 10000,
    tipCents: 0,
    customer: null,
    sellerStaffUserId: null,
    items: [],
    payments: [],
    discounts: [],
    barbers: [],
    ...over,
  }
}

const MULTI = sale({ id: 's-multi', barbers: [BETO, ANA], sellerStaffUserId: BETO.id, totalCents: 27000 })
const ONLY_ANA = sale({ id: 's-ana', barbers: [ANA], sellerStaffUserId: ANA.id, totalCents: 7000 })
const SOLD_BY_CARLA = sale({ id: 's-carla', barbers: [BETO], sellerStaffUserId: CARLA.id })
const VOIDED = sale({ id: 's-void', status: 'VOID', barbers: [ANA], totalCents: 99900 })

describe('day-sales filters', () => {
  it('barbersInSales lists each performer once, alphabetically', () => {
    expect(barbersInSales([MULTI, ONLY_ANA, SOLD_BY_CARLA])).toEqual([ANA, BETO])
  })

  it('filterByBarber keeps a multi-barber ticket for every barber who performed a line', () => {
    expect(filterByBarber([MULTI, ONLY_ANA, SOLD_BY_CARLA], ANA.id).map((s) => s.id)).toEqual(['s-multi', 's-ana'])
    expect(filterByBarber([MULTI, ONLY_ANA, SOLD_BY_CARLA], BETO.id).map((s) => s.id)).toEqual(['s-multi', 's-carla'])
  })

  it('filterByBarber also matches the seller even if they performed no line', () => {
    expect(filterByBarber([MULTI, ONLY_ANA, SOLD_BY_CARLA], CARLA.id).map((s) => s.id)).toEqual(['s-carla'])
  })

  it('filterByBarber with null returns everything', () => {
    expect(filterByBarber([MULTI, ONLY_ANA], null)).toHaveLength(2)
  })

  it('totalsOf counts and sums PAID only', () => {
    expect(totalsOf([MULTI, ONLY_ANA, VOIDED])).toEqual({ paidCount: 2, paidTotalCents: 34000, voidedCount: 1 })
  })
})
