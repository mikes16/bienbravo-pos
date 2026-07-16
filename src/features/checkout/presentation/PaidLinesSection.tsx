import { formatMoney } from '@/shared/lib/money'

export interface PaidLine {
  id: string
  name: string
  qty: number
  unitPriceCents: number
  totalCents: number
}

interface PaidLinesSectionProps {
  lines: PaidLine[]
}

/**
 * Sección read-only de las líneas YA PAGADAS de una cita prepagada. Se pinta
 * encima del carrito de extras. Cada línea muestra qty × nombre + chip PAGADO +
 * precio, SIN controles de qty / quitar / cambiar barbero: la venta prepagada
 * es inmutable desde el POS. El precio es visible (transparencia) pero NO suma
 * al "total a cobrar" — ese solo cuenta las líneas nuevas (extras).
 *
 * Vive fuera de `cartState.lines` a propósito: mantiene los totales, los
 * cupones, el submit y el gate de barberos-con-turno operando solo sobre los
 * extras, sin filtros especiales que arriesguen los flujos existentes.
 */
export function PaidLinesSection({ lines }: PaidLinesSectionProps) {
  if (lines.length === 0) return null

  return (
    <section
      aria-label="Servicios ya pagados"
      className="border-b border-[var(--color-leather-muted)]/30"
    >
      <div className="flex items-center justify-between px-4 pb-1.5 pt-3">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
          Ya pagado
        </span>
      </div>
      {lines.map((line) => (
        <div
          key={line.id}
          className="flex items-center gap-3 px-4 py-3 opacity-90"
        >
          {/* Qty — tabular nums para alinear con las filas de extras. */}
          <span className="w-6 shrink-0 text-center font-mono text-[12px] font-bold tabular-nums text-[var(--color-bone-muted)]">
            {line.qty}×
          </span>
          {/* Nombre — toma el espacio disponible. */}
          <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-[var(--color-bone)]">
            {line.name}
          </span>
          {/* Chip PAGADO — verde discreto (positivo), small-caps mono. */}
          <span className="shrink-0 border border-[var(--color-success)]/50 bg-[var(--color-success)]/[0.10] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--color-success)]">
            Pagado
          </span>
          {/* Precio — visible por transparencia, mismo peso que las filas de extras. */}
          <span className="shrink-0 text-[14px] font-extrabold tabular-nums text-[var(--color-bone)]">
            {formatMoney(line.totalCents)}
          </span>
        </div>
      ))}
    </section>
  )
}
