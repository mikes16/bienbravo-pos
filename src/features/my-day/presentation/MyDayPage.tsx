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

interface CompletedItem {
  id: string
  /** Origen: cita (appointment) o walk-in. Las citas tienen totalCents
   *  directo del agendamiento; los walk-ins generan venta via Sale, por
   *  lo que su totalCents requeriría enriquecimiento — primera versión
   *  lo deja en null y la fila muestra '—'. */
  kind: 'appt' | 'walkin'
  /** Timestamp para sort cronológico. Para appointments es endAt,
   *  para walk-ins assignedAt (cuando empezó el servicio). */
  timeAt: string
  customerName: string
  serviceLabel: string
  totalCents: number | null
}

interface UpcomingAppt {
  id: string
  startAt: string
  customerName: string
  serviceLabel: string
}

interface DaySummary {
  completedCount: number
  revenueCents: number
  commissionCents: number
  hoursWorked: string
  clockedIn: boolean
  completedItems: CompletedItem[]
  upcomingAppts: UpcomingAppt[]
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

function walkInServiceLabel(w: WalkIn): string {
  if (w.requestedServices && w.requestedServices.length > 0) {
    return w.requestedServices.map((s) => s.name).join(' · ')
  }
  return w.requestedService?.name ?? w.requestedCatalogCombo?.name ?? '—'
}

function apptServiceLabel(a: Appointment): string {
  if (a.items.length === 0) return '—'
  return a.items.map((it) => it.label).join(' · ')
}

function computeWorkSummary(
  appointments: Appointment[],
  walkIns: WalkIn[],
  clockEvents: TimeClockEvent[],
  staffUserId: string,
  revenueCents: number,
  commissionCents: number,
): DaySummary {
  // Walk-ins ya vienen pre-filtrados por fecha del servidor (fromDate/toDate
  // del query). Solo aplicamos los filtros semánticos restantes: status DONE
  // y assignedStaffUser === viewer. Appointments y clock events también
  // vienen pre-filtrados por su query.
  const completedAppts = appointments.filter(
    (a) => a.status === 'COMPLETED' && a.staffUser?.id === staffUserId,
  )
  const completedWalkIns = walkIns.filter(
    (w) => w.status === 'DONE' && w.assignedStaffUser?.id === staffUserId,
  )
  const completedCount = completedAppts.length + completedWalkIns.length

  // Timeline ordenado cronológicamente descendente — lo más reciente arriba,
  // que es lo que el operador quiere revisar primero ("¿qué acabo de hacer?").
  // Citas usan endAt; walk-ins assignedAt como aproximación (no tenemos
  // completedAt en el shape actual).
  const completedItems: CompletedItem[] = [
    ...completedAppts.map((a): CompletedItem => ({
      id: `appt-${a.id}`,
      kind: 'appt',
      timeAt: a.endAt,
      customerName: a.customer?.fullName ?? 'Mostrador',
      serviceLabel: apptServiceLabel(a),
      totalCents: a.totalCents,
    })),
    ...completedWalkIns.map((w): CompletedItem => ({
      id: `walkin-${w.id}`,
      kind: 'walkin',
      timeAt: w.assignedAt ?? w.createdAt,
      customerName: w.customer?.fullName ?? w.customerName ?? 'Mostrador',
      serviceLabel: walkInServiceLabel(w),
      // Monto real del Sale asociado. El walk-in trae sale { totalCents }
      // gracias al subselect en WALKINS_QUERY — single source of truth, sin
      // denormalización. Null si todavía no se cobró.
      totalCents: w.sale?.totalCents ?? null,
    })),
  ].sort((a, b) => new Date(b.timeAt).getTime() - new Date(a.timeAt).getTime())

  // Próximas citas asignadas al viewer — para "lo que viene en el día".
  // Tomamos CONFIRMED y CHECKED_IN (pendientes de empezar/en check-in), y
  // las ordenamos ascendente porque la siguiente es la más relevante arriba.
  const now = Date.now()
  const upcomingAppts: UpcomingAppt[] = appointments
    .filter(
      (a) =>
        a.staffUser?.id === staffUserId &&
        (a.status === 'CONFIRMED' || a.status === 'CHECKED_IN') &&
        new Date(a.startAt).getTime() >= now,
    )
    .map((a) => ({
      id: a.id,
      startAt: a.startAt,
      customerName: a.customer?.fullName ?? 'Mostrador',
      serviceLabel: apptServiceLabel(a),
    }))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())

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
    completedItems,
    upcomingAppts,
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
    // Rango ISO de HOY para filtrar walk-ins del lado del servidor en vez
    // de descargar todo el histórico y filtrar client-side.
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    setLoading(true)

