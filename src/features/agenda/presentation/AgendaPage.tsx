import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatMoney } from '@/shared/lib/money.ts'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { SkeletonRow } from '@/shared/pos-ui/index'
import { useAgenda } from '../application/useAgenda.ts'
import type { Appointment, AppointmentStatus } from '../domain/agenda.types.ts'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatTimeMx(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Monterrey',
  })
}

function hourKeyMx(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Monterrey',
  }).slice(0, 2) // "10" from "10:00"
}

function hourLabelMx(iso: string): string {
  // Returns "10:00" label for the hour group header
  const hour = new Date(iso).toLocaleString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Monterrey',
  })
  const [h] = hour.split(':')
  return `${h.padStart(2, '0')}:00`
}

// ── status pill ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  HOLD: 'En espera',
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'Check-in',
  IN_SERVICE: 'En servicio',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No show',
}

const STATUS_TOKEN: Record<AppointmentStatus, string> = {
  HOLD: 'var(--color-leather-muted)',
  CONFIRMED: 'var(--color-bone)',
  CHECKED_IN: 'var(--color-warning)',
  IN_SERVICE: 'var(--color-success)',
  COMPLETED: 'var(--color-bone-muted)',
  CANCELLED: 'var(--color-bravo)',
  NO_SHOW: 'var(--color-bravo)',
}

