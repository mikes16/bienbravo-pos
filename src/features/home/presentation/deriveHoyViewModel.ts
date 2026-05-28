import type { Appointment } from '@/features/agenda/domain/agenda.types'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository'
import type { WalkIn } from '@/features/walkins/domain/walkins.types'

export interface HoyViewModelInput {
  staffId: string
  staffName: string
  appointments: Appointment[]
  walkIns: WalkIn[]
  clockEvents: TimeClockEvent[]
  commission: { amountCents: number; serviceCount: number; loading: boolean }
  caja: { isOpen: boolean; accumulatedCents: number | null; openedAt: Date | null }
}

export interface HoyRowData {
  id: string
  kind: 'active' | 'next' | 'queue' | 'pending'
  timeLabel: string
  customerName: string
  customerId: string | null
  customerPhotoUrl: string | null
  customerInitials: string
  serviceLabel: string
  meta: string | null
  pillLabel: string
  pillTone: 'serving' | 'appt' | 'walkin'
  sourceKind: 'appointment' | 'walk-in'
  sourceId: string
  // True when the appointment/walk-in is assigned to the viewing barber.
  // Used to highlight "tuyo" rows when we show the full queue (not just mine).
  isMine: boolean
  // Who's assigned (for showing "asignado a Juan" on rows that aren't mine).
  assignedToName: string | null
  // Solo para filas kind='queue'. Datos del barbero al que el cliente le
  // pidió específicamente (si lo hubo). Lo expone el row para que HoyPage
  // pueda construir el target del TakeWalkInSheet sin re-mirar el walk-in
  // original — ya viene resuelto aquí.
  queuePreferredStaffUserId?: string | null
  queuePreferredStaffName?: string | null
  // Minutos de espera del walk-in en cola. Sirve para el meta de TakeWalkInSheet
  // sin que tenga que recalcularse a partir de createdAt (drift potencial).
  queueWaitMinutes?: number
}

export interface ContextualCTAData {
  metaLabel?: string
  actionLabel: string
  variant: 'cobrar' | 'atender' | 'abrir-caja' | 'nueva-venta'
  targetId?: string
  targetKind?: 'appointment' | 'walk-in'
  targetCustomerId?: string | null
}

export type HoyGate =
  | { kind: 'clock-in' }
  | { kind: 'caja' }

