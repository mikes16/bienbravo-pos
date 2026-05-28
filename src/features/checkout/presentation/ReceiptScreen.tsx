import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { formatMoney } from '@/shared/lib/money'
import { PrintableTicket } from './PrintableTicket'

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

interface ReceiptScreenProps {
  sale: SaleData
  onListo: () => void
  /** Nombre de la sucursal del POS — se imprime en el header del ticket. */
  locationName?: string | null
  /** Nombre del operador (viewer) — se imprime en la meta del ticket. */
  operatorName?: string | null
}

const PROVIDER_LABEL: Record<ApiProvider, string> = {
  CASH: 'Efectivo',
  CARD_TERMINAL: 'Tarjeta',
  TRANSFER: 'Transferencia',
}

function formatPayments(payments: PaymentEntry[]): string {
  if (payments.length === 1) {
    return PROVIDER_LABEL[payments[0].provider]
  }
  return payments
    .map((p) => `${PROVIDER_LABEL[p.provider]} ${formatMoney(p.amountCents)}`)
    .join(' + ')
}

function formatDateTimeMx(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/Monterrey',
  })
}

export function ReceiptScreen({
  sale,
  onListo,
  locationName = null,
  operatorName = null,
}: ReceiptScreenProps) {
  return (
    <div className="flex h-full flex-col bg-[var(--color-carbon-elevated)]">
      {/* Action bar — hidden on print */}
      <div className="flex items-center justify-end gap-2 border-b border-[var(--color-leather-muted)]/40 px-6 py-3">
        <TouchButton variant="secondary" size="min" onClick={() => window.print()} className="rounded-none">
          Imprimir
        </TouchButton>
        <TouchButton variant="secondary" size="min" disabled title="Próximamente (sub-#4c)" className="rounded-none">
          Enviar por correo
        </TouchButton>
        <TouchButton variant="primary" size="min" onClick={onListo} className="rounded-none">
          Listo
        </TouchButton>
      </div>

      {/* On-screen receipt preview — solo visible en pantalla. La impresión
          usa el componente PrintableTicket de abajo, que se hace visible vía
          @media print. */}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 py-6">
        <div className="text-center">
          <p className="font-[var(--font-pos-display)] text-[20px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
            BienBravo
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
            {formatDateTimeMx(sale.createdAt)}
          </p>
        </div>

        <div className="border-y border-[var(--color-leather-muted)]/40 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">Cliente</p>
          <p className="text-[14px] text-[var(--color-bone)]">{sale.customer?.fullName ?? 'Mostrador'}</p>
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

        <div className="flex items-baseline justify-between border-t border-[var(--color-leather-muted)]/40 pt-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">Total</span>
          <span className="font-[var(--font-pos-display)] text-[24px] font-extrabold tabular-nums leading-none text-[var(--color-bone)]">
            {formatMoney(sale.totalCents)}
          </span>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
          Pagado con {formatPayments(sale.payments)}
        </p>

        <p className="mt-auto text-center font-mono text-[10px] text-[var(--color-bone-muted)]">
          ¡Gracias por tu visita!
        </p>
      </div>

      {/* Ticket de impresión térmica — display: none en pantalla, visible
          solo cuando window.print() activa @media print. */}
      <PrintableTicket sale={sale} locationName={locationName} operatorName={operatorName} />
    </div>
  )
}
