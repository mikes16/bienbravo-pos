import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { localDayInTz, localDayRangeInTz, formatTimeInTz } from '@/shared/lib/date'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import { useFreshness, useLiveRefresh } from '@/core/freshness/useLiveRefresh'
import type { FreshnessTopic } from '@/core/freshness/FreshnessProvider'
import { MoneyValue, TouchButton, type MoneyValueStatus } from '@/shared/pos-ui'
import { POS_MY_DAY_EARNINGS } from '@/features/home/data/home.queries'
import type { Appointment } from '@/features/agenda/domain/agenda.types.ts'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository.ts'
import type { WalkIn } from '@/features/walkins/domain/walkins.types.ts'
import { SaleDetailSheet } from './SaleDetailSheet.tsx'

/** Target del bottom sheet de detalle: qué venta abrir y la comisión del
 *  viewer para esa venta ("Tu parte"). null = sheet cerrado. */
interface SaleDetailTarget {
  saleId: string
  tuParteCents: number | null
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
  /** `null` = "no sé": las ventas directas del día salen de la consulta de
   *  dinero, así que sin ella el conteo es desconocido ([D-020]). */
  completedCount: number | null
  hoursWorked: string
  clockedIn: boolean
  completedItems: CompletedItem[]
  upcomingAppts: UpcomingAppt[]
}

/** Lo VIVO sin dinero de Mi Día (spec 2026-09-18 § 3.1): agenda, fila y reloj
 *  del operador. Se revalida siempre contra la red, la carga de montaje
 *  incluida. */
interface MyDayBoard {
  appointments: Appointment[]
  walkIns: WalkIn[]
  clockEvents: TimeClockEvent[]
}

/** Lo que Mi Día lee del día del barbero en clase DINERO: el desglose de
 *  ganancias y el detalle por venta. */
interface MyDayEarnings {
  breakdown: EarningsBreakdown
  perSale: Map<string, PerSaleEntry>
}

interface EarningsQueryData {
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
  } | null
}

// Temas del canal ÚNICO de avisos (src/core/freshness). Constantes de módulo:
// un literal nuevo en cada render re-registraría el cargador sin parar.
/** El dinero del barbero sólo se mueve con ventas. */
const MONEY_TOPICS: readonly FreshnessTopic[] = ['sales']
/** La lista de servicios y lo que viene se mueven con la fila y la agenda. */
const BOARD_TOPICS: readonly FreshnessTopic[] = ['walkins', 'appointments']

/** Nombres accesibles de las cifras de dinero ([D-006]: label obligatorio). */
const EARNINGS_LABEL = 'Lo que llevas hoy'
const GROSS_LABEL = 'Ventas que atendiste hoy'

/**
 * Ver cuánto VENDIÓ el barbero (el bruto: ventas del hero y "Total venta" de
 * cada fila). Pedido del dueño: el barbero ve su comisión, no lo que facturó;
 * quien tenga este permiso (lo da de alta el API) sigue viendo el bruto. Sólo
 * gatea lo que se PINTA: la consulta de ganancias no cambia.
 */
const MY_SALES_REVENUE_READ = 'pos.my_sales.revenue.read'

const LIST_ERROR_MESSAGE =
  'No se pudo cargar tu día. Toca Reintentar o avisa al admin si persiste.'

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
  /** `null` mientras el servidor no responda el dinero del día. */
  earnings: MyDayEarnings | null,
): DaySummary {
  const perSaleMap = earnings?.perSale ?? new Map<string, PerSaleEntry>()
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
  // Sin la respuesta de dinero el conteo es desconocido: la vista lo pinta
  // como esqueleto en vez de anunciar un total incompleto.
  const completedCount =
    earnings === null ? null : completedAppts.length + completedWalkIns.length + directSales.length

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
  }
}

interface KPICardProps {
  label: string
  /** `null` = todavía no se sabe: esqueleto, nunca un cero inventado. */
  value: string | null
}

function KPICard({ label, value }: KPICardProps) {
  return (
    <div className="border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-4 py-4">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
        {label}
      </p>
      {value === null ? (
        <div
          aria-hidden
          className="mt-2 h-7 w-16 animate-pulse rounded bg-[var(--color-leather-muted)]/20 motion-reduce:animate-none"
        />
      ) : (
        <p className="mt-2 font-[var(--font-pos-display)] text-[28px] font-extrabold tabular-nums leading-none text-[var(--color-bone)]">
          {value}
        </p>
      )}
    </div>
  )
}