function StatusPillInline({ status }: { status: AppointmentStatus }) {
  return (
    <span
      style={{ color: STATUS_TOKEN[status], borderColor: `${STATUS_TOKEN[status]}60` }}
      className="inline-block border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em]"
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

// ── pay appointment modal ─────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
]

function PayAppointmentModal({
  appt,
  locationId,
  staffUserId,
  onClose,
  onPaid,
}: {
  appt: Appointment
  locationId: string | null
  staffUserId: string | null
  onClose: () => void
  onPaid: () => void
}) {
  const { checkout } = useRepositories()
  const [method, setMethod] = useState<string>('CASH')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    if (!locationId) return
    setSubmitting(true)
    setError(null)
    try {
      await checkout.createSale({
        locationId,
        registerSessionId: null,
        customerId: appt.customer?.id ?? null,
        staffUserId,
        completeAppointmentId: appt.id,
        items: [{ serviceId: null, productId: null, catalogComboId: null, qty: 1, unitPriceCents: appt.totalCents }],
        tipCents: 0,
        paymentMethod: method as any,
      })
      onPaid()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el pago')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div
        className="w-full max-w-sm border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] p-6"
      >
        <p
          className="mb-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]"
        >
          Cobrar cita
        </p>
        <p
          style={{ fontFamily: 'var(--font-pos-display)' }}
          className="mb-4 text-xl font-extrabold text-[var(--color-bone)]"
        >
          {appt.customer?.fullName ?? 'Walk-in'} · {formatMoney(appt.totalCents)}
        </p>

        {error && (
          <p className="mb-3 border border-[var(--color-bravo)]/30 bg-[var(--color-bravo)]/10 px-3 py-2 text-sm text-[var(--color-bravo)]">
            {error}
          </p>
        )}

        <div className="mb-4 flex gap-2">
          {PAYMENT_METHODS.map((pm) => (
            <button
              key={pm.value}
              type="button"
              onClick={() => setMethod(pm.value)}
              style={
                method === pm.value
                  ? { borderColor: 'var(--color-bravo)', color: 'var(--color-bone)' }
                  : { borderColor: 'var(--color-leather-muted)', color: 'var(--color-bone-muted)' }
              }
              className="flex-1 border py-2.5 text-sm font-semibold transition-colors"
            >
              {pm.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <TouchButton variant="ghost" onClick={onClose} className="flex-1 py-3 text-sm">
            Cancelar
          </TouchButton>
          <TouchButton
            variant="primary"
            onClick={handlePay}
            disabled={submitting}
            className="flex-1 py-3 text-sm"
          >
            {submitting ? 'Procesando…' : `Cobrar ${formatMoney(appt.totalCents)}`}
          </TouchButton>
        </div>
      </div>
    </div>
  )
}

// ── confirm no-show modal ─────────────────────────────────────────────────────

function ConfirmNoShowModal({
  appt,
  onClose,
  onConfirm,
}: {
  appt: Appointment
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo marcar no-show')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div
        className="w-full max-w-sm border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] p-6"
      >
        <p
          className="mb-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]"
        >
          Confirmar no-show
        </p>
        <p
          style={{ fontFamily: 'var(--font-pos-display)' }}
          className="mb-2 text-xl font-extrabold text-[var(--color-bone)]"
        >
          {appt.customer?.fullName ?? 'Este cliente'}
        </p>
        <p className="mb-4 text-sm text-[var(--color-bone-muted)]">
          Esta acción impacta métricas y comisiones.
        </p>
        {error && (
          <p className="mb-3 border border-[var(--color-bravo)]/30 bg-[var(--color-bravo)]/10 px-3 py-2 text-sm text-[var(--color-bravo)]">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <TouchButton variant="ghost" onClick={onClose} disabled={submitting} className="flex-1 py-3 text-sm">
            Cancelar
          </TouchButton>
          <TouchButton
            variant="danger"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 py-3 text-sm"
          >
            {submitting ? 'Aplicando…' : 'Sí, no-show'}
          </TouchButton>
        </div>
      </div>
    </div>
  )
}

// ── appointment row ───────────────────────────────────────────────────────────

function AppointmentRow({
  appt,
  onCheckIn,
  onStartService,
  onComplete,
  onNoShow,
  onPay,
}: {
  appt: Appointment
  onCheckIn: () => void
  onStartService: () => void
  onComplete: () => void
  onNoShow: () => void
  onPay: () => void
}) {
  const serviceNames = appt.items.map((i) => i.label).join(', ')
  const barberName = appt.staffUser?.fullName ?? null

  return (
    <div className="flex items-center gap-4 border-b border-[var(--color-leather-muted)]/25 py-3 last:border-b-0">
      {/* time */}
      <div className="w-14 shrink-0 text-right">
        <span
          className="font-mono text-sm font-bold tabular-nums text-[var(--color-bone)]"
        >
          {formatTimeMx(appt.startAt)}
        </span>
      </div>

      {/* main info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--color-bone)]">
          {appt.customer?.fullName ?? 'Walk-in'}
        </p>
        <p className="truncate text-xs text-[var(--color-bone-muted)]">
          {serviceNames}
          {barberName && (
            <> · <span className="text-[var(--color-leather-muted)]">{barberName}</span></>
          )}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <StatusPillInline status={appt.status} />
          <span className="font-mono text-[10px] text-[var(--color-bone-muted)]">
            {formatMoney(appt.totalCents)}
          </span>
        </div>
      </div>

      {/* inline actions */}
      <div className="flex shrink-0 flex-col gap-1.5">
        {appt.status === 'CONFIRMED' && (
          <InlineAction label="Check-in" color="var(--color-warning)" onClick={onCheckIn} />
        )}
        {appt.status === 'CHECKED_IN' && (
          <InlineAction label="Iniciar" color="var(--color-success)" onClick={onStartService} />
        )}
        {appt.status === 'IN_SERVICE' && (
          <InlineAction label="Completar" color="var(--color-success)" onClick={onComplete} />
        )}
        {appt.status === 'COMPLETED' && appt.salePaymentStatus !== 'PAID' && (
          <InlineAction label="Cobrar" color="var(--color-success)" onClick={onPay} />
        )}
        {(appt.status === 'CONFIRMED' || appt.status === 'CHECKED_IN') && (
          <InlineAction label="No-show" color="var(--color-bravo)" onClick={onNoShow} />
        )}
      </div>
    </div>
  )
}

function InlineAction({
  label,
  color,
  onClick,
}: {
  label: string
  color: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ borderColor: `${color}60`, color }}
      className="min-w-[72px] border px-3 py-1.5 text-center font-mono text-[10px] font-bold uppercase tracking-[0.12em] active:opacity-70"
    >
      {label}
    </button>
  )
}

// ── skeleton row ──────────────────────────────────────────────────────────────

function AgendaSkeletonRow() {
  return (
    <div className="flex items-center gap-4 border-b border-[var(--color-leather-muted)]/25 py-3">
      <div className="w-14 shrink-0">
        <SkeletonRow heightPx={14} widthPercent={100} />
      </div>
      <div className="flex-1 space-y-2">
        <SkeletonRow heightPx={14} widthPercent={55} />
        <SkeletonRow heightPx={11} widthPercent={80} />
      </div>
      <div className="shrink-0">
        <SkeletonRow heightPx={24} widthPercent={100} className="w-[72px]" />
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export function AgendaPage() {
  const navigate = useNavigate()
  const { viewer } = usePosAuth()
  const { locationId } = useLocation()
  const { appointments, loading, error, checkIn, startService, complete, noShow, refresh } = useAgenda(
    viewer?.staff.id ?? null,
    locationId,
  )
  const [payingAppt, setPayingAppt] = useState<Appointment | null>(null)
  const [confirmNoShowAppt, setConfirmNoShowAppt] = useState<Appointment | null>(null)

  // sort by startAt asc
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  )

  // group by hour in America/Monterrey
  const groups: { hourLabel: string; appts: Appointment[] }[] = []
  const seen = new Map<string, number>()
  for (const appt of sorted) {
    const key = hourKeyMx(appt.startAt)
    if (!seen.has(key)) {
      seen.set(key, groups.length)
      groups.push({ hourLabel: hourLabelMx(appt.startAt), appts: [] })
    }
    groups[seen.get(key)!].appts.push(appt)
  }

  return (
    <div className="flex min-h-full flex-col px-5 py-6">
      {/* ── header ── */}
      <div className="mb-5 flex items-center justify-between border-b border-[var(--color-leather-muted)]/40 pb-4">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
            Agenda
          </p>
          <h1
            style={{ fontFamily: 'var(--font-pos-display)' }}
            className="text-2xl font-extrabold text-[var(--color-bone)]"
          >
            Mi Agenda
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-bone-muted)] active:opacity-60"
        >
          ← Inicio
        </button>
      </div>

      {/* ── error ── */}
      {error && (
        <p className="mb-4 border border-[var(--color-bravo)]/30 bg-[var(--color-bravo)]/10 px-4 py-3 text-sm text-[var(--color-bravo)]">
          {error}
        </p>
      )}

      {/* ── body ── */}
      {loading ? (
        <div>
          {[1, 2, 3, 4].map((i) => (
            <AgendaSkeletonRow key={i} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <p
            style={{ fontFamily: 'var(--font-pos-display)' }}
            className="text-2xl font-extrabold text-[var(--color-bone-muted)]"
          >
            Sin citas para hoy
          </p>
          <p className="text-sm text-[var(--color-leather-muted)]">
            Aún no hay citas agendadas para esta sucursal.
          </p>
        </div>
      ) : (
        <div>
          {groups.map((group) => (
            <div key={group.hourLabel} className="mb-4">
              {/* hour group header */}
              <div className="mb-2 flex items-center gap-3">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--color-leather-muted)]">
                  {group.hourLabel}
                </span>
                <div className="h-px flex-1 bg-[var(--color-leather-muted)]/30" />
              </div>
              {/* appointment rows */}
              <div>
                {group.appts.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appt={appt}
                    onCheckIn={() => checkIn(appt.id)}
                    onStartService={() => startService(appt.id)}
                    onComplete={() => complete(appt.id)}
                    onNoShow={() => setConfirmNoShowAppt(appt)}
                    onPay={() => setPayingAppt(appt)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── modals ── */}
      {confirmNoShowAppt && (
        <ConfirmNoShowModal
          appt={confirmNoShowAppt}
          onClose={() => setConfirmNoShowAppt(null)}
          onConfirm={async () => {
            await noShow(confirmNoShowAppt.id)
            setConfirmNoShowAppt(null)
          }}
        />
      )}

      {payingAppt && (
        <PayAppointmentModal
          appt={payingAppt}
          locationId={locationId}
          staffUserId={viewer?.staff.id ?? null}
          onClose={() => setPayingAppt(null)}
          onPaid={() => {
            setPayingAppt(null)
            refresh()
          }}
        />
      )}
    </div>
  )
}
