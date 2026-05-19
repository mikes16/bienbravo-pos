import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import { useWalkIns } from '../application/useWalkIns.ts'
import type { WalkIn, WalkInStatus } from '../domain/walkins.types.ts'
import type { BarberResult } from '@/features/checkout/data/checkout.repository.ts'
import { TouchButton, SkeletonRow } from '@/shared/pos-ui/index.ts'
import { cn } from '@/shared/lib/cn'
import { AddWalkInSheet } from './AddWalkInSheet.tsx'
import { WalkInQueueHeader } from './WalkInQueueHeader.tsx'
import { WalkInQueueRow } from './WalkInQueueRow.tsx'
import { SuggestedNextCard } from './SuggestedNextCard.tsx'

/* ── Helpers ──────────────────────────────────────────────────────────── */

function minutesAgo(isoDate: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 60_000))
}

function waitLabel(mins: number): string {
  if (mins < 1) return 'Recién llegado'
  return `${mins} min`
}

/* ── Status pill (for completed/historical rows) ──────────────────────── */

const STATUS_LABELS: Record<WalkInStatus, string> = {
  PENDING: 'Esperando',
  ASSIGNED: 'Asignado',
  DONE: 'Listo',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'No-show',
}

const STATUS_COLORS: Record<WalkInStatus, string> = {
  PENDING: 'text-[var(--color-warning)] border-[var(--color-warning)]/40',
  ASSIGNED: 'text-[var(--color-bone)] border-[var(--color-bone-muted)]/40',
  DONE: 'text-[var(--color-success)] border-[var(--color-success)]/40',
  CANCELLED: 'text-[var(--color-bone-muted)] border-[var(--color-bone-muted)]/30',
  NO_SHOW: 'text-[var(--color-warning)] border-[var(--color-warning)]/30',
}