    setLoadError(null)
    Promise.allSettled([
      agenda.getAppointments(d, d, locationId),
      clock.getEvents(viewer.staff.id, locationId, d, d),
      walkins.getWalkIns(locationId, todayStart.toISOString(), todayEnd.toISOString()),
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
    // overflow-y-auto en el container hace que TODO el contenido scrollee
    // (KPIs + secciones). El PosShell envuelve esta página en un `<main>`
    // con overflow-hidden, así que sin esto el contenido se recorta y la
    // lista de servicios queda inalcanzable.
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-6 py-5 pb-10">
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

      {/* Próximas citas — solo si hay alguna pendiente del día asignada al
          viewer. Patrón Booksy Pro: "lo que viene primero" para que el
          barbero anticipe. Cronológico ascendente. */}
      {summary && summary.upcomingAppts.length > 0 && (
        <section className="flex flex-col">
          <SectionEyebrow
            label={`Por venir · ${summary.upcomingAppts.length} ${
              summary.upcomingAppts.length === 1 ? 'pendiente' : 'pendientes'
            }`}
            tone="leather"
          />
          <ul className="flex flex-col border border-[var(--color-leather-muted)]/40">
            {summary.upcomingAppts.map((a) => (
              <li key={a.id}>
                <UpcomingRow {...a} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Servicios completados — la pregunta principal de esta pantalla:
          "¿qué hice hoy?". Cronológico descendente. Hora a la izquierda
          como timestamp denso, cliente y servicio en el medio, monto
          display monumental a la derecha. */}
      <section className="flex flex-1 flex-col">
        <SectionEyebrow
          label={
            loading
              ? 'Servicios de hoy'
              : `Servicios de hoy · ${summary?.completedCount ?? 0} ${
                  summary?.completedCount === 1 ? 'realizado' : 'realizados'
                }`
          }
          tone="bone"
        />
        {loading ? (
          <ul className="flex flex-col gap-px border border-[var(--color-leather-muted)]/40">
            {[1, 2, 3].map((i) => (
              <li
                key={i}
                className="h-16 animate-pulse bg-[var(--color-cuero-viejo)]/30"
              />
            ))}
          </ul>
        ) : !summary || summary.completedItems.length === 0 ? (
          <div className="border border-[var(--color-leather-muted)]/40 px-5 py-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
              Aún no hay servicios cerrados hoy.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col border border-[var(--color-leather-muted)]/40">
            {summary.completedItems.map((item) => (
              <li key={item.id}>
                <CompletedRow {...item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function SectionEyebrow({ label, tone }: { label: string; tone: 'bone' | 'leather' }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span
        aria-hidden
        className={`font-mono text-[12px] ${
          tone === 'bone' ? 'text-[var(--color-leather)]' : 'text-[var(--color-leather)]'
        }`}
      >
        //
      </span>
      <p
        className={`font-mono text-[10px] font-bold uppercase tracking-[0.22em] ${
          tone === 'bone' ? 'text-[var(--color-bone-muted)]' : 'text-[var(--color-leather)]'
        }`}
      >
        {label}
      </p>
      <span aria-hidden className="h-px flex-1 bg-[var(--color-leather-muted)]/30" />
    </div>
  )
}

function CompletedRow({
  timeAt,
  customerName,
  serviceLabel,
  totalCents,
  kind,
}: CompletedItem) {
  const time = new Date(timeAt).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return (
    <div className="grid grid-cols-[64px_1fr_auto] items-baseline gap-4 border-b border-[var(--color-leather-muted)]/20 px-4 py-3 last:border-b-0">
      <span className="font-mono text-[14px] font-bold tabular-nums text-[var(--color-bone)]">
        {time}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold text-[var(--color-bone)]">
          {customerName}
        </p>
        <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
          {kind === 'walkin' ? 'Walk-in' : 'Cita'} · {serviceLabel}
        </p>
      </div>
      {/* Monto a la derecha — solo se renderiza cuando lo tenemos. Para
          walk-ins (totalCents null) la celda queda vacía: el agregado real
          ya está en el KPI "Ventas hoy" arriba; mostrar un placeholder ahí
          se leía como columna ruidosa de rayitas. */}
      {totalCents != null ? (
        <span className="font-[var(--font-pos-display)] text-[20px] font-extrabold tabular-nums leading-none text-[var(--color-bone)]">
          {formatMoney(totalCents)}
        </span>
      ) : (
        <span aria-hidden />
      )}
    </div>
  )
}

function UpcomingRow({ startAt, customerName, serviceLabel }: UpcomingAppt) {
  const time = new Date(startAt).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return (
    <div className="grid grid-cols-[64px_1fr] items-baseline gap-4 border-b border-[var(--color-leather-muted)]/20 px-4 py-3 last:border-b-0">
      <span className="font-mono text-[14px] font-bold tabular-nums text-[var(--color-bone)]">
        {time}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold text-[var(--color-bone)]">
          {customerName}
        </p>
        <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
          {serviceLabel}
        </p>
      </div>
    </div>
  )
}
