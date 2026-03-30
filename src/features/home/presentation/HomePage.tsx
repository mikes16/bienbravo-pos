import { useState, useEffect } from 'react'
import { gql } from '@apollo/client'
import { useApolloClient } from '@apollo/client/react'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import type { Appointment } from '@/features/agenda/domain/agenda.types.ts'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository.ts'
import type { WalkIn } from '@/features/walkins/domain/walkins.types.ts'
import { HomeView, type DashboardData, type DashboardSectionLoading, type RecentActivityEntry } from './HomeView.tsx'

const STAFF_METRICS_TODAY_QUERY = gql`
  query PosStaffMetricsToday($staffUserId: ID!, $locationId: ID!, $date: String!) {
    staffServiceRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)
    staffProductRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)
    staffCommissionToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)
  }
`

const SALES_ACTIVITY_QUERY = gql`
  query PosSalesActivity($locationId: ID!, $date: String!, $source: SaleSource) {
    listSalesForKPI(locationId: $locationId, date: $date, source: $source) {
      id
      status
      paymentStatus
      totalCents
      createdAt
      appointmentId
      walkInId
      customer { id fullName email phone }
    }
  }
`

interface HomeSaleActivity {
  id: string
  status: string
  paymentStatus: string
  totalCents: number
  createdAt: string
  appointmentId: string | null
  walkInId: string | null
  customer: { id: string; fullName: string; email: string | null; phone: string | null } | null
}

