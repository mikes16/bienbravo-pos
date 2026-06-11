import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocation } from '@/core/location/useLocation'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { usePosAuth } from '@/core/auth/usePosAuth'
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
  const { viewer } = usePosAuth()
  // Durante loading (viewer === null) asumimos permisos; los gates fuertes
  // de OpenCajaPage / CloseCajaWizard ya hacen su propia defensa.
  const perms = viewer?.permissions ?? []
  const viewerLoaded = !!viewer
  const canOpen = !viewerLoaded || perms.includes('pos.register.open')
  const canClose = !viewerLoaded || perms.includes('pos.register.close')
  const { registers, loading, refresh } = useRegister(locationId)
  const [blocker, setBlocker] = useState<ActiveServiceItem[] | null>(null)
  const [checkingActive, setCheckingActive] = useState(false)

  // Refetch on focus + visibilitychange. En el tablet alternar pantallas/apps
  // no dispara window.focus; al volver a estar visible refrescamos para que los
  // montos esperados (efectivo/tarjeta/transfer) reflejen las ventas recientes.
  useEffect(() => {
    const onFocus = () => refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
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

  // Sin ninguno de los dos perms, esta página no tiene nada que ofrecer.
  if (!canOpen && !canClose) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-bone-muted)]">
            Sin acceso
          </p>
          <h1
            className="mb-2 text-2xl font-bold text-[var(--color-bone)]"
            style={{ fontFamily: 'var(--font-pos-display)' }}
          >
            Caja
          </h1>
          <p className="text-sm text-[var(--color-bone-muted)]">
            Tu rol no incluye permisos de caja. Pide a un administrador que ajuste tu rol POS.
          </p>
        </div>
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
          onCerrar={canClose ? handleCerrar : null}
        />
        <ActiveServicesBlocker
          open={blocker !== null}
          items={blocker ?? []}
          onClose={() => setBlocker(null)}
        />
      </>
    )
  }

  return <CajaClosedView registers={registers} onAbrir={canOpen ? handleAbrir : null} />
}
