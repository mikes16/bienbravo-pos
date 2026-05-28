import { formatMoney } from '@/shared/lib/money'

interface SaleItem {
  id: string
  name: string
  qty: number
  unitPriceCents: number
  totalCents: number
  staffUser: { id: string; fullName: string } | null
}

interface CustomerLite {
  id: string
  fullName: string
  email: string | null
}

type ApiProvider = 'CASH' | 'CARD_TERMINAL' | 'TRANSFER'

interface PaymentEntry {
  provider: ApiProvider
  amountCents: number
}

interface SaleData {
  id: string
  totalCents: number
  payments: PaymentEntry[]
  createdAt: string
  customer: CustomerLite | null
  items: SaleItem[]
}

interface Props {
  sale: SaleData
  locationName?: string | null
  operatorName?: string | null
}

const PROVIDER_LABEL: Record<ApiProvider, string> = {
  CASH: 'Efectivo',
  CARD_TERMINAL: 'Tarjeta',
  TRANSFER: 'Transferencia',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Monterrey',
  })
}

/** Corto el id largo del sale a algo legible en el ticket: BB-XXXXXX. */
function shortSaleCode(id: string): string {
  const clean = id.replace(/[^a-z0-9]/gi, '').toUpperCase()
  return `BB-${clean.slice(-6)}`
}

/**
 * Ticket de impresión térmico (80mm / 302px).
 *
 * Vive siempre en el DOM pero está `display: none` por default — solo se
 * vuelve visible al imprimir via `@media print`. El resto de la app se
 * oculta en print. La voz es monospace sharp uppercase consistente con el
 * resto del sistema editorial, pero adaptada al formato ticket (black on
 * white, layout vertical denso, separadores con dashes en vez de hairlines).
 *
 * Configurado para impresoras térmicas estándar (Epson TM-T20, Star, etc.).
 * Si se imprime en hoja Letter/A4, el @page de index.css lo escala
 * razonablemente — el ticket queda al inicio de la página, no estirado.
 */
export function PrintableTicket({ sale, locationName, operatorName }: Props) {
  const code = shortSaleCode(sale.id)

  return (
    <div className="bb-print-receipt" aria-hidden>
      {/* Header */}
      <div className="bb-print-header">
        <div className="bb-print-brand">BIENBRAVO</div>
        <div className="bb-print-meta">Barbería</div>
        {locationName && <div className="bb-print-meta">{locationName}</div>}
      </div>

      <div className="bb-print-rule" />

      {/* Sale meta */}
      <div className="bb-print-meta-row">
        <span>Ticket</span>
        <span>{code}</span>
      </div>
      <div className="bb-print-meta-row">
        <span>Fecha</span>
        <span>{formatDateTime(sale.createdAt)}</span>
      </div>
      {operatorName && (
        <div className="bb-print-meta-row">
          <span>Operador</span>
          <span>{operatorName}</span>
        </div>
      )}
      <div className="bb-print-meta-row">
        <span>Cliente</span>
        <span>{sale.customer?.fullName ?? 'Mostrador'}</span>
      </div>

      <div className="bb-print-rule" />

      {/* Items */}
      <div className="bb-print-items">
        {sale.items.map((item) => (
          <div key={item.id} className="bb-print-item">
            <div className="bb-print-item-row">
              <span className="bb-print-item-name">
                {item.qty}× {item.name}
              </span>
              <span className="bb-print-item-amount">
                {formatMoney(item.totalCents)}
              </span>
            </div>
            {item.staffUser && (
              <div className="bb-print-item-staff">
                {item.staffUser.fullName}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bb-print-rule" />

      {/* Total */}
      <div className="bb-print-total">
        <span>TOTAL</span>
        <span>{formatMoney(sale.totalCents)}</span>
      </div>

      <div className="bb-print-rule" />

      {/* Payments */}
      <div className="bb-print-section-label">Pagado con</div>
      {sale.payments.map((p, idx) => (
        <div key={`${p.provider}-${idx}`} className="bb-print-meta-row">
          <span>{PROVIDER_LABEL[p.provider]}</span>
          <span>{formatMoney(p.amountCents)}</span>
        </div>
      ))}

      <div className="bb-print-rule" />

      {/* Footer */}
      <div className="bb-print-footer">
        <div>¡Gracias por tu visita!</div>
        <div>Vuelve pronto</div>
        <div className="bb-print-spacer" />
        <div className="bb-print-code">{code}</div>
      </div>
    </div>
  )
}
