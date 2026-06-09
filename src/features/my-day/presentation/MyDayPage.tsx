import { useState, useEffect, useCallback } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { formatMoney } from '@/shared/lib/money.ts'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import { POS_MY_DAY_EARNINGS } from '@/features/home/data/home.queries'
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
  /** Origen: cita (appointment), walk-in, o venta directa de POS sin link.
   *  - appt/walkin: viene de la cola/agenda, ya estaba renderizado.
   *  - sale: venta directa (Nueva venta), aparece como row independiente
   *    si NO tiene linkedWalkInId ni linkedAppointmentId (dedupe). */
  kind: 'appt' | 'walkin' | 'sale'
  /** Timestamp para sort cronológico. Para appointments es endAt,
   *  para walk-ins assignedAt (cuando empezó el servicio),
   *  para ventas directas soldAt (sale.createdAt). */
  timeAt: string
  customerName: string
  serviceLabel: string
  totalCents: number | null
  /** Sale id linkado a esta cita/walk-in. Permite resolver "Tu parte" desde
   *  el desglose per-sale del API. Null si la cita aún no cerró su venta. */
  saleId: string | null
  /** Comisión + propina derivadas del API para esta venta específica.
   *  Null si todavía no hay sale linkado. */
  commissionCents: number | null
  tipCents: number | null
  earningsCents: number | null
}

interface EarningsBreakdown {
  serviceCommissionCents: number
  productCommissionCents: number
  tipsCents: number
  totalCommissionCents: number
  serviceRevenueCents: number
  productRevenueCents: number
}

interface UpcomingAppt {
  id: string
  startAt: string
  customerName: string
  serviceLabel: string
}

