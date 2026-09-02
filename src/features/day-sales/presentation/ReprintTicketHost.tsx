import { useLocation } from '@/core/location/useLocation'
import { PrintableTicket } from '@/features/checkout/presentation/PrintableTicket'
import type { DaySale } from '../domain/day-sales.types'

/** Ticket térmico de la venta a reimprimir (ver `useReprintTicket`). */
export function ReprintTicketHost({ sale }: { sale: DaySale | null }) {
  const { locationName, locationTimezone } = useLocation()
  if (!sale) return null
  return (
    <PrintableTicket
      sale={{
        id: sale.id,
        totalCents: sale.totalCents,
        tipCents: sale.tipCents,
        payments: sale.payments.map((p) => ({
          provider: p.provider as 'CASH' | 'CARD_TERMINAL' | 'TRANSFER',
          amountCents: p.amountCents,
        })),
        createdAt: sale.createdAt,
        customer: sale.customer ? { ...sale.customer, email: null } : null,
        items: sale.items,
      }}
      locationName={locationName}
      timezone={locationTimezone}
      reprint
    />
  )
}
