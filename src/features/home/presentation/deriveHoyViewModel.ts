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
  customerPhotoUrl: string | null
  customerInitials: string
  serviceLabel: string
  meta: string | null
  pillLabel: string
  pillTone: 'serving' | 'appt' | 'walkin'
  sourceKind: 'appointment' | 'walk-in'
  sourceId: string
}

export interface ContextualCTAData {
  metaLabel?: string
  actionLabel: string
  variant: 'cobrar' | 'atender' | 'abrir-caja' | 'nueva-venta'
  targetId?: string
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

  const myAppts = appointments.filter((a) => a.staffUser?.id === staffId)
  const myWalkIns = walkIns.filter((w) => w.assignedStaffUser?.id === staffId)
  const queueWalkIns = walkIns.filter(
    (w) => w.status === 'PENDING' && (w.assignedStaffUser === null || w.assignedStaffUser === undefined),
  )

  type Candidate = { row: HoyRowData; sortKey: string; isActive: boolean; isPending: boolean }
  const candidates: Candidate[] = []

  for (const a of myAppts) {
    const customer = (a.customer ?? null) as { fullName?: string; photoUrl?: string | null } | null
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
        customerPhotoUrl: photo,
        customerInitials: getInitials(customerName),
        serviceLabel: a.items[0]?.label ?? 'Servicio',
        meta: isInService ? `cita ${formatTimeMx(startAt)}` : null,
        pillLabel: 'Cita',
        pillTone: isInService ? 'serving' : 'appt',
        sourceKind: 'appointment',
        sourceId: a.id,
      },
      sortKey: startAt,
      isActive: isInService,
      isPending,
    })
  }

  for (const w of myWalkIns) {
    const customer = w.customer ?? null
    const customerName = customer?.fullName ?? w.customerName ?? 'Walk-in'
    const isAssigned = w.status === 'ASSIGNED'
    const minutes = minutesSince(w.createdAt)
    const timeLabel = isAssigned ? `EN SERVICIO · ${minutes} MIN` : formatTimeMx(w.createdAt)

    candidates.push({
      row: {
        id: `walk-${w.id}`,
        kind: isAssigned ? 'active' : 'pending',
        timeLabel,
        customerName,
        customerPhotoUrl: null,
        customerInitials: getInitials(customerName),
        serviceLabel: 'Walk-in',
        meta: null,
        pillLabel: 'Walk-in',
        pillTone: isAssigned ? 'serving' : 'walkin',
        sourceKind: 'walk-in',
        sourceId: w.id,
      },
      sortKey: w.createdAt,
      isActive: isAssigned,
      isPending: !isAssigned,
    })
  }

  for (const w of queueWalkIns) {
    const customer = w.customer ?? null
    const customerName = customer?.fullName ?? w.customerName ?? 'Walk-in'
    const minutes = minutesSince(w.createdAt)

    candidates.push({
      row: {
        id: `queue-${w.id}`,
        kind: 'queue',
        timeLabel: 'EN COLA',
        customerName,
        customerPhotoUrl: null,
        customerInitials: getInitials(customerName),
        serviceLabel: 'Walk-in',
        meta: `esperando ${minutes} min · sin asignar`,
        pillLabel: 'Walk-in',
        pillTone: 'walkin',
        sourceKind: 'walk-in',
        sourceId: w.id,
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
    const active = candidates.find((c) => c.isActive)
    const nextMine = candidates.find((c) => c.row.kind === 'next')
    const queueHead = candidates.find((c) => c.row.kind === 'queue')

    if (active) {
      const minutes = minutesSince(active.sortKey)
      cta = {
        variant: 'cobrar',
        metaLabel: `EN SERVICIO · ${minutes} MIN`,
        actionLabel: `Cobrar a ${active.row.customerName}`,
        targetId: active.row.sourceId,
      }
    } else if (nextMine) {
      cta = {
        variant: 'atender',
        metaLabel: `CITA ${formatTimeMx(nextMine.sortKey)}`,
        actionLabel: `Atender a ${nextMine.row.customerName}`,
        targetId: nextMine.row.sourceId,
      }
    } else if (queueHead) {
      cta = {
        variant: 'atender',
        metaLabel: 'WALK-IN EN COLA',
        actionLabel: `Atender al siguiente: ${queueHead.row.customerName}`,
        targetId: queueHead.row.sourceId,
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