interface DaySummary {
  completedCount: number
  hoursWorked: string
  clockedIn: boolean
  completedItems: CompletedItem[]
  upcomingAppts: UpcomingAppt[]
  breakdown: EarningsBreakdown
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

interface PerSaleEntry {
  commissionCents: number
  tipCents: number
  earningsCents: number
  soldAt: string
  customerName: string | null
  linkedWalkInId: string | null
  linkedAppointmentId: string | null
  itemLabels: string[]
  attributedRevenueCents: number
}

function computeWorkSummary(
  appointments: Appointment[],
  walkIns: WalkIn[],
  clockEvents: TimeClockEvent[],
  staffUserId: string,
  breakdown: EarningsBreakdown,
  perSaleMap: Map<string, PerSaleEntry>,
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
  // Ventas directas atribuidas a este staff (no linkadas a walk-in/appt).
  // Cuentan como "servicios realizados" del día.
  const directSales = Array.from(perSaleMap.values()).filter(
    (e) => !e.linkedWalkInId && !e.linkedAppointmentId,
  )
  const completedCount = completedAppts.length + completedWalkIns.length + directSales.length

  // Timeline ordenado cronológicamente descendente — lo más reciente arriba.
  // Para cada row enriquezco con earnings derivado del per-sale del API:
  // si esta cita/walk-in tiene sale linkado, busco su entrada y muestro
  // "Tu parte". Si no hay sale aún (cita completada sin cerrar venta),
  // los campos quedan null y la UI lo señala.
  const completedItems: CompletedItem[] = [
    // Citas: el shape de Appointment del POS no incluye `sale.id`, así que
    // por ahora dejamos earnings en null para appointments. El total del UI
    // sale del totalCents de la cita; la comisión se ve agregada en el hero.
    // Si en una futura iteración expandimos la query de agenda con sale.id,
    // las citas también mostrarán "Tu parte" per-row.
    ...completedAppts.map((a): CompletedItem => ({
      id: `appt-${a.id}`,
      kind: 'appt',
      timeAt: a.endAt,
      customerName: a.customer?.fullName ?? 'Mostrador',
      serviceLabel: apptServiceLabel(a),
      totalCents: a.totalCents,
      saleId: null,
      commissionCents: null,
      tipCents: null,
      earningsCents: null,
    })),
    ...completedWalkIns.map((w): CompletedItem => {
      const saleId = w.sale?.id ?? null
      const e = saleId ? perSaleMap.get(saleId) : undefined
      return {
        id: `walkin-${w.id}`,
        kind: 'walkin',
        timeAt: w.assignedAt ?? w.createdAt,
        customerName: w.customer?.fullName ?? w.customerName ?? 'Mostrador',
        serviceLabel: walkInServiceLabel(w),
        totalCents: w.sale?.totalCents ?? null,
        saleId,
        commissionCents: e?.commissionCents ?? null,
        tipCents: e?.tipCents ?? null,
        earningsCents: e?.earningsCents ?? null,
      }
    }),
    // Ventas directas — POS sales sin walk-in ni appointment linkados.
    // Aparecen como rows independientes para que el barbero vea TODA su
    // actividad del día. Multi-barbero: cada barbero ve solo SUS itemLabels
    // (no las partes de otros performers en la misma venta).
    ...Array.from(perSaleMap.entries())
      .filter(([, e]) => !e.linkedWalkInId && !e.linkedAppointmentId)
      .map(([saleId, e]): CompletedItem => ({
        id: `sale-${saleId}`,
        kind: 'sale',
        timeAt: e.soldAt,
        customerName: e.customerName ?? 'Mostrador',
        serviceLabel: e.itemLabels.length > 0 ? e.itemLabels.join(' · ') : '—',
        totalCents: e.attributedRevenueCents,
        saleId,
        commissionCents: e.commissionCents,
        tipCents: e.tipCents,
        earningsCents: e.earningsCents,
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
    hoursWorked: `${h}h ${m}m`,
    clockedIn,
    completedItems,
    upcomingAppts,
    breakdown,
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

  // Extracted en un callback para que mount + focus refetch reusen la misma
  // lógica. `showSpinner` = mount inicial muestra spinner; focus refetch hace
  // background revalidation sin parpadeo. `force` = focus / post-mutation
  // empuja network-only para asegurar freshness; mount inicial cache-first
  // para pintar instant desde el cache persistido (boot subsecuente del POS).
  const loadDay = useCallback((opts: { showSpinner: boolean; force: boolean }) => {
    if (!viewer || !locationId) return
    const d = todayISO()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    if (opts.showSpinner) setLoading(true)

    setLoadError(null)
    Promise.allSettled([
      agenda.getAppointments(d, d, locationId),
      clock.getEvents(viewer.staff.id, locationId, d, d),
      walkins.getWalkIns(locationId, todayStart.toISOString(), todayEnd.toISOString()),
      apollo.query<{
        staffDayEarnings: {
          serviceCommissionCents: number
          productCommissionCents: number
          tipsCents: number
          totalCommissionCents: number
          serviceRevenueCents: number
          productRevenueCents: number
          perSale: Array<{
            saleId: string
            commissionCents: number
            tipCents: number
            earningsCents: number
            soldAt: string
            customerName: string | null
            linkedWalkInId: string | null
            linkedAppointmentId: string | null
            itemLabels: string[]
            attributedRevenueCents: number
          }>
        }
      }>({
        query: POS_MY_DAY_EARNINGS,
        variables: { staffUserId: viewer.staff.id, locationId, date: d },
        fetchPolicy: opts.force ? 'network-only' : 'cache-first',
      }),
    ])
      .then(([apptsRes, eventsRes, walkinsRes, earningsRes]) => {
        const appts = apptsRes.status === 'fulfilled' ? apptsRes.value : []
        const events = eventsRes.status === 'fulfilled' ? eventsRes.value : []
        const wkins = walkinsRes.status === 'fulfilled' ? walkinsRes.value : []
        const earnings =
          earningsRes.status === 'fulfilled' ? earningsRes.value.data?.staffDayEarnings : null
        const breakdown: EarningsBreakdown = earnings
          ? {
              serviceCommissionCents: earnings.serviceCommissionCents,
              productCommissionCents: earnings.productCommissionCents,
              tipsCents: earnings.tipsCents,
              totalCommissionCents: earnings.totalCommissionCents,
              serviceRevenueCents: earnings.serviceRevenueCents,
              productRevenueCents: earnings.productRevenueCents,
            }
          : {
              serviceCommissionCents: 0,
              productCommissionCents: 0,
              tipsCents: 0,
              totalCommissionCents: 0,
              serviceRevenueCents: 0,
              productRevenueCents: 0,
            }
        const perSaleMap = new Map<string, PerSaleEntry>()
        earnings?.perSale.forEach((entry) => {
          perSaleMap.set(entry.saleId, {
            commissionCents: entry.commissionCents,
            tipCents: entry.tipCents,
            earningsCents: entry.earningsCents,
            soldAt: entry.soldAt,
            customerName: entry.customerName,
            linkedWalkInId: entry.linkedWalkInId,
            linkedAppointmentId: entry.linkedAppointmentId,
            itemLabels: entry.itemLabels,
            attributedRevenueCents: entry.attributedRevenueCents,
          })
        })
        setSummary(
          computeWorkSummary(appts, wkins, events, viewer.staff.id, breakdown, perSaleMap),
        )

        // Surface partial failures so the operator doesn't see "$0 ventas" silently
        // when the network/server actually failed. The view still renders with
        // whatever data did come through.
        const failures: string[] = []
        if (apptsRes.status === 'rejected') failures.push('citas')
        if (eventsRes.status === 'rejected') failures.push('reloj')
        if (walkinsRes.status === 'rejected') failures.push('fila')
        if (earningsRes.status === 'rejected') failures.push('ganancias')
        if (failures.length > 0) {
          setLoadError(`No se pudo cargar: ${failures.join(', ')}. Refresca o avisa al admin si persiste.`)
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.error('[MyDayPage] partial load failure', { apptsRes, eventsRes, walkinsRes, earningsRes })
          }
        }
      })
      .finally(() => setLoading(false))
  }, [agenda, clock, walkins, viewer, locationId, apollo])

  // Mount: cache-first pinta instant + network-only en background revalida.
  // Apollo.query() no admite cache-and-network, así que replicamos a mano.
  // Sin el segundo pase, navegar entre tabs nunca refrescaba data rancia
  // hasta el siguiente window.focus.
  useEffect(() => {
    loadDay({ showSpinner: true, force: false })
    loadDay({ showSpinner: false, force: true })
  }, [loadDay])

  // Refetch al volver a la tab — patrón espejo de HoyPage. Sin spinner +
  // network-only para asegurar datos frescos sin parpadear.
  useEffect(() => {
    const onFocus = () => loadDay({ showSpinner: false, force: true })
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadDay])

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

      {/* HERO: ganancias del barbero, no ventas brutas. El barbero quiere
          saber CUÁNTO se lleva hoy, no cuánto vendió el negocio. */}
      <EarningsHero summary={summary} loading={loading} />

      {/* DESGLOSE: de dónde viene el total — servicios, productos, propinas. */}
      <EarningsBreakdownRow summary={summary} loading={loading} />

      {/* OPERACIÓN: stats secundarios — citas + tiempo. Más chicos, no compiten
          con el hero. */}
      <div className="grid grid-cols-2 gap-3">
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
  earningsCents,
  tipCents,
  kind,
}: CompletedItem) {
  const time = new Date(timeAt).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  // "Tu parte" es el protagonista visual; el total es contexto. Cuando no
  // tenemos el earnings (sin sale linkado), mostramos solo el total como
  // fallback — pasa para citas pre-sale linkada en este modelo.
  return (
    <div className="grid grid-cols-[64px_1fr_auto] items-start gap-4 border-b border-[var(--color-leather-muted)]/20 px-4 py-3 last:border-b-0">
      <span className="pt-0.5 font-mono text-[14px] font-bold tabular-nums text-[var(--color-bone)]">
        {time}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold text-[var(--color-bone)]">
          {customerName}
        </p>
        <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
          {kind === 'walkin' ? 'Walk-in' : kind === 'sale' ? 'Venta' : 'Cita'} · {serviceLabel}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        {earningsCents != null ? (
          <>
            <span className="font-[var(--font-pos-display)] text-[20px] font-extrabold tabular-nums leading-none text-[var(--color-bone)]">
              {formatMoney(earningsCents)}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
              Tu parte{tipCents && tipCents > 0 ? ` · incl. ${formatMoney(tipCents)} propina` : ''}
            </span>
            {totalCents != null && totalCents !== earningsCents && (
              <span className="font-mono text-[9px] tabular-nums text-[var(--color-leather)]">
                Total {formatMoney(totalCents)}
              </span>
            )}
          </>
        ) : totalCents != null ? (
          <>
            <span className="font-[var(--font-pos-display)] text-[18px] font-extrabold tabular-nums leading-none text-[var(--color-bone-muted)]">
              {formatMoney(totalCents)}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-leather)]">
              Total venta
            </span>
          </>
        ) : (
          <span aria-hidden />
        )}
      </div>
    </div>
  )
}

/**
 * Hero principal: lo que el barbero se lleva hoy. Display monumental
 * carbón sobre bone, subtitle muted con contexto de ventas brutas.
 */
function EarningsHero({
  summary,
  loading,
}: {
  summary: DaySummary | null
  loading: boolean
}) {
  const totalEarnings = summary?.breakdown.totalCommissionCents ?? 0
  const grossRevenue =
    (summary?.breakdown.serviceRevenueCents ?? 0) +
    (summary?.breakdown.productRevenueCents ?? 0)
  return (
    <div className="border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-5 py-6">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
        Lo que llevas hoy
      </p>
      {loading ? (
        <div className="mt-2 h-12 w-48 animate-pulse rounded bg-[var(--color-leather-muted)]/20" />
      ) : (
        <p className="mt-2 font-[var(--font-pos-display)] text-[48px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[var(--color-bone)]">
          {formatMoney(totalEarnings)}
        </p>
      )}
      {!loading && grossRevenue > 0 && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-leather)]">
          De {formatMoney(grossRevenue)} en ventas
        </p>
      )}
    </div>
  )
}

