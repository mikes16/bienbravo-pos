import { useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { formatDateTimeInTz } from '@/shared/lib/date'
import { useLocation } from '@/core/location/useLocation'
import { TouchButton } from '@/shared/pos-ui'
import { SaleTicketBody } from '@/features/checkout/presentation/SaleTicketBody'
import { DAY_SALE_STATUS_LABEL, type DaySale } from '../domain/day-sales.types'

interface DaySaleSheetProps {
  sale: DaySale | null
  onClose: () => void
  onReprint: (sale: DaySale) => void
}

const EXIT_MS = 240

/**
 * Bottom sheet con el ticket completo de una venta del día + "Reimprimir".
 * No hace fetch: la venta ya viene cargada de la lista. Misma animación
 * enter/exit que `SaleDetailSheet` (pos-sheet-up/down), manteniendo el
 * sheet montado `EXIT_MS` al cerrar para que corra la salida.
 */
export function DaySaleSheet({ sale, onClose, onReprint }: DaySaleSheetProps) {
  const { locationTimezone } = useLocation()
  const open = sale !== null
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  // Conserva la última venta durante la animación de salida (derived state:
  // setState durante render es el patrón de React para esto, no un ref).
  const [shown, setShown] = useState<DaySale | null>(sale)
  if (sale && sale !== shown) setShown(sale)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
      setClosing(false)
      setMounted(true)
    } else if (mounted) {
      setClosing(true)
      closeTimer.current = setTimeout(() => {
        setMounted(false)
        setClosing(false)
      }, EXIT_MS)
    }
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current)
        closeTimer.current = null
      }
    }
  }, [open, mounted])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!mounted || !shown) return null
  const statusLabel = DAY_SALE_STATUS_LABEL[shown.status]
  const canReprint = shown.status === 'PAID'

  return (
    <div
      role="dialog"
      aria-label="Ticket de venta"
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center bg-black/70',
        closing ? 'animate-[pos-fade-out_240ms_ease-in_forwards]' : 'animate-[pos-fade-in_200ms_ease-out]',
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          'flex max-h-[88vh] w-full max-w-md flex-col border-t border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)]',
          closing
            ? 'animate-[pos-sheet-down_240ms_ease-in_forwards]'
            : 'animate-[pos-sheet-up_280ms_cubic-bezier(0.16,1,0.3,1)]',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-leather-muted)]/40 px-6 py-4">
          <div>
            <p className="font-[var(--font-pos-display)] text-[18px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
              Ticket de venta
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
              {formatDateTimeInTz(shown.createdAt, locationTimezone)}
              {statusLabel && (
                <span className="ml-2 text-[var(--color-bravo)]">· {statusLabel}</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="cursor-pointer px-3 py-2 font-mono text-[18px] leading-none text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          <SaleTicketBody sale={shown} />
        </div>

        <div className="border-t border-[var(--color-leather-muted)]/40 px-6 py-4">
          <TouchButton
            variant="primary"
            size="secondary"
            className="w-full rounded-none"
            disabled={!canReprint}
            title={canReprint ? undefined : `No se reimprime una venta ${statusLabel?.toLowerCase()}`}
            onClick={() => onReprint(shown)}
          >
            Reimprimir ticket
          </TouchButton>
          {!canReprint && (
            <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
              Venta {statusLabel?.toLowerCase()} — sin reimpresión
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
