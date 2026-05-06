import { TouchButton } from '@/shared/pos-ui/TouchButton'

export interface ActiveServiceItem {
  kind: 'appointment' | 'walk-in'
  id: string
  customerName: string
  barberName: string | null
  serviceLabel: string
}

interface ActiveServicesBlockerProps {
  open: boolean
  items: ActiveServiceItem[]
  onClose: () => void
}

export function ActiveServicesBlocker({ open, items, onClose }: ActiveServicesBlockerProps) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label="Servicios activos"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto border-t border-[var(--color-bravo)] bg-[var(--color-carbon-elevated)] sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--color-leather-muted)]/40 px-5 py-4">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">
            No puedes cerrar caja todavía
          </span>
          <p className="text-[14px] leading-snug text-[var(--color-bone)]">
            Hay {items.length === 1 ? 'un servicio activo' : `${items.length} servicios activos`} en piso. Cobra o termina cada uno desde Hoy antes de cerrar caja.
          </p>
        </div>

        <ul className="flex flex-col">
          {items.map((it) => (
            <li
              key={`${it.kind}-${it.id}`}
              className="flex items-center justify-between border-b border-[var(--color-leather-muted)]/30 px-5 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[14px] font-bold text-[var(--color-bone)]">
                  {it.customerName}
                </span>
                <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-bone-muted)]">
                  {it.serviceLabel}
                  {it.barberName ? ` · ${it.barberName}` : ''}
                </span>
              </div>
              <span
                className={
                  'shrink-0 border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em] ' +
                  (it.kind === 'walk-in'
                    ? 'border-[var(--color-leather)] text-[var(--color-leather)]'
                    : 'border-[var(--color-bravo)] text-[var(--color-bravo)]')
                }
              >
                {it.kind === 'walk-in' ? 'Walk-in' : 'En servicio'}
              </span>
            </li>
          ))}
        </ul>

        <div className="border-t border-[var(--color-leather-muted)]/40 px-5 py-4">
          <TouchButton
            variant="primary"
            size="primary"
            onClick={onClose}
            className="w-full rounded-none uppercase tracking-[0.06em]"
          >
            Entendido
          </TouchButton>
        </div>
      </div>
    </div>
  )
}
