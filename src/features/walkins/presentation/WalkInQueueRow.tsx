import { useEffect, useRef, useState } from 'react'
import type { WalkIn } from '../domain/walkins.types.ts'

type Props = {
  walkIn: WalkIn
  position: number
  canReorder: boolean
  canPause: boolean
  canAssign: boolean
  canNoShow: boolean
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onAssign: () => void
  onPause: () => void
  onResume: () => void
  onMarkNoShow: () => void
  onCancel: () => void
}

function waitMin(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
}

/**
 * One row of the walk-in queue: position, customer name, requested
 * service, total wait, preferred-barber annotation, and the row's
 * action bar (Asignar/Pausar or Reanudar) plus an overflow menu with
 * destructive actions (no-show / cancel).
 *
 * The reorder column (↑↓) only renders when `canReorder` is true so
 * non-supervisor roles see a tighter row without empty controls.
 */
export function WalkInQueueRow({
  walkIn,
  position,
  canReorder,
  canPause,
  canAssign,
  canNoShow,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onAssign,
  onPause,
  onResume,
  onMarkNoShow,
  onCancel,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const isPaused = !!walkIn.pausedAt
  const pausedMin = walkIn.pausedAt ? waitMin(walkIn.pausedAt) : 0
  const totalWait = waitMin(walkIn.createdAt)
  const customerName = walkIn.customer?.fullName ?? walkIn.customerName ?? 'Cliente'
  const serviceLabel =
    walkIn.requestedService?.name ?? walkIn.requestedCatalogCombo?.name ?? '—'
  const preferredName = walkIn.preferredStaffUser?.fullName ?? null

  // Close the [⋯] menu on outside click. Cheap solution: a doc-level
  // listener that disengages once the menu is closed.
  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  return (
    <div
      className={`flex items-center gap-3 border-b border-[var(--color-leather-muted)]/20 px-3 py-3 ${
        isPaused ? 'bg-[var(--color-warning)]/5' : ''
      }`}
    >
      {canReorder && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={isFirst}
            onClick={onMoveUp}
            className="cursor-pointer text-[var(--color-bone-muted)] hover:text-[var(--color-bone)] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Subir"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={onMoveDown}
            className="cursor-pointer text-[var(--color-bone-muted)] hover:text-[var(--color-bone)] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Bajar"
          >
            ↓
          </button>
        </div>
      )}

      <div className="w-6 text-right font-mono text-xs text-[var(--color-bone-muted)]">
        #{position}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-[var(--color-bone)]">{customerName}</div>
        <div className="truncate text-xs text-[var(--color-bone-muted)]">
          {serviceLabel} · {totalWait}min
          {preferredName ? (
            <span className="ml-2">→ {preferredName} (preferido)</span>
          ) : (
            <span className="ml-2 italic">sin preferencia</span>
          )}
        </div>
      </div>

      {isPaused && (
        <span className="border border-[var(--color-warning)] bg-[var(--color-warning)]/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-warning)]">
          Pausado {pausedMin}min
        </span>
      )}

      <div className="flex items-center gap-2">
        {isPaused ? (
          canPause && (
            <button
              type="button"
              onClick={onResume}
              className="cursor-pointer bg-[var(--color-leather)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone)]"
            >
              Reanudar
            </button>
          )
        ) : (
          <>
            {canAssign && (
              <button
                type="button"
                onClick={onAssign}
                className="cursor-pointer bg-[var(--color-bravo)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone)]"
              >
                Asignar
              </button>
            )}
            {canPause && (
              <button
                type="button"
                onClick={onPause}
                className="cursor-pointer bg-[var(--color-leather)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone)]"
              >
                Pausar
              </button>
            )}
          </>
        )}

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="cursor-pointer px-2 text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
            aria-label="Más acciones"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-10 mt-1 min-w-[160px] border border-[var(--color-leather-muted)] bg-[var(--color-carbon)]"
            >
              {canNoShow && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onMarkNoShow()
                  }}
                  className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-[var(--color-bone)] hover:bg-[var(--color-cuero-viejo)]"
                >
                  Marcar no-show
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onCancel()
                }}
                className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-[var(--color-warning)] hover:bg-[var(--color-cuero-viejo)]"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
