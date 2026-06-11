import { useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import { SaleTicketBody } from '@/features/checkout/presentation/SaleTicketBody'
import type { SaleDetail } from '@/features/checkout/data/checkout.repository.ts'

interface SaleDetailSheetProps {
  open: boolean
  /** Id de la venta a mostrar. Puede ser undefined cuando no hay target;
   *  el fetch solo dispara con un id presente y el sheet abierto. */
  saleId?: string | null
  /**
   * Comisión del viewer para ESTA venta ("Tu parte"). Si es null/undefined
   * la línea se omite — algunas ventas no tienen comisión atribuida al
   * viewer (p.ej. una venta de otro barbero abierta por el dueño).
   */
  tuParteCents?: number | null
  onClose: () => void
}

const EXIT_MS = 240

function formatDateTimeMx(iso: string): string {
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

/**
 * Bottom sheet con el desglose completo de una venta del día — items,
 * descuentos, total, forma de pago — más "Tu parte: $X" (la comisión del
 * viewer para esa venta).
 *
 * El cuerpo del ticket se renderiza con `SaleTicketBody`, el mismo componente
 * que usa `ReceiptScreen` (DRY). Este sheet solo añade la sección de
 * descuentos (vía `SaleTicketBody`) y la línea de comisión.
 *
 * Animación enter/exit con las keyframes `pos-sheet-up` / `pos-sheet-down`
 * de index.css. Al cerrar mantenemos el sheet montado por `EXIT_MS` para que
 * la animación de salida corra antes de desmontar (patrón de bottom sheet
 * animado requerido por el POS).
 *
 * NOTA de seguridad: el permiso `pos.sale.read` se gatea en dos lugares —
 * el API rechaza el resolver `sale(id)` sin él, y MyDayPage no hace la row
 * clickable (no abre este sheet) si el viewer no lo tiene. Este componente
 * asume que el caller ya validó el permiso.
 */
export function SaleDetailSheet({ open, saleId, tuParteCents, onClose }: SaleDetailSheetProps) {
  const { checkout } = useRepositories()
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  const [detail, setDetail] = useState<SaleDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Montaje/desmontaje con animación de salida. Cuando `open` pasa a true
  // montamos inmediatamente (entra con pos-sheet-up). Cuando pasa a false,
  // marcamos `closing` para correr pos-sheet-down y desmontamos tras EXIT_MS.
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

  // Escape-to-close: listener barato montado solo mientras el sheet está
  // abierto. No es un focus-trap completo (fuera de scope para este POS
  // touch-first) — solo cierra con Escape, espejando el backdrop-click y el
  // botón ×. Se limpia al cerrar/desmontar.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // Fetch del detalle cada vez que se abre con un saleId. cache-first en el
  // repo hace que reabrir la misma venta sea instantáneo.
  useEffect(() => {
    if (!open || !saleId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setDetail(null)
    checkout
      .getSaleDetail(saleId)
      .then((d) => {
        if (cancelled) return
        if (!d) {
          setError('No se encontró el detalle de esta venta.')
          return
        }
        setDetail(d)
      })
      .catch(() => {
        if (cancelled) return
        setError('No se pudo cargar el detalle. Intenta de nuevo.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, saleId, checkout])

  if (!mounted) return null

  return (
    <div
      role="dialog"
      aria-label="Detalle de venta"
      aria-busy={loading}
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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-leather-muted)]/40 px-6 py-4">
          <div>
            <p className="font-[var(--font-pos-display)] text-[18px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
              Detalle de venta
            </p>
            {detail && (
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
                {formatDateTimeMx(detail.createdAt)}
              </p>
            )}
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

        {/* Body */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex flex-col gap-3" aria-hidden>
              <div className="h-10 animate-pulse bg-[var(--color-cuero-viejo)]/30" />
              <div className="h-6 w-2/3 animate-pulse bg-[var(--color-cuero-viejo)]/30" />
              <div className="h-6 w-1/2 animate-pulse bg-[var(--color-cuero-viejo)]/30" />
              <div className="h-12 animate-pulse bg-[var(--color-cuero-viejo)]/30" />
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              className="border border-[var(--color-bravo)]/50 bg-[var(--color-bravo)]/[0.08] px-4 py-3"
            >
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">
                Error
              </p>
              <p className="mt-1 text-[13px] text-[var(--color-bone)]">{error}</p>
            </div>
          )}

          {!loading && !error && detail && (
            <>
              <SaleTicketBody sale={detail} />

              {tuParteCents != null && (
                <div className="flex items-baseline justify-between border-t border-[var(--color-bravo)]/40 pt-3">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">
                    Tu parte
                  </span>
                  <span className="font-[var(--font-pos-display)] text-[26px] font-extrabold tabular-nums leading-none text-[var(--color-bone)]">
                    {formatMoney(tuParteCents)}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