function isAnonymousSale(sale: HomeSaleActivity): boolean {
  if (!sale.customer) return true
  const name = sale.customer.fullName.trim().toLowerCase()
  const anonymousHints = ['anon', 'anónimo', 'anonymous', 'mostrador', 'consumidor final', 'publico general', 'público general']
  return anonymousHints.some((hint) => name.includes(hint))
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function todayISO(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayRangeISO(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

function computeDashboard(
  appointments: Appointment[],
  clockEvents: TimeClockEvent[],
  walkIns: WalkIn[],
  posSales: HomeSaleActivity[],
  staffUserId: string,
  serviceRevenueCents: number,
  productRevenueCents: number,
  commissionCents: number,
): DashboardData {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)
  const isToday = (iso: string) => {
    const d = new Date(iso)
    return d >= todayStart && d <= todayEnd
  }

  const completed = appointments.filter((a) => a.status === 'COMPLETED')
  const pending = appointments.filter((a) =>
    a.status === 'CONFIRMED' || a.status === 'CHECKED_IN' || a.status === 'IN_SERVICE',
  )

  let totalMinutes = 0
  for (let i = 0; i < clockEvents.length; i += 2) {
    const inEvt = clockEvents[i]
    const outEvt = clockEvents[i + 1]
    if (inEvt?.type === 'CLOCK_IN') {
      const end = outEvt ? new Date(outEvt.at) : new Date()
      totalMinutes += (end.getTime() - new Date(inEvt.at).getTime()) / 60_000
    }
  }
  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)

  const isClockedIn = clockEvents.length > 0 && clockEvents[clockEvents.length - 1].type === 'CLOCK_IN'
  const firstClockIn = clockEvents.find((e) => e.type === 'CLOCK_IN')

  const pendingQueue = walkIns.filter((w) => w.status === 'PENDING')
  const pendingWalkIns = pendingQueue.length
  const nextPendingWalkIn = pendingQueue[0] ?? null
  const activeWalkIn = walkIns.find(
    (w) => w.status === 'ASSIGNED' && w.assignedStaffUser?.id === staffUserId,
  ) ?? null
  const activeAppointment = appointments.find(
    (a) => a.status === 'IN_SERVICE' && a.staffUser?.id === staffUserId,
  ) ?? null

  const nextAppt = pending.sort((a, b) => a.startAt.localeCompare(b.startAt))[0] ?? null
  const completedAppointments = appointments.filter((appt) => appt.status === 'COMPLETED' && isToday(appt.startAt))
  const completedWalkIns = walkIns.filter((walkIn) => walkIn.status === 'DONE' && isToday(walkIn.createdAt))
  const paidCounterSales = posSales.filter((sale) => sale.paymentStatus === 'PAID' && !sale.appointmentId)

  const paidSalesByCustomerId = new Map<string, HomeSaleActivity[]>()
  const paidSalesByWalkInId = new Map<string, HomeSaleActivity[]>()
  const paidSalesByCustomerName = new Map<string, HomeSaleActivity[]>()
  paidCounterSales.forEach((sale) => {
    if (sale.walkInId) {
      const currentByWalkIn = paidSalesByWalkInId.get(sale.walkInId) ?? []
      currentByWalkIn.push(sale)
      paidSalesByWalkInId.set(sale.walkInId, currentByWalkIn)
    }

    const customerId = sale.customer?.id
    if (customerId) {
      const currentById = paidSalesByCustomerId.get(customerId) ?? []
      currentById.push(sale)
      paidSalesByCustomerId.set(customerId, currentById)
    }

    const customerNameKey = normalizeName(sale.customer?.fullName)
    if (customerNameKey) {
      const currentByName = paidSalesByCustomerName.get(customerNameKey) ?? []
      currentByName.push(sale)
      paidSalesByCustomerName.set(customerNameKey, currentByName)
    }
  })

  const recentApptActivity: RecentActivityEntry[] = completedAppointments.map((appt) => ({
    id: `appt-${appt.id}`,
    at: appt.startAt,
    customerName: appt.customer?.fullName ?? 'Sin cliente',
    movementLabel: 'Cita',
    movementColor: 'blue',
    detail: appt.items[0]?.label ?? 'Cita',
    statusLabel: 'Completada',
    statusColor: 'green',
    totalCents: appt.totalCents,
  }))

  const recentWalkInActivity: RecentActivityEntry[] = completedWalkIns.map((walkIn) => {
    const candidateSalesByWalkInId = paidSalesByWalkInId.get(walkIn.id) ?? []
    const candidateSalesById = walkIn.customer?.id ? (paidSalesByCustomerId.get(walkIn.customer.id) ?? []) : []
    const customerNameKey = normalizeName(walkIn.customer?.fullName ?? walkIn.customerName)
    const candidateSalesByName = customerNameKey ? (paidSalesByCustomerName.get(customerNameKey) ?? []) : []
    const candidateSales =
      candidateSalesByWalkInId.length > 0
        ? candidateSalesByWalkInId
        : candidateSalesById.length > 0
        ? candidateSalesById
        : candidateSalesByName
    const matchedSale = candidateSales
      .filter((sale) => sale.createdAt >= walkIn.createdAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null

    return {
      id: `walkin-${walkIn.id}`,
      at: walkIn.createdAt,
      customerName: walkIn.customer?.fullName ?? walkIn.customerName ?? 'Walk-in',
      movementLabel: 'Walk-in',
      movementColor: 'amber',
      detail: 'Servicio sin cita',
      statusLabel: 'Completado',
      statusColor: 'green',
      totalCents: matchedSale?.totalCents ?? null,
    }
  })

  const recentAnonymousSalesActivity: RecentActivityEntry[] = paidCounterSales
    .filter((sale) => isAnonymousSale(sale))
    .map((sale) => ({
      id: `sale-${sale.id}`,
      at: sale.createdAt,
      customerName: 'Anónimo',
      movementLabel: 'Mostrador',
      movementColor: 'gray',
      detail: 'Venta mostrador',
      statusLabel: 'Pagada',
      statusColor: 'green',
      totalCents: sale.totalCents,
    }))

  const recentActivity = [...recentApptActivity, ...recentWalkInActivity, ...recentAnonymousSalesActivity]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5)

  return {
    completedCount: completed.length,
    totalAppointments: appointments.filter((a) => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW').length,
    revenueCents: serviceRevenueCents + productRevenueCents,
    serviceRevenueCents,
    productRevenueCents,
    hoursWorked: `${h}h ${m}m`,
    isClockedIn,
    clockInTime: firstClockIn
      ? new Date(firstClockIn.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      : null,
    pendingApptCount: pending.length,
    nextAppointment: nextAppt,
    pendingWalkIns,
    nextPendingWalkIn,
    activeWalkIn,
    activeAppointment,
    commissionCents,
    recentActivity,
  }
}

const EMPTY_DASHBOARD: DashboardData = {
  completedCount: 0,
  totalAppointments: 0,
  revenueCents: 0,
  serviceRevenueCents: 0,
  productRevenueCents: 0,
  hoursWorked: '0h 0m',
  isClockedIn: false,
  clockInTime: null,
  pendingApptCount: 0,
  nextAppointment: null,
  pendingWalkIns: 0,
  nextPendingWalkIn: null,
  activeWalkIn: null,
  activeAppointment: null,
  commissionCents: 0,
  recentActivity: [],
}

export function HomePage() {
  const apollo = useApolloClient()
  const { viewer } = usePosAuth()
  const { locationId } = useLocation()
  const { agenda, clock, walkins } = useRepositories()
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD)
  const [loading, setLoading] = useState<DashboardSectionLoading>({ performance: true, activity: true })

  useEffect(() => {
    if (!viewer || !locationId) {
      setLoading({ performance: false, activity: false })
      return
    }

    const d = todayISO()
    const { from, to } = todayRangeISO()
    setLoading({ performance: true, activity: true })

    Promise.all([
      agenda.getAppointments(from, to, locationId),
      clock.getEvents(viewer.staff.id, locationId, d, d),
      walkins.getWalkIns(locationId),
      apollo.query<{ listSalesForKPI: HomeSaleActivity[] }>({
        query: SALES_ACTIVITY_QUERY,
        variables: { locationId, date: d, source: 'POS' },
        fetchPolicy: 'network-only',
      }).then((res) => res.data?.listSalesForKPI ?? []).catch(() => []),
      apollo.query<{
        staffServiceRevenueToday: number
        staffProductRevenueToday: number
        staffCommissionToday: number
      }>({
        query: STAFF_METRICS_TODAY_QUERY,
        variables: {
          staffUserId: viewer.staff.id,
          locationId,
          date: d,
        },
        fetchPolicy: 'network-only',
      }).then((res) => ({
        serviceRevenueCents: res.data?.staffServiceRevenueToday ?? 0,
        productRevenueCents: res.data?.staffProductRevenueToday ?? 0,
        commissionCents: res.data?.staffCommissionToday ?? 0,
      })).catch(() => ({ serviceRevenueCents: 0, productRevenueCents: 0, commissionCents: 0 })),
    ])
      .then(([appts, events, wkins, sales, metrics]) => {
        setData(
          computeDashboard(
            appts,
            events,
            wkins,
            sales,
            viewer.staff.id,
            metrics.serviceRevenueCents,
            metrics.productRevenueCents,
            metrics.commissionCents,
          ),
        )
      })
      .catch(() => {
        setData((prev) => ({
          ...prev,
          recentActivity: [],
        }))
      })
      .finally(() => setLoading({ performance: false, activity: false }))
  }, [agenda, apollo, clock, walkins, viewer, locationId])

  return (
    <HomeView
      staffName={viewer?.staff.fullName ?? ''}
      data={data}
      loading={loading}
    />
  )
}
