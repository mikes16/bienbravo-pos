import { useState, useEffect } from 'react'
import { Navigate, Outlet, useLocation as useRouterLocation } from 'react-router-dom'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useOperatorStatus } from '@/core/auth/useOperatorStatus.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import {
  StopwatchIcon,
  GameCalendarIcon,
  TwoCoinsIcon,
  StrongboxIcon,
} from '@/shared/pos-ui/icons'
import { BottomTabNav } from '@/shared/pos-ui'
import { ToastViewport } from '@/core/toast/ToastViewport'
import { IdentityStripV2 } from './IdentityStripV2.tsx'
import { routePrefetchers } from './router.tsx'

function useLiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function PosShell() {
  const { viewer, lock, isLocked, loading } = usePosAuth()
  const { locationName, locationId } = useLocation()
  const now = useLiveClock()
  const routerLoc = useRouterLocation()
  // Hook llamado siempre (Rules of Hooks). Devuelve null cuando viewer aún
  // no está disponible o sigue cargando — el header esconde el badge en
  // ese hueco.
  const operatorStatus = useOperatorStatus(viewer?.staff?.id ?? null, locationId)

  if (loading) return null
  if (!viewer || isLocked) return <Navigate to="/" replace />

  const path = routerLoc.pathname
  let activeTo = '/hoy'
  if (path.startsWith('/reloj') || path.startsWith('/clock')) activeTo = '/reloj'
  else if (path.startsWith('/mis-ventas') || path.startsWith('/my-day')) activeTo = '/mis-ventas'
  else if (path.startsWith('/caja') || path.startsWith('/register')) activeTo = '/caja'
  else if (path.startsWith('/hoy') || path.startsWith('/home')) activeTo = '/hoy'

  // Cada tab dispara el dynamic import del chunk en hover/touchstart antes
  // del click — al tap, el chunk ya está en cache del browser y la
  // navegación se siente instant. Hoy no necesita prefetch (eager loaded).
  const tabs = [
    { to: '/reloj', icon: StopwatchIcon, label: 'Reloj', prefetch: routePrefetchers['/reloj'] },
    { to: '/hoy', icon: GameCalendarIcon, label: 'Hoy' },
    { to: '/mis-ventas', icon: TwoCoinsIcon, label: 'Mis ventas', prefetch: routePrefetchers['/mis-ventas'] },
    { to: '/caja', icon: StrongboxIcon, label: 'Caja', prefetch: routePrefetchers['/caja'] },
  ]

  return (
    <div className="flex h-full flex-col">
      <IdentityStripV2
        sucursalName={locationName ?? 'Sucursal'}
        operatorStatus={operatorStatus}
        now={now}
        staffName={viewer.staff.fullName}
        staffPhotoUrl={viewer.staff.photoUrl ?? null}
        onLock={lock}
      />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <BottomTabNav tabs={tabs} activeTo={activeTo} />
      <ToastViewport />
    </div>
  )
}