/**
 * Desglose 3 categorías: Servicios · Productos · Propinas. Cada columna
 * muestra cuánto del total viene de esa fuente. Si una categoría es 0 se
 * muestra apagada para no romper el grid pero quede claro el aporte.
 */
function EarningsBreakdownRow({
  summary,
  loading,
}: {
  summary: DaySummary | null
  loading: boolean
}) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse border border-[var(--color-leather-muted)]/40 bg-[var(--color-cuero-viejo)]/20"
          />
        ))}
      </div>
    )
  }
  const { serviceCommissionCents, productCommissionCents, tipsCents, totalCommissionCents } =
    summary.breakdown
  return (
    <div className="grid grid-cols-3 gap-3">
      <BreakdownCard
        label="Cortes & Barba"
        valueCents={serviceCommissionCents}
        totalCents={totalCommissionCents}
      />
      <BreakdownCard
        label="Propinas"
        valueCents={tipsCents}
        totalCents={totalCommissionCents}
        accent
      />
      <BreakdownCard
        label="Productos"
        valueCents={productCommissionCents}
        totalCents={totalCommissionCents}
      />
    </div>
  )
}

function BreakdownCard({
  label,
  valueCents,
  totalCents,
  accent,
}: {
  label: string
  valueCents: number
  totalCents: number
  accent?: boolean
}) {
  const pct = totalCents > 0 ? Math.round((valueCents / totalCents) * 100) : 0
  const isZero = valueCents === 0
  return (
    <div
      className={`border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-4 py-4 ${
        accent && !isZero ? 'border-l-[2px] border-l-[var(--color-bravo)]' : ''
      }`}
    >
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
        {label}
      </p>
      <p
        className={`mt-2 font-[var(--font-pos-display)] text-[22px] font-extrabold leading-none tabular-nums ${
          isZero ? 'text-[var(--color-leather)]' : 'text-[var(--color-bone)]'
        }`}
      >
        {formatMoney(valueCents)}
      </p>
      {totalCents > 0 && !isZero && (
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-leather)]">
          {pct}% del día
        </p>
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
