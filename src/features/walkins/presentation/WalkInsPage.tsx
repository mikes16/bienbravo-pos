import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PersonAddIcon } from '@/shared/pos-ui/GoogleIcon.tsx'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import { useWalkIns } from '../application/useWalkIns.ts'
import type { WalkIn } from '../domain/walkins.types.ts'
import { PosCard, TapButton, StatusPill, KanbanColumn, SkeletonBlock, EmptyState, SectionHeader } from '@/shared/pos-ui/index.ts'

/* ── Helpers ──────────────────────────────────────────────────────────── */

function minutesAgo(isoDate: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 60_000))
}

function waitLabel(mins: number): string {
  if (mins < 1) return 'Recién llegado'
  return `Esp. ${mins} min`
}

/* ── Walk-in card per column ──────────────────────────────────────────── */

function PendingCard({
  w,
  index,
  onAssign,
  onDrop,
}: {
  w: WalkIn
  index: number
  onAssign: () => void
  onDrop: () => void
}) {
  const mins = minutesAgo(w.createdAt)
  return (
    <PosCard className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold">{w.customerName ?? 'Cliente Anónimo'}</p>
          <p className="mt-0.5 text-xs text-bb-muted">{waitLabel(mins)}</p>
        </div>
        <span className="text-xs text-bb-muted">#{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="flex gap-2">
        <TapButton size="md" variant="primary" className="flex-1 text-xs" onClick={onAssign}>
          Tomar
        </TapButton>
        <TapButton size="md" variant="ghost" className="text-xs text-bb-danger" onClick={onDrop}>
          Quitar
        </TapButton>
      </div>
    </PosCard>
  )
}

