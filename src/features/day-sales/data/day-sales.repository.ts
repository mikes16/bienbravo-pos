import type { ApolloClient } from '@apollo/client'
import { graphql } from '@/core/graphql/generated'
import type { PosDaySalesQuery } from '@/core/graphql/generated/graphql'
import type { DaySale, DaySaleBarber, DaySaleStatus } from '../domain/day-sales.types'
import type { SaleTicketItem } from '@/features/checkout/presentation/SaleTicketBody'

/**
 * Ventas del día de la sucursal. Gateado en el API por `pos.sales.day.read`
 * (+ scope de sucursal); el POS ni muestra el tab sin ese permiso.
 */
export const POS_DAY_SALES = graphql(`
  query PosDaySales($locationId: ID!, $date: String!) {
    posDaySales(locationId: $locationId, date: $date) {
      id
      createdAt
      status
      subtotalCents
      taxTotalCents
      totalCents
      staffUserId
      customer { id fullName }
      payments { provider amountCents }
      items { id itemType qty unitPriceCents totalCents name staffUser { id fullName } }
      couponApplications { code name discountAmountCents }
    }
  }
`)

export interface DaySalesRepository {
  /**
   * `date` en YYYY-MM-DD local de la sucursal.
   *
   * SIEMPRE va a la red (`network-only`). Regla del dueño (18 sep 2026):
   * el dinero nunca se muestra desde la memoria guardada — con varias iPads
   * cobrando a la vez, un total guardado está mal en cuanto otra cobra (R8).
   * Por eso no hay parámetro para elegir la política: no existe una lectura
   * legítima de ventas que se sirva sin preguntarle al servidor.
   */
  getDaySales(locationId: string, date: string): Promise<DaySale[]>
}

const ITEM_TYPE_FALLBACK: Record<string, string> = {
  SERVICE: 'Servicio',
  PRODUCT: 'Producto',
  TIP: 'Propina',
}

type ApiSale = PosDaySalesQuery['posDaySales'][number]

export function mapDaySale(sale: ApiSale): DaySale {
  // La propina vive como líneas TIP (una por barbero): se suma y se saca de
  // los conceptos, igual que en el detalle de Mi Día.
  const tipCents = sale.items
    .filter((it) => it.itemType === 'TIP')
    .reduce((sum, it) => sum + it.totalCents, 0)

  const items: SaleTicketItem[] = sale.items
    .filter((it) => it.itemType !== 'TIP')
    .map((it) => ({
      id: it.id,
      name: it.name ?? ITEM_TYPE_FALLBACK[it.itemType] ?? 'Concepto',
      qty: it.qty,
      unitPriceCents: it.unitPriceCents,
      totalCents: it.totalCents,
      staffUser: it.staffUser ? { id: it.staffUser.id, fullName: it.staffUser.fullName } : null,
    }))

  const barbers: DaySaleBarber[] = []
  for (const it of sale.items) {
    if (it.staffUser && !barbers.some((b) => b.id === it.staffUser!.id)) {
      barbers.push({ id: it.staffUser.id, fullName: it.staffUser.fullName })
    }
  }

  return {
    id: sale.id,
    createdAt: sale.createdAt,
    status: sale.status as DaySaleStatus,
    subtotalCents: sale.subtotalCents,
    taxTotalCents: sale.taxTotalCents,
    totalCents: sale.totalCents,
    tipCents,
    customer: sale.customer ? { id: sale.customer.id, fullName: sale.customer.fullName } : null,
    sellerStaffUserId: sale.staffUserId ?? null,
    items,
    payments: (sale.payments ?? []).map((p) => ({ provider: p.provider, amountCents: p.amountCents })),
    discounts: (sale.couponApplications ?? []).map((c) => ({
      code: c.code,
      name: c.name ?? null,
      discountAmountCents: c.discountAmountCents,
    })),
    barbers,
  }
}

export class ApolloDaySalesRepository implements DaySalesRepository {
  #client: ApolloClient
  constructor(client: ApolloClient) {
    this.#client = client
  }

  async getDaySales(locationId: string, date: string): Promise<DaySale[]> {
    const { data } = await this.#client.query({
      query: POS_DAY_SALES,
      variables: { locationId, date },
      // `posDaySales` es clase DINERO/SENSIBLE (core/apollo/dataClasses.ts):
      // ni se guarda en el dispositivo ni se sirve de lo ya leído.
      fetchPolicy: 'network-only',
    })
    return (data?.posDaySales ?? []).map(mapDaySale)
  }
}
