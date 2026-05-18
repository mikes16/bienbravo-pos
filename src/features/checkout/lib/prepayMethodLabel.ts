import { PaymentProvider } from '@/core/graphql/generated/graphql'

/**
 * Etiqueta legible para el método de prepago mostrado en CheckoutPage cuando
 * la cita ya fue cobrada por adelantado (admin manual o Stripe link). Mapea
 * el enum `PaymentProvider` del API a texto en español.
 *
 * Si el provider no se reconoce (por ejemplo por un schema más nuevo), se
 * devuelve el valor crudo en mayúsculas para no romper el render — el cajero
 * verá algo aún si la lista local se quedó atrás.
 */
const LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CARD_TERMINAL: 'Tarjeta (terminal)',
  STRIPE: 'Stripe (link)',
  MERCADOPAGO: 'Mercado Pago',
  PAYPAL: 'PayPal',
  OTHER: 'Otro',
}

export function prepayMethodLabel(
  provider: PaymentProvider | string | null | undefined,
): string {
  if (!provider) return ''
  return LABELS[provider] ?? String(provider)
}