/**
 * "Mi Día": lo que el barbero se lleva hoy y los servicios que atendió.
 *
 * Reglas del lote de frescura (spec 2026-09-18 §§ 3.1, 3.1b y 3.3):
 * - El dinero (`staffDayEarnings`) se pide SIEMPRE a la red. No hay política
 *   alternativa ni parámetro para pedirlo de la memoria ([D-017]): con varias
 *   iPads cobrando, una cifra guardada está mal en cuanto otra terminal cobra.
 * - Toda cifra de dinero se pinta con `MoneyValue` ([D-005]): esqueleto
 *   mientras no hay respuesta, aviso si falló. Nunca `$0` falso ni la cifra
 *   anterior haciéndose pasar por la de ahora ([D-018]).
 * - Los avisos llegan por UN solo canal (`src/core/freshness`). Esta pantalla
 *   ya no abre conexiones en vivo propias ni vigila el foco/visibilidad de la
 *   ventana, y registra una carga POR CLASE de dato ([D-019]): el tema
 *   `sales` recarga el dinero; `walkins`/`appointments` recargan la lista.
 */
export function MyDayPage() {
  const apollo = useApolloClient()
  const { viewer } = usePosAuth()
  const { locationId, locationTimezone } = useLocation()
  const { agenda, clock, walkins } = useRepositories()
  // Estado del canal en vivo: distingue "se cayó la red" de "el servidor
  // respondió con error" para las cifras de dinero (spec § 3.1b).
  const { connection } = useFreshness()

  const [board, setBoard] = useState<MyDayBoard | null>(null)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [boardRefreshing, setBoardRefreshing] = useState(false)
  const [earnings, setEarnings] = useState<MyDayEarnings | null>(null)
  const [earningsFailed, setEarningsFailed] = useState(false)
  const [earningsRefreshing, setEarningsRefreshing] = useState(false)
  const [detailTarget, setDetailTarget] = useState<SaleDetailTarget | null>(null)

  const staffName = viewer?.staff?.fullName ?? ''

  // Gate del detalle de venta. El permiso `pos.sale.read` decide si las rows
  // de "Servicios de hoy" son tappables. Sin el permiso, las rows NO son
  // clickable (sin cursor, sin onClick) y el sheet nunca abre — barrera dura
  // pedida por el dueño. El API además gatea el resolver `sale(id)`.
  const canViewSaleDetail = (viewer?.permissions ?? []).includes('pos.sale.read')

  // Gate del bruto (`MY_SALES_REVENUE_READ`). Sin el permiso el hero pinta
  // sólo la comisión y una fila sin "Tu parte" no pinta monto alguno.
  const canViewRevenue = (viewer?.permissions ?? []).includes(MY_SALES_REVENUE_READ)

  // --- Lecturas puras (sin tocar estado) ------------------------------------
  // Se usan tal cual en el montaje y detrás de los cargadores del canal de
  // frescura; así ningún setState cuelga del cuerpo de un efecto.

  const fetchBoard = useCallback(async (): Promise<MyDayBoard | null> => {
    if (!viewer || !locationId) return null
    const day = localDayInTz(new Date(), locationTimezone)
    const { startUtc, endUtc } = localDayRangeInTz(day, locationTimezone)
    // `Promise.all`: si alguna de las tres falla, la carga entera falla. Una
    // lista a medias en una pantalla de dinero es peor que decir "no pude".
    const [appointments, clockEvents, walkInRows] = await Promise.all([
      // walkIns y appointments SIEMPRE por red: son listas que cambian por
      // mutaciones laterales (createPOSSale, assign, complete) y lo guardado
      // mostraba data zombie tras cobrar (mismo bug que Hoy).
      agenda.getAppointments(day, day, locationId, undefined, { force: true }),
      clock.getEvents(viewer.staff.id, locationId, day, day),
      walkins.getWalkIns(locationId, startUtc.toISOString(), endUtc.toISOString(), { force: true }),
    ])
    return { appointments, walkIns: walkInRows, clockEvents }
  }, [agenda, clock, walkins, viewer, locationId, locationTimezone])

  const fetchEarnings = useCallback(async (): Promise<MyDayEarnings | null> => {
    if (!viewer || !locationId) return null
    const day = localDayInTz(new Date(), locationTimezone)
    const res = await apollo.query<EarningsQueryData>({
      query: POS_MY_DAY_EARNINGS,
      variables: { staffUserId: viewer.staff.id, locationId, date: day },
      // DINERO: siempre de la red, sin política alternativa (spec § 3.1 y
      // [D-017]). El costo es un esqueleto de carga; el beneficio es que la
      // cifra en pantalla es la que acaba de responder el servidor.
      fetchPolicy: 'network-only',
    })
    const data = res.data?.staffDayEarnings
    // Sin dato NO es cero: se trata como fallo para que las cifras caigan a
    // "no se pudo cargar" en vez de anunciar $0 de ganancias.
    if (!data) throw new Error('El servidor no devolvió tus ganancias del día.')
    const perSale = new Map<string, PerSaleEntry>()
    data.perSale.forEach((entry) => {
      perSale.set(entry.saleId, {
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
    return {
      breakdown: {
        serviceCommissionCents: data.serviceCommissionCents,
        productCommissionCents: data.productCommissionCents,
        tipsCents: data.tipsCents,
        totalCommissionCents: data.totalCommissionCents,
        serviceRevenueCents: data.serviceRevenueCents,
        productRevenueCents: data.productRevenueCents,
      },
      perSale,
    }
  }, [apollo, viewer, locationId, locationTimezone])

  // --- Cargas registradas en el canal de frescura ---------------------------
  // Devuelven su promesa y dejan pasar el error: el canal sólo mueve la hora
  // del último dato si TODAS las cargas resolvieron.

  const loadBoard = useCallback((): Promise<void> => {
    if (!viewer || !locationId) return Promise.resolve()
    setBoardRefreshing(true)
    return fetchBoard()
      .then((next) => {
        if (!next) return
        setBoardError(null)
        setBoard(next)
      })
      .catch((err: unknown) => {
        // [D-018]: al fallar se tira la lista. Nunca queda la anterior
        // acompañada de un banner, haciéndose pasar por la de ahora.
        setBoard(null)
        setBoardError(LIST_ERROR_MESSAGE)
        throw err
      })
      .finally(() => {
        setBoardRefreshing(false)
      })
  }, [fetchBoard, viewer, locationId])

  const loadEarnings = useCallback((): Promise<void> => {
    if (!viewer || !locationId) return Promise.resolve()
    setEarningsRefreshing(true)
    return fetchEarnings()
      .then((next) => {
        if (!next) return
        setEarningsFailed(false)
        setEarnings(next)
      })
      .catch((err: unknown) => {
        setEarnings(null)
        setEarningsFailed(true)
        throw err
      })
      .finally(() => {
        setEarningsRefreshing(false)
      })
  }, [fetchEarnings, viewer, locationId])

  // Un solo canal de avisos para todo el POS: esta pantalla ya no abre sus
  // propias conexiones en vivo ni escucha focus/visibilitychange (de eso se
  // encarga FreshnessProvider una vez por sucursal). Cada tema mueve lo suyo
  // ([D-019]): una venta de otra iPad recarga el dinero; la fila y la agenda
  // recargan la lista de servicios.
  useLiveRefresh(loadEarnings, MONEY_TOPICS)
  useLiveRefresh(loadBoard, BOARD_TOPICS)

  // Carga inicial. El efecto sólo lanza las lecturas: no llama a los `load*`
  // ni escribe estado en su cuerpo — todo setState vive en los callbacks de
  // la promesa, con `cancelled` para no pintar sobre un componente desmontado.
  useEffect(() => {
    if (!viewer || !locationId) return
    let cancelled = false
    void fetchBoard()
      .then((next) => {
        if (cancelled || !next) return
        setBoard(next)
      })
      .catch(() => {
        if (cancelled) return
        setBoardError(LIST_ERROR_MESSAGE)
      })
    void fetchEarnings()
      .then((next) => {
        if (cancelled || !next) return
        setEarnings(next)
      })
      .catch(() => {
        if (cancelled) return
        setEarningsFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [viewer, locationId, fetchBoard, fetchEarnings])

  const retryEarnings = useCallback(() => {
    // El fallo ya se pinta en la cifra; acá sólo se evita la promesa suelta.
    void loadEarnings().catch(() => {})
  }, [loadEarnings])

  const retryBoard = useCallback(() => {
    void loadBoard().catch(() => {})
  }, [loadBoard])

  // Estados de una cifra de dinero (spec § 3.1b). "No sé" nunca se disfraza
  // de $0: sin respuesta del servidor es esqueleto y, si falló, es aviso.
  // `updating` sólo cuando YA hay una cifra del servidor y se pidió la nueva.
  const moneyStatus: MoneyValueStatus = earningsFailed
    ? connection === 'offline'
      ? 'offline'
      : 'error'
    : earnings === null
      ? 'loading'
      : earningsRefreshing
        ? 'updating'
        : 'fresh'

  // Los montos que vienen de la agenda/fila (el total de una venta linkada a
  // un walk-in) siguen la suerte de esa carga, no la del desglose de dinero.
  const listMoneyStatus: MoneyValueStatus = boardError
    ? connection === 'offline'
      ? 'offline'
      : 'error'
    : board === null
      ? 'loading'
      : boardRefreshing
        ? 'updating'
        : 'fresh'

  const summary = useMemo<DaySummary | null>(() => {
    if (!board || !viewer) return null
    return computeWorkSummary(
      board.appointments,
      board.walkIns,
      board.clockEvents,
      viewer.staff.id,
      earnings,
    )
  }, [board, earnings, viewer])

  // Sin el permiso del bruto la cifra ni se calcula: el hero no la recibe.
  const grossRevenueCents =
    canViewRevenue && earnings
      ? earnings.breakdown.serviceRevenueCents + earnings.breakdown.productRevenueCents
      : null

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

      {/* HERO: ganancias del barbero, no ventas brutas. El barbero quiere
          saber CUÁNTO se lleva hoy, no cuánto vendió el negocio. */}
      <EarningsHero
        commissionCents={earnings?.breakdown.totalCommissionCents ?? null}
        grossRevenueCents={grossRevenueCents}
        status={moneyStatus}
        onRetry={retryEarnings}
      />

      {/* DESGLOSE: de dónde viene el total — servicios, productos, propinas. */}
      <EarningsBreakdownRow breakdown={earnings?.breakdown ?? null} status={moneyStatus} />

      {/* OPERACIÓN: stats secundarios — citas + tiempo. Más chicos, no compiten
          con el hero. */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard
          label="Citas completadas"
          value={summary?.completedCount != null ? String(summary.completedCount) : null}
        />
        <KPICard label="Tiempo trabajado" value={summary ? summary.hoursWorked : null} />
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
                <UpcomingRow {...a} tz={locationTimezone} />
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
            summary?.completedCount == null
              ? 'Servicios de hoy'
              : `Servicios de hoy · ${summary.completedCount} ${
                  summary.completedCount === 1 ? 'realizado' : 'realizados'
                }`
          }
          tone="bone"
        />
        {boardError ? (
          // La lista vieja no se queda haciéndose pasar por la de ahora.
          <div
            role="alert"
            className="flex flex-col items-start gap-3 border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/10 px-4 py-3"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-bravo)]">
              {boardError}
            </p>
            <TouchButton variant="secondary" size="min" onClick={retryBoard}>
              Reintentar
            </TouchButton>
          </div>
        ) : summary === null ? (
          // Filas esqueleto, nunca una lista vacía que parezca "no atendí a nadie".
          <ul className="flex flex-col gap-px border border-[var(--color-leather-muted)]/40">
            {[1, 2, 3].map((i) => (
              <li
                key={i}
                className="h-16 animate-pulse bg-[var(--color-cuero-viejo)]/30 motion-reduce:animate-none"
              />
            ))}
          </ul>
        ) : summary.completedItems.length === 0 ? (
          <div className="border border-[var(--color-leather-muted)]/40 px-5 py-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
              Aún no hay servicios cerrados hoy.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col border border-[var(--color-leather-muted)]/40">
            {summary.completedItems.map((item) => (
              <li key={item.id}>
                <CompletedRow
                  item={item}
                  tz={locationTimezone}
                  moneyStatus={moneyStatus}
                  listMoneyStatus={listMoneyStatus}
                  showsSaleTotal={canViewRevenue}
                  onOpenDetail={
                    canViewSaleDetail && item.saleId
                      ? () =>
                          setDetailTarget({
                            saleId: item.saleId!,
                            tuParteCents: item.earningsCents,
                          })
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Bottom sheet del desglose de la venta. Solo se monta con un target
          activo, que únicamente se setea cuando el viewer tiene el permiso
          y la row tiene saleId. */}
      <SaleDetailSheet
        open={!!detailTarget}
        saleId={detailTarget?.saleId}
        tuParteCents={detailTarget?.tuParteCents}
        onClose={() => setDetailTarget(null)}
      />
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
  item,
  tz,
  moneyStatus,
  listMoneyStatus,
  showsSaleTotal,
  onOpenDetail,
}: {
  item: CompletedItem
  /** Tz de la sucursal — la hora de la row se lee en esta tz, no en la del
   *  device. */
  tz: string
  /** Estado del desglose de ganancias (de dónde sale "Tu parte"). */
  moneyStatus: MoneyValueStatus
  /** Estado de la agenda/fila (de dónde sale el total de la venta linkada). */
  listMoneyStatus: MoneyValueStatus
  /** El viewer tiene `pos.my_sales.revenue.read`: sin "Tu parte" la fila cae
   *  al total de la venta. Sin el permiso esa fila no pinta monto. */
  showsSaleTotal: boolean
  /** Definido SOLO cuando la row es tappable: el viewer tiene `pos.sale.read`
   *  y la row tiene saleId. Si es undefined, la row se renderiza como un div
   *  no interactivo (sin cursor, sin onClick) — el gate duro. */
  onOpenDetail?: () => void
}) {
  const { timeAt, customerName, serviceLabel, totalCents, earningsCents, tipCents, kind } = item
  const time = formatTimeInTz(timeAt, tz)

  // El permiso decide si la row es interactiva. Con `pos.sale.read` + saleId la
  // row es un <button> (cursor-pointer + onClick que abre el sheet). Sin el
  // permiso (o sin saleId) es un <div> plano: ni cursor ni onClick ni
  // affordance — barrera dura pedida por el dueño.
  const interactive = !!onOpenDetail
  const Tag = interactive ? 'button' : 'div'

  // UNA sola cifra por fila y siempre con MoneyValue ([D-005]): "Tu parte"
  // cuando el desglose del servidor la conoce, el total de la venta cuando
  // todavía no hay comisión atribuida. El desglose completo (total, propina,
  // items) vive en la hoja de detalle, a un tap de distancia. El total de la
  // venta (bruto) sólo se pinta con `pos.my_sales.revenue.read`.
  const showsEarnings = earningsCents != null
  const amountCents = showsEarnings ? earningsCents : showsSaleTotal ? totalCents : null
  const amountStatus = showsEarnings ? moneyStatus : listMoneyStatus
  const amountLabel = showsEarnings
    ? `Tu parte de ${customerName}`
    : `Total de la venta de ${customerName}`
  const amountCaption = showsEarnings
    ? `Tu parte${tipCents && tipCents > 0 ? ' · incluye propina' : ''}`
    : 'Total venta'

  return (
    <Tag
      {...(interactive
        ? {
            type: 'button' as const,
            onClick: onOpenDetail,
            'aria-label': `Ver detalle de venta de ${customerName}`,
          }
        : {})}
      className={`grid w-full grid-cols-[64px_1fr_auto] items-start gap-4 border-b border-[var(--color-leather-muted)]/20 px-4 py-3 text-left last:border-b-0 ${
        interactive
          ? 'cursor-pointer transition-colors hover:bg-[var(--color-cuero-viejo)]/20'
          : ''
      }`}
    >
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
        {amountCents != null ? (
          <>
            <MoneyValue
              status={amountStatus}
              cents={amountCents}
              label={amountLabel}
              size="S"
              className="items-end"
            />
            <span
              className={`font-mono text-[9px] uppercase tracking-[0.18em] ${
                showsEarnings ? 'text-[var(--color-bone-muted)]' : 'text-[var(--color-leather)]'
              }`}
            >
              {amountCaption}
            </span>
          </>
        ) : (
          // Cita cerrada sin venta linkada, o fila sin "Tu parte" para un
          // viewer sin permiso del bruto: no hay monto que mostrar. No es
          // "no sé" (no habría qué cargar), así que tampoco va un esqueleto.
          <span aria-hidden />
        )}
      </div>
    </Tag>
  )
}

/**
 * Hero principal: lo que el barbero se lleva hoy. Dos cifras del servidor —
 * su comisión del día y las ventas que atendió — ambas con MoneyValue, así
 * que mientras el servidor no responda son esqueleto y un fallo nunca deja
 * la cifra anterior en pantalla. Las ventas (bruto) sólo llegan con
 * `pos.my_sales.revenue.read`; sin él `grossRevenueCents` es null y el hero
 * queda con la comisión sola (estados de carga/aviso/Reintentar intactos).
 */
function EarningsHero({
  commissionCents,
  grossRevenueCents,
  status,
  onRetry,
}: {
  commissionCents: number | null
  grossRevenueCents: number | null
  status: MoneyValueStatus
  onRetry: () => void
}) {
  return (
    <div className="border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-5 py-6">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
        Lo que llevas hoy
      </p>
      <MoneyValue
        status={status}
        cents={commissionCents}
        label={EARNINGS_LABEL}
        size="M"
        onRetry={onRetry}
        className="mt-2"
      />
      {grossRevenueCents !== null && grossRevenueCents > 0 && (
        <div className="mt-4 flex items-baseline gap-3">
          <MoneyValue status={status} cents={grossRevenueCents} label={GROSS_LABEL} size="S" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-leather)]">
            en ventas
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Desglose 3 categorías: Servicios · Propinas · Productos. Cada columna
 * muestra cuánto del total viene de esa fuente. Sin respuesta del servidor
 * las tres son esqueleto: un cero real ("hoy no llevo propinas") sólo se
 * pinta cuando el desglose llegó.
 */
function EarningsBreakdownRow({
  breakdown,
  status,
}: {
  breakdown: EarningsBreakdown | null
  status: MoneyValueStatus
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <BreakdownCard
        label="Servicios"
        moneyLabel="Comisión por servicios"
        valueCents={breakdown?.serviceCommissionCents ?? null}
        totalCents={breakdown?.totalCommissionCents ?? null}
        status={status}
      />
      <BreakdownCard
        label="Propinas"
        moneyLabel="Propinas"
        valueCents={breakdown?.tipsCents ?? null}
        totalCents={breakdown?.totalCommissionCents ?? null}
        status={status}
        accent
      />
      <BreakdownCard
        label="Productos"
        moneyLabel="Comisión por productos"
        valueCents={breakdown?.productCommissionCents ?? null}
        totalCents={breakdown?.totalCommissionCents ?? null}
        status={status}
      />
    </div>
  )
}

function BreakdownCard({
  label,
  moneyLabel,
  valueCents,
  totalCents,
  status,
  accent,
}: {
  label: string
  /** Nombre accesible de la cifra ([D-006]); el rótulo visible es `label`. */
  moneyLabel: string
  valueCents: number | null
  totalCents: number | null
  status: MoneyValueStatus
  accent?: boolean
}) {
  const isZero = valueCents === 0
  const pct =
    valueCents !== null && totalCents !== null && totalCents > 0 && !isZero
      ? Math.round((valueCents / totalCents) * 100)
      : null
  return (
    <div
      className={`border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-4 py-4 ${
        accent && !isZero ? 'border-l-[2px] border-l-[var(--color-bravo)]' : ''
      }`}
    >
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
        {label}
      </p>
      <MoneyValue
        status={status}
        cents={valueCents}
        label={moneyLabel}
        size="S"
        className="mt-2"
      />
      {pct !== null && (
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-leather)]">
          {pct}% del día
        </p>
      )}
    </div>
  )
}

function UpcomingRow({ startAt, customerName, serviceLabel, tz }: UpcomingAppt & { tz: string }) {
  const time = formatTimeInTz(startAt, tz)
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
