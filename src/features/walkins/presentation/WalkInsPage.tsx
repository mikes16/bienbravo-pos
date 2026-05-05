import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import { useWalkIns } from '../application/useWalkIns.ts'
import type { WalkIn, WalkInStatus } from '../domain/walkins.types.ts'
import { TouchButton, SkeletonRow } from '@/shared/pos-ui/index.ts'
import { cn } from '@/shared/lib/cn'

/* ── Helpers ──────────────────────────────────────────────────────────── */

function minutesAgo(isoDate: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 60_000))
}

function waitLabel(mins: number): string {
  if (mins < 1) return 'Recién llegado'
  return `${mins} min`
}

/* ── Status pill ──────────────────────────────────────────────────────── */

const STATUS_LABELS: Record<WalkInStatus, string> = {
  PENDING: 'Esperando',
  ASSIGNED: 'Asignado',
  DONE: 'Listo',
  CANCELLED: 'Cancelado',
}

const STATUS_COLORS: Record<WalkInStatus, string> = {
  PENDING: 'text-[var(--color-warning)] border-[var(--color-warning)]/40',
  ASSIGNED: 'text-[var(--color-bone)] border-[var(--color-bone-muted)]/40',
  DONE: 'text-[var(--color-success)] border-[var(--color-success)]/40',
  CANCELLED: 'text-[var(--color-bone-muted)] border-[var(--color-bone-muted)]/30',
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
        <p
          className="mb-1 text-xs font-mono uppercase tracking-widest text-[var(--color-bone-muted)]"
        >
          Confirmar
        </p>
        <h3
          className="mb-6 text-[var(--font-pos-display,var(--font-pos-display))] text-xl font-bold text-[var(--color-bone)]"
        >
          Quitar a {walkIn.customerName ?? 'este cliente'}?
        </h3>
        <div className="flex gap-3">
          <TouchButton
            variant="ghost"
            size="row"
            className="flex-1"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </TouchButton>
          <TouchButton
            variant="danger"
            size="row"
            className="flex-1"
            onClick={handleConfirm}
            disabled={busy}
          >
            Sí, quitar
          </TouchButton>
        </div>
      </div>
    </div>
  )
}

/* ── New Walk-in overlay ──────────────────────────────────────────────── */

