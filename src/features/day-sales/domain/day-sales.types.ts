import type {
  SaleTicketItem,
  SaleTicketPayment,
  SaleTicketDiscount,
  SaleTicketCustomer,
} from '@/features/checkout/presentation/SaleTicketBody'

export type DaySaleStatus = 'PAID' | 'VOID' | 'REFUNDED'

export interface DaySaleBarber {
  id: string
  fullName: string
}

/**
 * Una venta del día de la sucursal, ya en la forma que consumen la lista,
 * `SaleTicketBody` y `PrintableTicket`. Inmutable: una venta cerrada no cambia
 * (salvo su `status` al anularse, que llega por refetch).
 */
export interface DaySale {
  id: string
  createdAt: string
  status: DaySaleStatus
  subtotalCents: number
  taxTotalCents: number
  totalCents: number
  /** Suma de líneas TIP (ya incluida en `totalCents`); no aparece en `items`. */
  tipCents: number
  customer: SaleTicketCustomer | null
  /** Staff que registró la venta (cajero). Puede no haber realizado líneas. */
  sellerStaffUserId: string | null
  items: SaleTicketItem[]
  payments: SaleTicketPayment[]
  discounts: SaleTicketDiscount[]
  /** Barberos únicos que realizaron al menos una línea (orden de aparición). */
  barbers: DaySaleBarber[]
}

/** Etiqueta visible por status. PAID no lleva marca. */
export const DAY_SALE_STATUS_LABEL: Record<DaySaleStatus, string | null> = {
  PAID: null,
  VOID: 'Anulada',
  REFUNDED: 'Reembolsada',
}