export interface HoyViewModel {
  staffName: string
  commission: { amountCents: number; serviceCount: number; loading: boolean; projectedCents: number | null }
  rows: HoyRowData[]
  cta: ContextualCTAData
  cajaIsOpen: boolean
  // When set, Hoy is blocked by a missing prerequisite. Clock-in takes priority
  // over caja: the operator must start their day before the cash register matters.
  gate: HoyGate | null
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function formatTimeMx(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
}

export function deriveHoyViewModel(input: HoyViewModelInput): HoyViewModel {
  const { staffId, staffName, appointments, walkIns, clockEvents, commission, caja } = input

  // Clock-in detection: latest event today, sorted ascending.
  // Clocked-in iff the last event is CLOCK_IN. No events ⇒ not clocked in.
  const sortedClock = [...clockEvents].sort((a, b) => a.at.localeCompare(b.at))
  const lastClockEvent = sortedClock[sortedClock.length - 1]
  const isClockedIn = lastClockEvent?.type === 'CLOCK_IN'

  let gate: HoyGate | null = null
  if (!isClockedIn) gate = { kind: 'clock-in' }
  else if (!caja.isOpen) gate = { kind: 'caja' }

  // Hoy is "what's happening right now". Already-finished work (COMPLETED appts,
  // DONE walk-ins, CANCELLED/NO_SHOW) shouldn't crowd the queue or get picked as
  // the "next" target — the API rejects retrying those, and the operator can't
  // act on them anyway.
  // Owner feedback (1.7): mostrar toda la fila a todos los barberos. El que
  // ejecuta puede ser cualquiera — el barbero asignado, o cualquier compañero
  // que tome el cliente si quien estaba asignado no está disponible. Marcamos
  // visualmente con `isMine` cuáles son del viewer.
  const activeAppts = appointments.filter(
    (a) =>
      a.status !== 'COMPLETED' &&
      a.status !== 'CANCELLED' &&
      a.status !== 'NO_SHOW',
  )
  const assignedWalkIns = walkIns.filter(
    (w) =>
      w.assignedStaffUser != null &&
      w.status !== 'DONE' &&
      w.status !== 'CANCELLED',
  )
  const queueWalkIns = walkIns.filter(
    (w) => w.status === 'PENDING' && (w.assignedStaffUser === null || w.assignedStaffUser === undefined),
  )

  type Candidate = { row: HoyRowData; sortKey: string; isActive: boolean; isPending: boolean }
  const candidates: Candidate[] = []

  for (const a of activeAppts) {
    const customer = (a.customer ?? null) as { id?: string; fullName?: string; photoUrl?: string | null } | null
    const customerId = customer?.id ?? null
    const customerName = customer?.fullName ?? 'Cliente'
    const photo = customer?.photoUrl ?? null
    const isInService = a.status === 'IN_SERVICE'
    const isPending = a.status === 'CONFIRMED' || a.status === 'CHECKED_IN'
    const startAt = a.startAt
    const minutes = isInService ? minutesSince(startAt) : 0
    const timeLabel = isInService ? `EN SERVICIO · ${minutes} MIN` : formatTimeMx(startAt)

    candidates.push({
      row: {
        id: `appt-${a.id}`,
        kind: isInService ? 'active' : 'pending',
        timeLabel,
        customerName,
        customerId,
        customerPhotoUrl: photo,
        customerInitials: getInitials(customerName),
        serviceLabel: a.items[0]?.label ?? 'Servicio',
        meta: isInService ? `cita ${formatTimeMx(startAt)}` : null,
        pillLabel: 'Cita',
        pillTone: isInService ? 'serving' : 'appt',
        sourceKind: 'appointment',
        sourceId: a.id,
        isMine: a.staffUser?.id === staffId,
        assignedToName: a.staffUser?.fullName ?? null,
      },
      sortKey: startAt,
      isActive: isInService,
      isPending,
    })
  }

  for (const w of assignedWalkIns) {
    const customer = w.customer ?? null
    const customerId = customer?.id ?? null
    const customerName = customer?.fullName ?? w.customerName ?? 'Walk-in'
    const isAssigned = w.status === 'ASSIGNED'
    // Dos timers distintos importan:
    //   - serviceMinutes: tiempo real en servicio (assignedAt → ahora). Mide
    //     productividad del barbero. Es el que mostramos como "EN SERVICIO · X".
    //   - waitMinutes:    tiempo de espera previo (createdAt → assignedAt).
    //     Mide experiencia del cliente. Lo mostramos como meta secundario.
    // Si por alguna razón no hay assignedAt (legacy walk-in pre-feature),
    // caemos a createdAt como guard para no romper el render.
    const serviceMinutes = w.assignedAt
      ? Math.max(0, Math.round((Date.now() - new Date(w.assignedAt).getTime()) / 60_000))
      : minutesSince(w.createdAt)
    const waitMinutes = w.assignedAt
      ? Math.max(0, Math.round((new Date(w.assignedAt).getTime() - new Date(w.createdAt).getTime()) / 60_000))
      : 0
    const timeLabel = isAssigned ? `EN SERVICIO · ${serviceMinutes} MIN` : formatTimeMx(w.createdAt)
    const assignedToViewer = w.assignedStaffUser?.id === staffId
    // Pill contextual: comunica el ESTADO + dueño en una sola palabra. Antes
    // todos decían "Walk-in" genérico — perdíamos la oportunidad de marcar la
    // diferencia entre "esto es tuyo" / "esto lo atiende X". Patrón inspirado
    // en Square Appointments: el pill cuenta el estado y la acción posible.
    const pillLabel = isAssigned
      ? assignedToViewer
        ? 'En servicio'
        : `Atiende ${w.assignedStaffUser?.fullName.split(' ')[0] ?? 'otro'}`
      : 'Walk-in'

    candidates.push({
      row: {
        id: `walk-${w.id}`,
        kind: isAssigned ? 'active' : 'pending',
        timeLabel,
        customerName,
        customerId,
        customerPhotoUrl: null,
        customerInitials: getInitials(customerName),
        serviceLabel: 'Walk-in',
        // Meta cuenta el tiempo PREVIO de espera. El timeLabel arriba ya cuenta
        // el de servicio. Juntos: "EN SERVICIO · 8 MIN" + "esperó 94 min" da
        // el cuadro completo sin tener que abrir nada.
        meta: isAssigned && waitMinutes > 0 ? `esperó ${waitMinutes} min` : null,
        pillLabel,
        // Tone bravo solo cuando es tuyo en servicio — sin eso, el pill rojo
        // de un walk-in ajeno te grita "actúa aquí" cuando justo no debes.
        pillTone: isAssigned && assignedToViewer ? 'serving' : 'walkin',
        sourceKind: 'walk-in',
        sourceId: w.id,
        isMine: w.assignedStaffUser?.id === staffId,
        assignedToName: w.assignedStaffUser?.fullName ?? null,
      },
      // sortKey define el ancla cronológica. Para walk-ins asignados es el
      // momento en que empezó el servicio (assignedAt). El CTA del fondo
      // hace `minutesSince(sortKey)` para el badge "EN SERVICIO · X MIN" —
      // tiene que ser el tiempo real de servicio, no el de espera.
      sortKey: isAssigned && w.assignedAt ? w.assignedAt : w.createdAt,
      isActive: isAssigned,
      isPending: !isAssigned,
    })
  }

  for (const w of queueWalkIns) {
    const customer = w.customer ?? null
    const customerId = customer?.id ?? null
    const customerName = customer?.fullName ?? w.customerName ?? 'Walk-in'
    const minutes = minutesSince(w.createdAt)

    // Preferencia del cliente: si pidió a un barbero específico, queremos que
    // se lea en la fila (antes decía "sin asignar" genérico aunque hubiera
    // preferencia registrada — el operador no veía nada). Si el viewer ES el
    // preferido, lo personalizamos ("te está esperando") para que detecte
    // rápido los clientes que vinieron por él. `isMine` se setea aquí también
    // para que el row destaque visualmente cuando lo pide el viewer.
    const preferredName = w.preferredStaffUser?.fullName.split(' ')[0] ?? null
    const isMyPreference = !!w.preferredStaffUser && w.preferredStaffUser.id === staffId
    const preferenceMeta = preferredName
      ? isMyPreference
        ? 'te está esperando'
        : `espera a ${preferredName}`
      : 'sin preferencia'

    candidates.push({
      row: {
        id: `queue-${w.id}`,
        kind: 'queue',
        timeLabel: 'EN COLA',
        customerName,
        customerId,
        customerPhotoUrl: null,
        customerInitials: getInitials(customerName),
        serviceLabel: 'Walk-in',
        meta: `esperando ${minutes} min · ${preferenceMeta}`,
        pillLabel: 'Walk-in',
        pillTone: 'walkin',
        sourceKind: 'walk-in',
        sourceId: w.id,
        // En cola no hay asignación, pero "isMine" lo usamos también para
        // destacar walk-ins que pidieron específicamente a este barbero —
        // mejor pista visual que solo texto en gris.
        isMine: isMyPreference,
        assignedToName: null,
        queuePreferredStaffUserId: w.preferredStaffUser?.id ?? null,
        queuePreferredStaffName: w.preferredStaffUser?.fullName ?? null,
        queueWaitMinutes: minutes,
      },
      sortKey: w.createdAt,
      isActive: false,
      isPending: false,
    })
  }

  candidates.sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  let nextSet = false
  for (const c of candidates) {
    if (c.isActive) continue
    if (c.row.kind === 'queue') continue
    if (!nextSet && c.isPending) {
      c.row.kind = 'next'
      c.row.meta = c.row.meta ? `siguiente · ${c.row.meta}` : 'siguiente'
      nextSet = true
    }
  }

  const rows = candidates.map((c) => c.row)

  let cta: ContextualCTAData
  if (!caja.isOpen) {
    cta = { variant: 'abrir-caja', actionLabel: 'Abrir caja' }
  } else {
    // El CTA es POR-OPERADOR, no global. Mostramos toda la cola/agenda para
    // contexto del piso, pero el botón de acción solo debe disparar trabajo
    // que le toca a quien está viendo la pantalla. Por eso `active` se filtra
    // por `isMine` — si Javi tiene a Cliente Demo en servicio, Alan no debe
    // ver "Cobrar a Cliente Demo" (no es suya esa cobranza).
    const activeMine = candidates.find((c) => c.isActive && c.row.isMine)
    const nextMine = candidates.find((c) => c.row.kind === 'next')
    const queueHead = candidates.find((c) => c.row.kind === 'queue')

    if (activeMine) {
      const minutes = minutesSince(activeMine.sortKey)
      cta = {
        variant: 'cobrar',
        metaLabel: `EN SERVICIO · ${minutes} MIN`,
        actionLabel: `Cobrar a ${activeMine.row.customerName}`,
        targetId: activeMine.row.sourceId,
        targetKind: activeMine.row.sourceKind,
        targetCustomerId: activeMine.row.customerId,
      }
    } else if (nextMine) {
      const isAppt = nextMine.row.sourceKind === 'appointment'
      cta = {
        variant: 'atender',
        metaLabel: isAppt ? `CITA ${formatTimeMx(nextMine.sortKey)}` : 'WALK-IN ASIGNADO',
        actionLabel: `Atender a ${nextMine.row.customerName}`,
        targetId: nextMine.row.sourceId,
        targetKind: nextMine.row.sourceKind,
        targetCustomerId: nextMine.row.customerId,
      }
    } else if (queueHead) {
      cta = {
        variant: 'atender',
        metaLabel: 'WALK-IN EN COLA',
        actionLabel: `Atender al siguiente: ${queueHead.row.customerName}`,
        targetId: queueHead.row.sourceId,
        targetKind: queueHead.row.sourceKind,
        targetCustomerId: queueHead.row.customerId,
      }
    } else {
      cta = { variant: 'nueva-venta', actionLabel: 'Nueva venta' }
    }
  }

  return {
    staffName,
    commission: {
      amountCents: commission.amountCents,
      serviceCount: commission.serviceCount,
      loading: commission.loading,
      projectedCents: null,
    },
    rows,
    cta,
    cajaIsOpen: caja.isOpen,
    gate,
  }
}
