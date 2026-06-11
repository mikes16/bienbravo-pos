import { formatMoney } from '@/shared/lib/money'

/**
 * Cuerpo presentacional compartido de un ticket de venta: cliente, items,
 * (opcional) descuentos, total y forma de pago. Lo consumen tanto
 * `ReceiptScreen` (post-cobro en checkout) como `SaleDetailSheet` (Mi Día,
 * tap en una venta). DRY — el markup vive una sola vez aquí.
 *
 * La identidad visual es "Precision Brutal" (carbón/cuero/hueso), consistente
 * con el resto del POS. El componente es puramente presentacional: no hace
 * fetching ni conoce de permisos — eso lo resuelve cada caller.
 */

/** Cubre TODO el enum `PaymentProvider` del schema, no solo los 3 que el POS
 *  emite al cobrar. Una venta cargada vía `sale(id)` puede traer STRIPE
 *  (prepago de cita), MERCADOPAGO, PAYPAL, etc., y sin esto el label saldría
 *  `undefined`. */
export type SaleProvider =
  | 'CASH'
  | 'CARD_TERMINAL'
  | 'TRANSFER'
  | 'STRIPE'
  | 'MERCADOPAGO'
  | 'PAYPAL'
  | 'OTHER'

const PROVIDER_LABEL: Record<SaleProvider, string> = {
  CASH: 'Efectivo',
  CARD_TERMINAL: 'Tarjeta',
  TRANSFER: 'Transferencia',
  STRIPE: 'Tarjeta en línea',
  MERCADOPAGO: 'Mercado Pago',
  PAYPAL: 'PayPal',
  OTHER: 'Otro',
}

function providerLabel(provider: string): string {
  return PROVIDER_LABEL[provider as SaleProvider] ?? provider
}

export interface SaleTicketItem {
  id: string
  name: string
  qty: number
  unitPriceCents: number
  totalCents: number
  staffUser: { id: string; fullName: string } | null
}

export interface SaleTicketPayment {
  provider: string
  amountCents: number
}

export interface SaleTicketDiscount {
  code: string
  name: string | null
  discountAmountCents: number
}

export interface SaleTicketCustomer {
  id: string
  fullName: string
}

export interface SaleTicketData {
  id: string
  totalCents: number
  /** Suma de los items antes de descuentos. Opcional: ReceiptScreen no lo
   *  necesita (no muestra desglose subtotal→descuento→total). */
  subtotalCents?: number | null
  payments: SaleTicketPayment[]
  customer: SaleTicketCustomer | null
  items: SaleTicketItem[]
  /** Cupones aplicados. Cuando hay alguno, se renderiza la sección de
   *  descuentos entre los items y el total. */
  discounts?: SaleTicketDiscount[]
}

function formatPayments(payments: SaleTicketPayment[]): string {
  if (payments.length === 0) return '—'
  if (payments.length === 1) {
    return providerLabel(payments[0].provider)
  }
  return payments
    .map((p) => `${providerLabel(p.provider)} ${formatMoney(p.amountCents)}`)
    .join(' + ')
}

interface SaleTicketBodyProps {
  sale: SaleTicketData
}

export function SaleTicketBody({ sale }: SaleTicketBodyProps) {
  const discounts = sale.discounts ?? []
  const hasDiscounts = discounts.length > 0

  return (
    <>
      <div className="border-y border-[var(--color-leather-muted)]/40 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Cliente
        </p>
        <p className="text-[14px] text-[var(--color-bone)]">
          {sale.customer?.fullName ?? 'Mostrador'}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {sale.items.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
            <span className="text-[14px] text-[var(--color-bone)]">
              <span className="text-[var(--color-bone-muted)]">{item.qty} ×</span> {item.name}
            </span>
            <span className="text-right tabular-nums text-[14px] font-bold text-[var(--color-bone)]">
              {formatMoney(item.totalCents)}
            </span>
            {item.staffUser && (
              <span className="col-start-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
                {item.staffUser.fullName}
              </span>
            )}
          </div>
        ))}
      </div>

      {hasDiscounts && (
        <div className="flex flex-col gap-1.5 border-t border-[var(--color-leather-muted)]/40 pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
            Descuentos
          </p>
          {discounts.map((d) => (
            <div key={d.code} className="grid grid-cols-[1fr_auto] gap-x-3">
              <span className="truncate text-[13px] text-[var(--color-bone)]">
                {d.name ?? d.code}
                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-bone-muted)]">
                  {d.code}
                </span>
              </span>
              <span className="text-right tabular-nums text-[13px] font-bold text-[var(--color-success)]">
                −{formatMoney(d.discountAmountCents)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-baseline justify-between border-t border-[var(--color-leather-muted)]/40 pt-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Total
        </span>
        <span className="font-[var(--font-pos-display)] text-[24px] font-extrabold tabular-nums leading-none text-[var(--color-bone)]">
          {formatMoney(sale.totalCents)}
        </span>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
        Pagado con {formatPayments(sale.payments)}
      </p>
    </>
  )
}
