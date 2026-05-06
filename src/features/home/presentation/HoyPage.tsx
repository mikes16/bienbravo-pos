import { useEffect, useState, useCallback } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { useNavigate } from 'react-router-dom'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { useLocation } from '@/core/location/useLocation'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { POS_HOME_COMMISSION, POS_HOME_CAJA_STATUS } from '../data/home.queries'
import { deriveHoyViewModel, type HoyViewModel } from './deriveHoyViewModel'
import { HoyView } from './HoyView'
import { AddWalkInSheet } from '@/features/walkins/presentation/AddWalkInSheet'
import { SkeletonRow } from '@/shared/pos-ui'
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
  const [addWalkInOpen, setAddWalkInOpen] = useState(false)

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
        fetchPolicy: 'cache-first',
      }),
      apollo.query<{
        posCajaStatusHome: { isOpen: boolean; accumulatedCents: number | null; openedAt: string | null }
      }>({
        query: POS_HOME_CAJA_STATUS,
        variables: { locationId },
        fetchPolicy: 'cache-first',
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

  const [ctaBusy, setCtaBusy] = useState(false)

  const handleCtaClick = useCallback(async () => {
    if (!vm || ctaBusy) return
    switch (vm.cta.variant) {
      case 'abrir-caja':
        navigate('/caja')
        break
      case 'nueva-venta':
        navigate('/checkout')
        break
      case 'atender': {
        // Atender = take the turn. For appointments, transition to IN_SERVICE;
        // for walk-ins, claim them (PENDING → ASSIGNED). Doesn't go to checkout —
        // the CTA flips to "Cobrar a X" once the row turns active, which the
        // operator taps separately when the service is done.
        const { targetId, targetKind } = vm.cta
        if (!targetId || !targetKind || !viewer?.staff?.id) return
        setCtaBusy(true)
        try {
          if (targetKind === 'appointment') {
            await agenda.startService(targetId)
          } else {
            await walkins.assign(targetId, viewer.staff.id)
          }
          await refetch()
        } catch (err) {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.error('[atender] failed', { targetId, targetKind, err })
          }
        } finally {
          setCtaBusy(false)
        }
        break
      }
      case 'cobrar': {
        const { targetId, targetKind, targetCustomerId } = vm.cta
        if (!targetId || !targetKind) {
          navigate('/checkout')
          break
        }
        const params = new URLSearchParams()
        if (targetKind === 'walk-in') {
          params.set('completeWalkInId', targetId)
        } else {
          params.set('completeAppointmentId', targetId)
        }
        if (targetCustomerId) params.set('customerId', targetCustomerId)
        navigate(`/checkout?${params.toString()}`)
        break
      }
    }
  }, [vm, ctaBusy, navigate, viewer, agenda, walkins, refetch])

  const handleGateAction = useCallback(() => {
    if (!vm?.gate) return
    switch (vm.gate.kind) {
      case 'clock-in':
        navigate('/reloj')
        break
      case 'caja':
        navigate('/caja')
        break
    }
  }, [vm, navigate])

  if (!vm) {
    return (
      <div className="flex h-full flex-col gap-4 px-6 py-5">
        <SkeletonRow heightPx={36} widthPercent={40} />
        <div className="flex flex-col gap-2">
          <SkeletonRow heightPx={56} />
          <SkeletonRow heightPx={56} />
          <SkeletonRow heightPx={56} />
        </div>
      </div>
    )
  }

  return (
    <>
      <HoyView
        vm={vm}
        onCtaClick={handleCtaClick}
        onGateAction={handleGateAction}
        onAddWalkIn={() => setAddWalkInOpen(true)}
      />
      {locationId && (
        <AddWalkInSheet
          open={addWalkInOpen}
          locationId={locationId}
          onClose={() => setAddWalkInOpen(false)}
          onCreated={() => { void refetch() }}
        />
      )}
    </>
  )
}