function NewWalkInOverlay({
  onSubmit,
  onClose,
}: {
  onSubmit: (name: string | null, phone: string | null, email: string | null) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  function handleSubmit() {
    onSubmit(name.trim() || null, phone.trim() || null, email.trim() || null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] p-6">
        <p className="mb-1 text-xs font-mono uppercase tracking-widest text-[var(--color-bone-muted)]">
          Walk-in
        </p>
        <h3 className="mb-5 text-xl font-bold text-[var(--color-bone)]">Nuevo cliente</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Nombre del cliente (opcional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 py-3 text-sm text-[var(--color-bone)] outline-none placeholder:text-[var(--color-bone-muted)] focus:border-[var(--color-bone-muted)]"
          />
          <input
            type="tel"
            placeholder="Teléfono (opcional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 py-3 text-sm text-[var(--color-bone)] outline-none placeholder:text-[var(--color-bone-muted)] focus:border-[var(--color-bone-muted)]"
          />
          <input
            type="email"
            placeholder="Correo electrónico (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            className="w-full border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 py-3 text-sm text-[var(--color-bone)] outline-none placeholder:text-[var(--color-bone-muted)] focus:border-[var(--color-bone-muted)]"
          />
          <p className="text-xs text-[var(--color-bone-muted)]">
            Con teléfono o correo se puede identificar al cliente al cobrar y evitar duplicados.
          </p>
        </div>
        <div className="mt-5 flex gap-3">
          <TouchButton size="row" variant="ghost" className="flex-1" onClick={onClose}>
            Cancelar
          </TouchButton>
          <TouchButton size="row" variant="primary" className="flex-1" onClick={handleSubmit}>
            Agregar
          </TouchButton>
        </div>
      </div>
    </div>
  )
}

/* ── Queue row ────────────────────────────────────────────────────────── */

function QueueRow({
  w,
  index,
  onTomar,
  onCompletar,
  onDrop,
}: {
  w: WalkIn
  index: number
  onTomar: () => void
  onCompletar: () => void
  onDrop: () => void
}) {
  const mins = minutesAgo(w.createdAt)
  const isDone = w.status === 'DONE' || w.status === 'CANCELLED'

  return (
    <div
      className={cn(
        'flex items-center gap-4 border-b border-[var(--color-leather-muted)]/30 px-5 py-4',
        isDone && 'opacity-50',
      )}
    >
      {/* Position number */}
      <span className="w-7 shrink-0 text-center font-mono text-xs text-[var(--color-bone-muted)]">
        {String(index + 1).padStart(2, '0')}
      </span>

      {/* Name + barber chip */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-bone)]">
          {w.customerName ?? 'Cliente anónimo'}
        </p>
        {w.assignedStaffUser && (
          <p className="mt-0.5 truncate text-xs text-[var(--color-bone-muted)]">
            {w.assignedStaffUser.fullName}
          </p>
        )}
      </div>

      {/* Wait time */}
      <span className="shrink-0 font-mono text-xs text-[var(--color-bone-muted)]">
        {waitLabel(mins)}
      </span>

      {/* Status pill */}
      <StatusPill status={w.status} />

      {/* Actions */}
      {w.status === 'PENDING' && (
        <TouchButton size="min" variant="primary" onClick={onTomar}>
          Tomar
        </TouchButton>
      )}
      {w.status === 'ASSIGNED' && (
        <TouchButton size="min" variant="secondary" onClick={onCompletar}>
          Completar
        </TouchButton>
      )}

      {/* × drop button — raw button per spec, touch-target height via CSS var */}
      {!isDone && (
        <button
          type="button"
          aria-label="Quitar cliente"
          className="flex shrink-0 items-center justify-center text-[var(--color-bone-muted)] hover:text-[var(--color-bravo)]"
          style={{ minHeight: 'var(--pos-touch-min)', minWidth: 'var(--pos-touch-min)' }}
          onClick={onDrop}
        >
          ×
        </button>
      )}
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
  const navigate = useNavigate()
  const { list, loading, error, create, assign, drop } = useWalkIns(locationId)

  const [showNew, setShowNew] = useState(false)
  const [dropTarget, setDropTarget] = useState<WalkIn | null>(null)

  // Show active queue (PENDING + ASSIGNED) first, then DONE at the bottom
  const active = list.filter((w) => w.status === 'PENDING' || w.status === 'ASSIGNED')
  const done = list.filter((w) => w.status === 'DONE' || w.status === 'CANCELLED')
  const sorted = [...active, ...done]

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
        <TouchButton size="row" variant="secondary" onClick={() => setShowNew(true)}>
          + Nuevo Walk-in
        </TouchButton>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <p className="border-b border-[var(--color-bravo)]/30 bg-[var(--color-bravo)]/10 px-6 py-3 text-sm text-[var(--color-bravo)]">
          {error}
        </p>
      )}

      {/* ── Body ── */}
      {loading ? (
        <div className="flex-1 overflow-y-auto">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonQueueRow key={i} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        /* ── Empty state ── */
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <p
            className="text-3xl font-bold text-[var(--color-bone)]"
            style={{ fontFamily: 'var(--font-pos-display)' }}
          >
            Aún no hay clientes esperando
          </p>
          <p className="max-w-xs text-sm text-[var(--color-bone-muted)]">
            Cuando llegue un cliente sin cita, agrégalo aquí y asígnalo al siguiente barbero disponible.
          </p>
          <TouchButton size="secondary" variant="secondary" onClick={() => setShowNew(true)}>
            + Agregar walk-in
          </TouchButton>
        </div>
      ) : (
        /* ── Queue list ── */
        <div className="flex-1 overflow-y-auto">
          {sorted.map((w, i) => (
            <QueueRow
              key={w.id}
              w={w}
              index={i}
              onTomar={() => viewer && assign(w.id, viewer.staff.id)}
              onCompletar={() => navigate(`/checkout?completeWalkInId=${w.id}`)}
              onDrop={() => setDropTarget(w)}
            />
          ))}
        </div>
      )}

      {/* ── Overlays ── */}
      {showNew && (
        <NewWalkInOverlay
          onSubmit={(n, p, e) => create(n, p, e)}
          onClose={() => setShowNew(false)}
        />
      )}

      {dropTarget && (
        <DropConfirmOverlay
          walkIn={dropTarget}
          onConfirm={() => drop(dropTarget.id)}
          onClose={() => setDropTarget(null)}
        />
      )}
    </div>
  )
}
