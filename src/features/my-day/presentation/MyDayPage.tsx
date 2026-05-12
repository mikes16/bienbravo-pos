import { useState, useEffect } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { formatMoney } from '@/shared/lib/money.ts'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import { POS_HOME_COMMISSION } from '@/features/home/data/home.queries'
import type { Appointment } from '@/features/agenda/domain/agenda.types.ts'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository.ts'
import type { WalkIn } from '@/features/walkins/domain/walkins.types.ts'

function todayISO(): string {
  // Local date so it matches HoyPage and the API's "today" interpretation —
  // UTC was masking morning activity once local time crossed UTC midnight.
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface DaySummary {
  completedCount: number
  revenueCents: number
  commissionCents: number
  hoursWorked: string
  clockedIn: boolean
}

/**
 * Walk through clock events as a state machine instead of pairing by index.
 * The old pair-by-index approach assumed alternating IN/OUT but real data has
 * duplicates (e.g. operator double-taps clock-in) and orphans (an IN with no
 * OUT before the next IN). Treating it as a state machine — start the timer
 * on the first IN, ignore further INs until the next OUT, accumulate the
 * span on OUT — gives a correct total under any sequence.
 */
export function computeWorkedMinutes(events: TimeClockEvent[], now: Date = new Date()): number {
  // Defensive: accept events in any order, sort ascending by timestamp.
  const sorted = [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  let total = 0
  let inAt: Date | null = null
  for (const evt of sorted) {
    const at = new Date(evt.at)
    if (evt.type === 'CLOCK_IN') {
      if (inAt === null) inAt = at // ignore duplicate INs
    } else if (evt.type === 'CLOCK_OUT') {
      if (inAt !== null) {
        total += (at.getTime() - inAt.getTime()) / 60000
        inAt = null
      }
      // CLOCK_OUT without a preceding IN is dropped silently
    }
  }
  // Currently clocked in: count the open span up to "now".
  if (inAt !== null) total += (now.getTime() - inAt.getTime()) / 60000
  return Math.max(0, total)
}

function computeWorkSummary(
  appointments: Appointment[],
  walkIns: WalkIn[],
  clockEvents: TimeClockEvent[],
  staffUserId: string,
  revenueCents: number,
  commissionCents: number,
): DaySummary {
  // "Citas completadas" reads as "servicios cerrados hoy" to the operator —
  // include their finished walk-ins, otherwise a barber whose day is pure
  // walk-ins shows 0 and the page reads broken.
  const completedAppts = appointments.filter(
    (a) => a.status === 'COMPLETED' && a.staffUser?.id === staffUserId,
  ).length
  const completedWalkIns = walkIns.filter(
    (w) => w.status === 'DONE' && w.assignedStaffUser?.id === staffUserId,
  ).length
  const completedCount = completedAppts + completedWalkIns

  const totalMinutes = computeWorkedMinutes(clockEvents)
  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)

  // Clocked-in iff the most recent event (by timestamp, not array order) is
  // an IN. Sort defensively in case the API returns descending.
  const sorted = [...clockEvents].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  const last = sorted[sorted.length - 1]
  const clockedIn = !!last && last.type === 'CLOCK_IN'

  return {
    completedCount,
    revenueCents,
    commissionCents,
    hoursWorked: `${h}h ${m}m`,
    clockedIn,
  }
}

interface KPICardProps {
  label: string
  value: string
  loading?: boolean
}

function KPICard({ label, value, loading = false }: KPICardProps) {
  return (
    <div className="border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-4 py-4">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
        {label}
      </p>
      {loading ? (
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-[var(--color-leather-muted)]/20" />
      ) : (
        <p className="mt-2 font-[var(--font-pos-display)] text-[28px] font-extrabold tabular-nums leading-none text-[var(--color-bone)]">
          {value}
        </p>
      )}
    </div>
  )
}

export function MyDayPage() {
  const apollo = useApolloClient()
  const { viewer } = usePosAuth()
  const { locationId } = useLocation()
  const { agenda, clock, walkins } = useRepositories()
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const staffName = viewer?.staff?.fullName ?? ''

  useEffect(() => {
    if (!viewer || !locationId) return
    const d = todayISO()
    setLoading(true)

    setLoadError(null)
    Promise.allSettled([
      agenda.getAppointments(d, d, locationId),
      clock.getEvents(viewer.staff.id, locationId, d, d),
      walkins.getWalkIns(locationId),
      apollo.query<{
        staffServiceRevenueToday: number
        staffProductRevenueToday: number
        staffCommissionToday: number
      }>({
        query: POS_HOME_COMMISSION,
        variables: { staffUserId: viewer.staff.id, locationId, date: d },
        fetchPolicy: 'network-only',
      }),
    ])
      .then(([apptsRes, eventsRes, walkinsRes, commRes]) => {
        const appts = apptsRes.status === 'fulfilled' ? apptsRes.value : []
        const events = eventsRes.status === 'fulfilled' ? eventsRes.value : []
        const wkins = walkinsRes.status === 'fulfilled' ? walkinsRes.value : []
        const comm = commRes.status === 'fulfilled' ? commRes.value.data : null
        const revenueCents = (comm?.staffServiceRevenueToday ?? 0) + (comm?.staffProductRevenueToday ?? 0)
        const commissionCents = comm?.staffCommissionToday ?? 0
        setSummary(
          computeWorkSummary(appts, wkins, events, viewer.staff.id, revenueCents, commissionCents),
        )

        // Surface partial failures so the operator doesn't see "$0 ventas" silently
        // when the network/server actually failed. The view still renders with
        // whatever data did come through.
        const failures: string[] = []
        if (apptsRes.status === 'rejected') failures.push('citas')
        if (eventsRes.status === 'rejected') failures.push('reloj')
        if (walkinsRes.status === 'rejected') failures.push('fila')
        if (commRes.status === 'rejected') failures.push('ventas')
        if (failures.length > 0) {
          setLoadError(`No se pudo cargar: ${failures.join(', ')}. Refresca o avisa al admin si persiste.`)
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.error('[MyDayPage] partial load failure', { apptsRes, eventsRes, walkinsRes, commRes })
          }
        }
      })
      .finally(() => setLoading(false))
  }, [agenda, clock, walkins, viewer, locationId, apollo])

  return (
    <div className="flex h-full flex-col gap-6 px-6 py-5">
      <div>
        <h1 className="font-[var(--font-pos-display)] text-[28px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
          Mi Día
        </h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          {staffName}
        </p>
      </div>

      {loadError && (
        <div className="border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/10 px-4 py-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-bravo)]">
            {loadError}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPICard
          label="Ventas hoy"
          value={summary ? formatMoney(summary.revenueCents) : '—'}
          loading={loading}
        />
        <KPICard
          label="Comisiones"
          value={summary ? formatMoney(summary.commissionCents) : '—'}
          loading={loading}
        />
        <KPICard
          label="Citas completadas"
          value={summary ? String(summary.completedCount) : '—'}
          loading={loading}
        />
        <KPICard
          label="Tiempo trabajado"
          value={summary ? summary.hoursWorked : '—'}
          loading={loading}
        />
      </div>

      <div className="border border-[var(--color-leather-muted)]/40 px-5 py-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Turno actual
        </p>
        {loading ? (
          <div className="mt-2 h-4 w-32 animate-pulse rounded bg-[var(--color-leather-muted)]/20" />
        ) : (
          <p className="mt-2 text-[14px] text-[var(--color-bone-muted)]">
            {summary?.clockedIn ? 'Dentro del turno' : 'Fuera del turno'}
          </p>
        )}
      </div>
    </div>
  )
}