function StatusPill({ status }: { status: WalkInStatus }) {
  return (
    <span
      className={cn(
        'border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest',
        STATUS_COLORS[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

/* ── Drop confirm overlay ─────────────────────────────────────────────── */

function DropConfirmOverlay({
  walkIn,
  onConfirm,
  onClose,
}: {
  walkIn: WalkIn
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] p-6">
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-[var(--color-bone-muted)]">
          Confirmar
        </p>
        <h3
          className="mb-6 text-xl font-bold text-[var(--color-bone)]"
          style={{ fontFamily: 'var(--font-pos-display)' }}
        >
          Quitar a {walkIn.customer?.fullName ?? walkIn.customerName ?? 'este cliente'}?
        </h3>
        <div className="flex gap-3">
          <TouchButton variant="ghost" size="row" className="flex-1" onClick={onClose} disabled={busy}>
            Cancelar
          </TouchButton>
          <TouchButton variant="danger" size="row" className="flex-1" onClick={handleConfirm} disabled={busy}>
            Sí, quitar
          </TouchButton>
        </div>
      </div>
    </div>
  )
}

/* ── Assign-to-barber overlay ─────────────────────────────────────────── */
/*
 * Opens when the operator hits "Asignar" on a row. Lists barbers that
 * are clocked in and free right now (same source as AddWalkInSheet, so
 * the rules stay in one place: clocked in + not currently in service).
 * The suggested-next card has its own pre-selected target, so it
 * bypasses this overlay.
 */

function AssignBarberOverlay({
  walkIn,
  barbers,
  onAssign,
  onClose,
}: {
  walkIn: WalkIn
  barbers: BarberResult[]
  onAssign: (staffUserId: string) => Promise<void>
  onClose: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  async function handleAssign(staffUserId: string) {
    if (busyId) return
    setBusyId(staffUserId)
    try {
      await onAssign(staffUserId)
      onClose()
    } finally {
      setBusyId(null)
    }
  }

  const free = barbers.filter((b) => b.hasClockedIn && !b.isOccupied)
  const customer = walkIn.customer?.fullName ?? walkIn.customerName ?? 'este cliente'

  return (
    <div
      role="dialog"
      aria-label="Asignar barbero"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-[var(--color-bone-muted)]">
          Asignar
        </p>
        <h3
          className="mb-4 text-xl font-bold text-[var(--color-bone)]"
          style={{ fontFamily: 'var(--font-pos-display)' }}
        >
          Asignar a {customer}
        </h3>
        {free.length === 0 ? (
          <p className="text-sm text-[var(--color-bone-muted)]">
            No hay barberos libres en este momento. Espera a que se desocupe alguno o registra
            su entrada.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {free.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => handleAssign(b.id)}
                disabled={!!busyId}
                className="cursor-pointer border border-[var(--color-leather-muted)]/60 px-3 py-3 text-left text-sm text-[var(--color-bone)] hover:bg-[var(--color-cuero-viejo)] disabled:opacity-50"
              >
                {b.fullName}
              </button>
            ))}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <TouchButton variant="ghost" size="row" onClick={onClose}>
            Cancelar
          </TouchButton>
        </div>
      </div>
    </div>
  )
}

/* ── Loading skeleton rows ────────────────────────────────────────────── */

function SkeletonQueueRow() {
  return (
    <div className="flex items-center gap-4 border-b border-[var(--color-leather-muted)]/30 px-5 py-4">
      <SkeletonRow heightPx={12} widthPercent={4} className="shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonRow heightPx={14} widthPercent={45} />
        <SkeletonRow heightPx={11} widthPercent={28} />
      </div>
      <SkeletonRow heightPx={12} widthPercent={8} className="shrink-0" />
      <SkeletonRow heightPx={20} className="w-20 shrink-0" />
      <SkeletonRow heightPx={36} className="w-16 shrink-0" />
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────── */

export function WalkInsPage() {
  const { viewer } = usePosAuth()
  const { locationId } = useLocation()
  const { checkout } = useRepositories()
  const navigate = useNavigate()
  const wi = useWalkIns(locationId)

  const [showAdd, setShowAdd] = useState(false)
  const [dropTarget, setDropTarget] = useState<WalkIn | null>(null)
  const [assignTarget, setAssignTarget] = useState<WalkIn | null>(null)
  const [allBarbers, setAllBarbers] = useState<BarberResult[]>([])
  const [selectedBarbero, setSelectedBarbero] = useState<{ id: string; name: string } | null>(null)
  const [suggestion, setSuggestion] = useState<WalkIn | null>(null)
  // Local override of the queue order while a reorder is in flight. Cleared
  // after the API confirms so the next refetch is authoritative.
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null)

  // ── Permissions (per plan): the new fine-grained walk-in permissions
  // were not yet seeded as defaults for every role in this repo. Fall
  // back to the legacy `walkins.manage` umbrella so existing operators
  // don't lose access overnight while the granular keys roll out.
  const perms = viewer?.permissions ?? []
  const hasManage = perms.includes('walkins.manage')
  const canReorder = perms.includes('walkins.reorder') || hasManage
  const canPause = perms.includes('walkins.pause') || hasManage
  const canAssign = perms.includes('walkins.assign') || hasManage
  const canNoShow = perms.includes('walkins.no_show') || hasManage
  const canCancel = perms.includes('walkins.drop') || hasManage

  // Load clocked-in staff for the suggestion selector + assign overlay.
  // Refresh whenever the location changes, plus once after every walk-in
  // mutation so the "ver siguiente para" dropdown reflects who's actually
  // on the floor.
  useEffect(() => {
    if (!locationId) {
      setAllBarbers([])
      return
    }
    let cancelled = false
    checkout
      .getAvailableBarbers(locationId)
      .then((b) => {
        if (!cancelled) setAllBarbers(b)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [locationId, checkout, wi.list])

  // PENDING rows, ordered by sortOrder then createdAt (FIFO tiebreaker).
  // `pendingOrder` is an in-flight override during reorder mutations.
  const pendingList = useMemo(() => {
    const all = wi.list.filter((w) => w.status === 'PENDING')
    if (pendingOrder) {
      const byId = new Map(all.map((w) => [w.id, w]))
      const ordered = pendingOrder
        .map((id) => byId.get(id))
        .filter((w): w is WalkIn => !!w)
      // Append any rows that appeared after we computed pendingOrder so
      // a newly-created walk-in still shows while the reorder is settling.
      const seen = new Set(ordered.map((w) => w.id))
      for (const w of all) if (!seen.has(w.id)) ordered.push(w)
      return ordered
    }
    return [...all].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
  }, [wi.list, pendingOrder])

  const assignedAndDone = useMemo(
    () => wi.list.filter((w) => w.status !== 'PENDING'),
    [wi.list],
  )

  const handleMoveUp = useCallback(
    async (index: number) => {
      if (index === 0) return
      const ids = pendingList.map((w) => w.id)
      ;[ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!]
      setPendingOrder(ids)
      try {
        await wi.reorderWalkIns(ids)
      } catch {
        // Refetch (already triggered inside the hook) will overwrite the
        // optimistic state. Clearing makes sure that if the server returns
        // the old order, the UI snaps back.
      } finally {
        setPendingOrder(null)
      }
    },
    [pendingList, wi],
  )

  const handleMoveDown = useCallback(
    async (index: number) => {
      if (index >= pendingList.length - 1) return
      const ids = pendingList.map((w) => w.id)
      ;[ids[index], ids[index + 1]] = [ids[index + 1]!, ids[index]!]
      setPendingOrder(ids)
      try {
        await wi.reorderWalkIns(ids)
      } catch {
        // see comment above
      } finally {
        setPendingOrder(null)
      }
    },
    [pendingList, wi],
  )

  // Refresh suggestion when the selected barbero changes OR when the
  // queue changes (someone got assigned / paused / removed, etc.).
  useEffect(() => {
    if (!selectedBarbero) {
      setSuggestion(null)
      return
    }
    let cancelled = false
    wi.fetchSuggestedNext(selectedBarbero.id)
      .then((s) => {
        if (!cancelled) setSuggestion(s ?? null)
      })
      .catch(() => {
        if (!cancelled) setSuggestion(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedBarbero, wi.list, wi.fetchSuggestedNext, wi])

  // Suggestion-only options: every clocked-in barber on the floor (occupied
  // or not). Operators want to plan ahead — "when Javi finishes, who's next
  // for him?" is a legitimate question even while he's mid-cut.
  const suggestionBarbers = useMemo(
    () => allBarbers.filter((b) => b.hasClockedIn),
    [allBarbers],
  )

  return (
    <div className="flex h-full flex-col">
      {/* ── Page header ── */}
      <div className="flex items-end justify-between border-b border-[var(--color-leather-muted)]/40 px-6 py-5">
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-bone-muted)]">
            Walk-ins
          </p>
          <h1
            className="text-2xl font-bold leading-tight text-[var(--color-bone)]"
            style={{ fontFamily: 'var(--font-pos-display)' }}
          >
            Sala de Espera
          </h1>
        </div>
        <TouchButton size="row" variant="secondary" onClick={() => setShowAdd(true)}>
          + Nuevo Walk-in
        </TouchButton>
      </div>

      {/* ── Error banner ── */}
      {wi.error && (
        <p className="border-b border-[var(--color-bravo)]/30 bg-[var(--color-bravo)]/10 px-6 py-3 text-sm text-[var(--color-bravo)]">
          {wi.error}
        </p>
      )}

      {/* ── Body ── */}
      {wi.loading ? (
        <div className="flex-1 overflow-y-auto">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonQueueRow key={i} />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <WalkInQueueHeader walkIns={wi.list} />

          {/* Suggestion selector */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
              Ver siguiente para:
            </span>
            <select
              value={selectedBarbero?.id ?? ''}
              onChange={(e) => {
                const id = e.target.value
                if (!id) {
                  setSelectedBarbero(null)
                  return
                }
                const b = suggestionBarbers.find((x) => x.id === id)
                if (b) setSelectedBarbero({ id: b.id, name: b.fullName.split(' ')[0] ?? b.fullName })
              }}
              className="border border-[var(--color-leather-muted)]/40 bg-[var(--color-cuero-viejo)] px-2 py-1 text-sm text-[var(--color-bone)]"
            >
              <option value="">— ninguno —</option>
              {suggestionBarbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.fullName}
                </option>
              ))}
            </select>
          </div>

          {selectedBarbero && (
            <SuggestedNextCard
              staffUserId={selectedBarbero.id}
              staffName={selectedBarbero.name}
              suggestion={suggestion}
              onAssign={async () => {
                if (!suggestion) return
                await wi.assign(suggestion.id, selectedBarbero.id)
                // Refresh handled by hook; suggestion effect re-runs.
              }}
              onSkip={async () => {
                if (!selectedBarbero) return
                // Re-fetch — the API decides what "next" is, and a manual
                // refetch is the simplest "skip" semantic until we add
                // dismissed-id state on the server.
                try {
                  const s = await wi.fetchSuggestedNext(selectedBarbero.id)
                  setSuggestion(s ?? null)
                } catch {
                  setSuggestion(null)
                }
              }}
            />
          )}

          {/* Pending queue */}
          <div className="border border-[var(--color-leather-muted)]/30">
            {pendingList.length === 0 ? (
              <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
                <p
                  className="text-2xl font-bold text-[var(--color-bone)]"
                  style={{ fontFamily: 'var(--font-pos-display)' }}
                >
                  Aún no hay clientes esperando
                </p>
                <p className="max-w-xs text-sm text-[var(--color-bone-muted)]">
                  Cuando llegue un cliente sin cita, agrégalo aquí y asígnalo al siguiente barbero
                  disponible.
                </p>
                <TouchButton size="secondary" variant="secondary" onClick={() => setShowAdd(true)}>
                  + Agregar walk-in
                </TouchButton>
              </div>
            ) : (
              pendingList.map((w, i) => (
                <WalkInQueueRow
                  key={w.id}
                  walkIn={w}
                  position={i + 1}
                  canReorder={canReorder}
                  canPause={canPause}
                  canAssign={canAssign && !w.pausedAt}
                  canNoShow={canNoShow}
                  isFirst={i === 0}
                  isLast={i === pendingList.length - 1}
                  onMoveUp={() => handleMoveUp(i)}
                  onMoveDown={() => handleMoveDown(i)}
                  onAssign={() => setAssignTarget(w)}
                  onPause={() => wi.pauseWalkIn(w.id)}
                  onResume={() => wi.resumeWalkIn(w.id)}
                  onMarkNoShow={() => wi.markWalkInNoShow(w.id)}
                  onCancel={() => {
                    if (canCancel) setDropTarget(w)
                  }}
                />
              ))
            )}
          </div>

          {/* Historical (assigned / done / cancelled / no-show) */}
          {assignedAndDone.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
                Histórico
              </p>
              <div className="border border-[var(--color-leather-muted)]/30">
                {assignedAndDone.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-4 border-b border-[var(--color-leather-muted)]/30 px-5 py-4 opacity-70"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--color-bone)]">
                        {w.customer?.fullName ?? w.customerName ?? 'Cliente anónimo'}
                      </p>
                      {w.assignedStaffUser && (
                        <p className="mt-0.5 truncate text-xs text-[var(--color-bone-muted)]">
                          {w.assignedStaffUser.fullName}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-xs text-[var(--color-bone-muted)]">
                      {waitLabel(minutesAgo(w.createdAt))}
                    </span>
                    <StatusPill status={w.status} />
                    {w.status === 'ASSIGNED' && (
                      <TouchButton
                        size="min"
                        variant="secondary"
                        onClick={() => navigate(`/checkout?completeWalkInId=${w.id}`)}
                      >
                        Completar
                      </TouchButton>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Overlays ── */}
      {showAdd && locationId && (
        <AddWalkInSheet
          open={showAdd}
          locationId={locationId}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false)
            wi.refresh()
          }}
        />
      )}

      {dropTarget && (
        <DropConfirmOverlay
          walkIn={dropTarget}
          onConfirm={() => wi.drop(dropTarget.id)}
          onClose={() => setDropTarget(null)}
        />
      )}

      {assignTarget && (
        <AssignBarberOverlay
          walkIn={assignTarget}
          barbers={allBarbers}
          onAssign={async (staffUserId) => {
            await wi.assign(assignTarget.id, staffUserId)
          }}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </div>
  )
}
