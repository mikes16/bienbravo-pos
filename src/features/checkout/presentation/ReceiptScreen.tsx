import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { PrintableTicket } from './PrintableTicket'
import { SaleTicketBody } from './SaleTicketBody'

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

        <SaleTicketBody sale={sale} />

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