function CancelWalkInOverlay({
  walkIn,
  onSubmit,
  onClose,
}: {
  walkIn: WalkIn
  onSubmit: (reason: string) => Promise<void>
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    const trimmed = reason.trim()
    if (trimmed.length < 3) {
      setError('Escribe un motivo de cancelación para liberar al barbero.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      onClose()
    } catch {
      setError('No se pudo cancelar el servicio.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <PosCard className="w-full max-w-md space-y-4 bg-bb-bg shadow-xl">
        <h3 className="font-bb-display text-lg font-bold">Cancelar servicio sin cobro</h3>
        <p className="text-sm text-bb-muted">
          Cliente: <span className="font-semibold text-bb-text">{walkIn.customerName ?? 'Walk-in'}</span>
        </p>
        <textarea
          placeholder="Motivo (ej. cliente se retiró, no quiso esperar...)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-bb-border bg-bb-surface px-4 py-3 text-sm outline-none focus:border-bb-primary"
        />
        {error && <p className="text-xs text-bb-danger">{error}</p>}
        <div className="flex gap-3">
          <TapButton size="md" variant="ghost" className="flex-1" onClick={onClose} disabled={submitting}>
            Volver
          </TapButton>
          <TapButton size="md" variant="danger" className="flex-1" onClick={handleConfirm} disabled={submitting}>
            Confirmar cancelación
          </TapButton>
        </div>
      </PosCard>
    </div>
  )
}

function AssignedCard({
  w,
  onComplete,
  onCancel,
}: {
  w: WalkIn
  onComplete: () => void
  onCancel: () => void
}) {
  const mins = minutesAgo(w.createdAt)
  return (
    <PosCard className="space-y-3">
      <p className="text-sm font-bold">{w.customerName ?? 'Walk-in'}</p>
      {w.assignedStaffUser && (
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-bb-surface-2 text-[10px] font-bold text-bb-muted">
            {w.assignedStaffUser.fullName.slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs text-bb-muted">{w.assignedStaffUser.fullName}</span>
        </div>
      )}
      <p className="text-xs text-bb-muted">En servicio · {mins} min</p>
      <div className="flex gap-2">
        <TapButton size="md" variant="primary" className="flex-1 text-xs" onClick={onComplete}>
          Finalizar
        </TapButton>
        <TapButton size="md" variant="ghost" className="text-xs text-bb-danger" onClick={onCancel}>
          Cancelar
        </TapButton>
      </div>
    </PosCard>
  )
}

function DoneCard({ w }: { w: WalkIn }) {
  return (
    <PosCard className="flex items-center justify-between opacity-70">
      <div>
        <p className="text-sm font-semibold">{w.customerName ?? 'Walk-in'}</p>
        {w.assignedStaffUser && (
          <p className="text-xs text-bb-muted">{w.assignedStaffUser.fullName}</p>
        )}
      </div>
      <StatusPill label="Finalizado" color="green" />
    </PosCard>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <PosCard className="w-full max-w-sm space-y-4 bg-bb-bg shadow-xl">
        <h3 className="font-bb-display text-lg font-bold">Nuevo Walk-in</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Nombre del cliente (opcional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full rounded-xl border border-bb-border bg-bb-surface px-4 py-3 text-sm outline-none focus:border-bb-primary"
          />
          <input
            type="tel"
            placeholder="Teléfono (opcional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-bb-border bg-bb-surface px-4 py-3 text-sm outline-none focus:border-bb-primary"
          />
          <input
            type="email"
            placeholder="Correo electrónico (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            className="w-full rounded-xl border border-bb-border bg-bb-surface px-4 py-3 text-sm outline-none focus:border-bb-primary"
          />
          <p className="text-xs text-bb-muted">Con teléfono o correo se puede identificar al cliente al cobrar y evitar duplicados.</p>
        </div>
        <div className="flex gap-3">
          <TapButton size="md" variant="ghost" className="flex-1" onClick={onClose}>
            Cancelar
          </TapButton>
          <TapButton size="md" variant="primary" className="flex-1" onClick={handleSubmit}>
            Agregar
          </TapButton>
        </div>
      </PosCard>
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
  const [cancelTarget, setCancelTarget] = useState<WalkIn | null>(null)

  const pending = list.filter((w) => w.status === 'PENDING')
  const assigned = list.filter((w) => w.status === 'ASSIGNED')
  const done = list.filter((w) => w.status === 'DONE')

  return (
    <div className="flex h-full flex-col px-6 py-6">
      {/* Header */}
      <SectionHeader
        title="Sala de Espera"
        className="mb-5"
        action={
          <TapButton size="md" variant="primary" className="flex items-center gap-2" onClick={() => setShowNew(true)}>
            <PersonAddIcon className="h-4 w-4" />
            Nuevo Walk-in
          </TapButton>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl bg-bb-danger/10 px-4 py-3 text-sm text-bb-danger">{error}</p>
      )}

      {loading ? (
        <div className="flex flex-1 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-1 flex-col gap-3">
              <SkeletonBlock className="h-6 w-24" />
              <SkeletonBlock className="h-28" />
              <SkeletonBlock className="h-28" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<PersonAddIcon className="h-10 w-10 text-bb-muted" />}
          message="Sin walk-ins por ahora"
          action={
            <TapButton size="md" variant="ghost" onClick={() => setShowNew(true)}>
              + Agregar walk-in
            </TapButton>
          }
        />
      ) : (
        <div className="flex flex-1 gap-6 overflow-x-auto pb-2">
          {/* EN ESPERA */}
          <KanbanColumn title="En Espera" count={pending.length} accent="amber">
            {pending.map((w, i) => (
              <PendingCard
                key={w.id}
                w={w}
                index={i}
                onAssign={() => viewer && assign(w.id, viewer.staff.id)}
                onDrop={() => drop(w.id)}
              />
            ))}
          </KanbanColumn>

          {/* EN SERVICIO */}
          <KanbanColumn title="En Servicio" count={assigned.length} accent="blue">
            {assigned.map((w) => (
              <AssignedCard
                key={w.id}
                w={w}
                onComplete={() => navigate(`/checkout?completeWalkInId=${w.id}`)}
                onCancel={() => setCancelTarget(w)}
              />
            ))}
          </KanbanColumn>

          {/* FINALIZADO */}
          <KanbanColumn title="Finalizado" count={done.length} accent="green">
            {done.map((w) => (
              <DoneCard key={w.id} w={w} />
            ))}
          </KanbanColumn>
        </div>
      )}

      {showNew && (
        <NewWalkInOverlay
          onSubmit={(n, p, e) => create(n, p, e)}
          onClose={() => setShowNew(false)}
        />
      )}

      {cancelTarget && (
        <CancelWalkInOverlay
          walkIn={cancelTarget}
          onSubmit={(reason) => drop(cancelTarget.id, reason)}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  )
}
