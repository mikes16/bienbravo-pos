import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/cn.ts'
import { formatMoney } from '@/shared/lib/money.ts'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import { useAgenda } from '../application/useAgenda.ts'
import type { Appointment, AppointmentStatus } from '../domain/agenda.types.ts'

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-bb-bg p-6 shadow-xl sm:rounded-2xl">
        <h3 className="mb-1 font-bb-display text-lg font-bold">Cobrar cita</h3>
        <p className="mb-4 text-sm text-bb-muted">
          {appt.customer?.fullName ?? 'Walk-in'} · {formatMoney(appt.totalCents)}
        </p>

        {error && (
          <p className="mb-3 rounded-xl bg-bb-danger/10 px-3 py-2 text-sm text-bb-danger">{error}</p>
        )}

        <div className="mb-4 flex gap-2">
          {PAYMENT_METHODS.map((pm) => (
            <button
              key={pm.value}
              type="button"
              onClick={() => setMethod(pm.value)}
              className={cn(
                'flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors',
                method === pm.value
                  ? 'bg-bb-primary text-white'
                  : 'bg-bb-surface text-bb-muted hover:bg-bb-surface-2',
              )}
            >
              {pm.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-bb-surface py-3 text-sm font-semibold hover:bg-bb-surface-2"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handlePay}
            disabled={submitting}
            className="flex-1 rounded-2xl bg-bb-primary py-3 text-sm font-bold text-white active:scale-[0.97] disabled:opacity-50"
          >
            {submitting ? 'Procesando...' : `Cobrar ${formatMoney(appt.totalCents)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-bb-bg p-6 shadow-xl sm:rounded-2xl">
        <h3 className="mb-1 font-bb-display text-lg font-bold">Confirmar no-show</h3>
        <p className="mb-4 text-sm text-bb-muted">
          Vas a marcar como no-show a <span className="font-semibold text-bb-text">{appt.customer?.fullName ?? 'este cliente'}</span>.
          Esta acción impacta métricas y comisiones.
        </p>
        {error && (
          <p className="mb-3 rounded-xl bg-bb-danger/10 px-3 py-2 text-sm text-bb-danger">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl bg-bb-surface py-3 text-sm font-semibold hover:bg-bb-surface-2"
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 rounded-2xl bg-bb-danger py-3 text-sm font-bold text-white active:scale-[0.97] disabled:opacity-50"
          >
            {submitting ? 'Aplicando...' : 'Sí, marcar no-show'}
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  HOLD: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  CHECKED_IN: 'bg-indigo-100 text-indigo-800',
  IN_SERVICE: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  HOLD: 'En espera',
  CONFIRMED: 'Confirmada',
  CHECKED_IN: 'Check-in',
  IN_SERVICE: 'En servicio',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No show',
}

function AppointmentCard({
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
  const time = new Date(appt.startAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex items-start gap-4 rounded-2xl bg-bb-surface p-4">
      <div className="flex flex-col items-center gap-1">
        <span className="text-lg font-bold">{time}</span>
        <span className={cn('rounded-lg px-2 py-0.5 text-[10px] font-semibold', STATUS_COLORS[appt.status])}>
          {STATUS_LABELS[appt.status]}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold">{appt.customer?.fullName ?? 'Walk-in'}</p>
        <p className="text-xs text-bb-muted">{appt.items.map((i) => i.label).join(', ')}</p>
        <p className="mt-1 text-sm font-semibold text-bb-primary">{formatMoney(appt.totalCents)}</p>
      </div>

      <div className="flex min-w-[122px] flex-col gap-2">
        {appt.status === 'CONFIRMED' && (
          <ActionBtn label="Check-in" color="bg-indigo-600" onClick={onCheckIn} />
        )}
        {appt.status === 'CHECKED_IN' && (
          <ActionBtn label="Iniciar" color="bg-green-600" onClick={onStartService} />
        )}
        {appt.status === 'IN_SERVICE' && (
          <ActionBtn label="Completar" color="bg-bb-primary" onClick={onComplete} />
        )}
        {appt.status === 'COMPLETED' && appt.salePaymentStatus !== 'PAID' && (
          <ActionBtn label="Cobrar" color="bg-green-700" onClick={onPay} />
        )}
        {['CONFIRMED', 'CHECKED_IN'].includes(appt.status) && (
          <button
            type="button"
            onClick={onNoShow}
            className="mt-1 rounded-xl border border-bb-danger/50 bg-bb-danger/10 px-3 py-2 text-xs font-semibold text-bb-danger hover:bg-bb-danger/20 active:scale-[0.97]"
          >
            Marcar no-show
          </button>
        )}
      </div>
    </div>
  )
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl px-3 py-1.5 text-xs font-semibold text-white',
        'active:scale-[0.95]',
        color,
      )}
    >
      {label}
    </button>
  )
}

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

  const sorted = [...appointments].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  )

  return (
    <div className="flex min-h-full flex-col px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-bb-display text-xl font-bold">Mi Agenda</h1>
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="rounded-xl px-3 py-2 text-sm text-bb-muted hover:text-bb-text"
        >
          ← Inicio
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-bb-danger/10 px-4 py-3 text-sm text-bb-danger">{error}</p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-bb-surface" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-bb-muted">
          <span className="text-4xl">📅</span>
          <p className="text-sm">Sin citas para hoy</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((appt) => (
            <AppointmentCard
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
      )}

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
          onPaid={() => { setPayingAppt(null); refresh() }}
        />
      )}
    </div>
  )
}
