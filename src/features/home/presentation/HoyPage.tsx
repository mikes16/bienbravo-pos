import { useEffect, useState, useCallback } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { useNavigate } from 'react-router-dom'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { useLocation } from '@/core/location/useLocation'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { POS_HOME_COMMISSION, POS_HOME_CAJA_STATUS } from '../data/home.queries'
import { deriveHoyViewModel, type HoyViewModel } from './deriveHoyViewModel'
import { HoyView } from './HoyView'
import type { Appointment } from '@/features/agenda/domain/agenda.types'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository'
import type { WalkIn } from '@/features/walkins/domain/walkins.types'

function todayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayRangeISO(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now); from.setHours(0, 0, 0, 0)
  const to = new Date(now); to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function HoyPage() {
  const apollo = useApolloClient()
  const { viewer } = usePosAuth()
  const { locationId } = useLocation()
  const { agenda, clock, walkins } = useRepositories()
  const navigate = useNavigate()

  const [vm, setVm] = useState<HoyViewModel | null>(null)

  const refetch = useCallback(async () => {
    if (!viewer || !locationId) return
    const date = todayISO()
    const { from, to } = todayRangeISO()

    const settled = await Promise.allSettled([
      agenda.getAppointments(from, to, locationId),
      clock.getEvents(viewer.staff.id, locationId, date, date),
      walkins.getWalkIns(locationId),
      apollo.query<{
        staffServiceRevenueToday: number
        staffProductRevenueToday: number
        staffCommissionToday: number
      }>({
        query: POS_HOME_COMMISSION,
        variables: { staffUserId: viewer.staff.id, locationId, date },
        fetchPolicy: 'network-only',
      }),
      apollo.query<{
        posCajaStatusHome: { isOpen: boolean; accumulatedCents: number | null; openedAt: string | null }
      }>({
        query: POS_HOME_CAJA_STATUS,
        variables: { locationId },
        fetchPolicy: 'network-only',
      }),
    ])

    const appts: Appointment[] = settled[0].status === 'fulfilled' ? settled[0].value : []
    const events: TimeClockEvent[] = settled[1].status === 'fulfilled' ? settled[1].value : []
    const wkins: WalkIn[] = settled[2].status === 'fulfilled' ? settled[2].value : []
    const commissionRes = settled[3].status === 'fulfilled' ? settled[3].value.data : null
    const cajaRes = settled[4].status === 'fulfilled' ? settled[4].value.data?.posCajaStatusHome : null

    // Approximate service count: completed appts + done walk-ins for me today
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const serviceCount =
      appts.filter((a) => a.status === 'COMPLETED' && a.staffUser?.id === viewer.staff.id && new Date(a.startAt) >= todayStart).length +
      wkins.filter((w) => w.status === 'DONE' && w.assignedStaffUser?.id === viewer.staff.id && new Date(w.createdAt) >= todayStart).length

    setVm(
      deriveHoyViewModel({
        staffId: viewer.staff.id,
        staffName: viewer.staff.fullName,
        appointments: appts,
        walkIns: wkins,
        clockEvents: events,
        commission: {
          amountCents: commissionRes?.staffCommissionToday ?? 0,
          serviceCount,
          loading: false,
        },
        caja: {
          isOpen: cajaRes?.isOpen ?? false,
          accumulatedCents: cajaRes?.accumulatedCents ?? null,
          openedAt: cajaRes?.openedAt ? new Date(cajaRes.openedAt) : null,
        },
      }),
    )
  }, [agenda, apollo, clock, walkins, viewer, locationId])

  useEffect(() => {
    if (!viewer || !locationId) return
    void refetch()
  }, [viewer, locationId, refetch])

  useEffect(() => {
    const onFocus = () => { void refetch() }
    window.addEventListener('focus', onFocus)
    return () => { window.removeEventListener('focus', onFocus) }
  }, [refetch])

  const handleCtaClick = useCallback(() => {
    if (!vm) return
    switch (vm.cta.variant) {
      case 'abrir-caja':
        navigate('/caja')
        break
      case 'cobrar':
      case 'atender':
      case 'nueva-venta':
        navigate('/checkout')
        break
    }
  }, [vm, navigate])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleRowClick = useCallback(
    (_rowId: string) => {
      // Future: pass rowId to checkout to preselect customer
      navigate('/checkout')
    },
    [navigate],
  )

  if (!vm) return null

  return <HoyView vm={vm} onCtaClick={handleCtaClick} onRowClick={handleRowClick} />
}
