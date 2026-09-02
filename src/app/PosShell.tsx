import { useState, useEffect } from 'react'
import { Navigate, Outlet, useLocation as useRouterLocation } from 'react-router-dom'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useOperatorStatus } from '@/core/auth/useOperatorStatus.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import { visibleTabs, firstAllowedRoute, isRouteAllowed, activeTabFor } from '@/core/permissions/posTabs.ts'
import { BottomTabNav, type BottomTabNavTab } from '@/shared/pos-ui'
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

/**
 * El viewer no tiene permiso para NINGÚN tab. Se le dice claro qué pasa y
 * quién lo arregla; el candado del header sigue disponible para cambiar de
 * operador. El API protege los datos igual — esto es solo la UI honesta.
 */
function NoModulesView() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-bravo)]">
        Sin módulos habilitados
      </p>
      <p className="max-w-md text-[15px] text-[var(--color-bone)]">
        Tu rol no tiene permiso para ver ninguna pantalla del POS. Pide al admin que revise
        los permisos de tabs de tu rol.
      </p>
    </div>
  )
}

export function PosShell() {
  const { viewer, lock, isLocked, loading } = usePosAuth()
  const { locationName, locationId, locationTimezone } = useLocation()
  const now = useLiveClock()
  const routerLoc = useRouterLocation()
  // Hook llamado siempre (Rules of Hooks). Devuelve null cuando viewer aún
  // no está disponible o sigue cargando — el header esconde el badge en
  // ese hueco.
  const operatorStatus = useOperatorStatus(viewer?.staff?.id ?? null, locationId)

  if (loading) return null
  if (!viewer || isLocked) return <Navigate to="/" replace />

  const permissions = viewer.permissions
  const path = routerLoc.pathname
  const home = firstAllowedRoute(permissions)

  // Guard de ruta: un path de un tab que el viewer no tiene redirige al
  // primer tab permitido (p.ej. deep-link o tab que le acaban de quitar).
  // Sin ningún tab, se queda donde está y ve la vista "sin módulos".
  if (!isRouteAllowed(path, permissions) && home) {
    return <Navigate to={home} replace />
  }

  // Cada tab dispara el dynamic import del chunk en hover/touchstart antes
  // del click — al tap, el chunk ya está en cache del browser y la
  // navegación se siente instant. Hoy no necesita prefetch (eager loaded).
  const tabs: BottomTabNavTab[] = visibleTabs(permissions).map((t) => ({
    to: t.to,
    icon: t.icon,
    label: t.label,
    prefetch: routePrefetchers[t.to],
  }))
  const activeTo = activeTabFor(path) ?? home ?? '/hoy'

  return (
    <div className="flex h-full flex-col">
      <IdentityStripV2
        sucursalName={locationName ?? 'Sucursal'}
        operatorStatus={operatorStatus}
        now={now}
        staffName={viewer.staff.fullName}
        staffPhotoUrl={viewer.staff.photoUrl ?? null}
        onLock={lock}
        timezone={locationTimezone}
      />
      <main className="flex-1 overflow-hidden">
        {home ? <Outlet /> : <NoModulesView />}
      </main>
      {tabs.length > 0 && <BottomTabNav tabs={tabs} activeTo={activeTo} />}
      <ToastViewport />
    </div>
  )
}
