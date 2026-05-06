import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocation } from '@/core/location/useLocation'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { useRegister } from '../application/useRegister'
import { CajaClosedView } from './CajaClosedView'
import { CajaOpenView } from './CajaOpenView'
import { ActiveServicesBlocker, type ActiveServiceItem } from './ActiveServicesBlocker'
import { SkeletonRow } from '@/shared/pos-ui'

// TODO: derive fondoCents from session metadata (the API doesn't expose
// opening fondo as a discrete field today). For Sub-#3 v1 we use a placeholder;
// post-merge follow-up: compute as session.expectedCashCents - sum(cash sales).
const FONDO_PLACEHOLDER_CENTS = 50000

function todayRangeISO(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now); from.setHours(0, 0, 0, 0)
  const to = new Date(now); to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function CajaPage() {
  const navigate = useNavigate()
  const { locationId } = useLocation()
  const { agenda, walkins } = useRepositories()
  const { registers, loading, refresh } = useRegister(locationId)
  const [blocker, setBlocker] = useState<ActiveServiceItem[] | null>(null)
  const [checkingActive, setCheckingActive] = useState(false)

  // Refetch on focus (consistent with sub-#2 D pattern)
  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const openRegister = useMemo(
    () => registers.find((r) => r.openSession),
    [registers],
  )

  const handleAbrir = (registerId: string) => {
    navigate(`/caja/abrir?reg=${registerId}`)
  }

  // Block close-caja while there are services in progress on the floor — the
  // operator must finish (cobrar / drop) each one first so the day's totals
  // and walk-in / appointment lifecycles stay consistent.
  const handleCerrar = useCallback(async () => {
    if (!locationId || checkingActive) return
    setCheckingActive(true)
    try {
      const { from, to } = todayRangeISO()
      const [appts, wkins] = await Promise.all([
        agenda.getAppointments(from, to, locationId, 'IN_SERVICE'),
        walkins.getWalkIns(locationId),
      ])
      const items: ActiveServiceItem[] = []
      for (const a of appts) {
        items.push({
          kind: 'appointment',
          id: a.id,
          customerName: a.customer?.fullName ?? 'Cliente',
          barberName: a.staffUser?.fullName ?? null,
          serviceLabel: a.items[0]?.label ?? 'Servicio',
        })
      }
      for (const w of wkins) {
        if (w.status !== 'ASSIGNED') continue
        items.push({
          kind: 'walk-in',
          id: w.id,
          customerName: w.customer?.fullName ?? w.customerName ?? 'Walk-in',
          barberName: w.assignedStaffUser?.fullName ?? null,
          serviceLabel: 'Walk-in',
        })
      }
      if (items.length > 0) {
        setBlocker(items)
        return
      }
      navigate('/caja/cerrar')
    } catch {
      // If the active-services check fails, prefer letting the operator
      // proceed — closing-caja itself is a deliberate action and the wizard
      // will surface any further errors. Don't trap the operator on a
      // network blip.
      navigate('/caja/cerrar')
    } finally {
      setCheckingActive(false)
    }
  }, [locationId, agenda, walkins, navigate, checkingActive])

  if (loading && registers.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 py-12">
        <SkeletonRow heightPx={48} widthPercent={50} />
        <SkeletonRow heightPx={20} widthPercent={30} />
        <SkeletonRow heightPx={56} widthPercent={60} />
      </div>
    )
  }

  if (openRegister?.openSession) {
    return (
      <>
        <CajaOpenView
          session={openRegister.openSession}
          todayTransactions={[]}
          fondoCents={FONDO_PLACEHOLDER_CENTS}
          onCerrar={handleCerrar}
        />
        <ActiveServicesBlocker
          open={blocker !== null}
          items={blocker ?? []}
          onClose={() => setBlocker(null)}
        />
      </>
    )
  }

  return <CajaClosedView registers={registers} onAbrir={handleAbrir} />
}
