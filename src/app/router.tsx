import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PosShell } from './PosShell.tsx'
import { LockPage } from '@/features/auth/index.ts'
import { HoyPage } from '@/features/home/index.ts'
import { RouteLoader } from './RouteLoader.tsx'
import { reportRoutePainted } from '@/core/telemetry/navTiming.ts'

// Factored as standalone functions para que BottomTabNav pueda llamarlas
// on hover/touchstart y precachear el chunk antes del click. Llamar dos veces
// la misma función no re-fetch: el browser cachea el modulo dinámico.
const importCheckout = () => import('@/features/checkout/index.ts')
const importRegister = () => import('@/features/register/index.ts')
const importClock = () => import('@/features/clock/index.ts')
const importAgenda = () => import('@/features/agenda/index.ts')
const importWalkIns = () => import('@/features/walkins/index.ts')
const importMyDay = () => import('@/features/my-day/index.ts')
const importHelloPos = () => import('@/features/_dev/HelloPosPage')

const CheckoutPage = lazy(() => importCheckout().then(m => ({ default: m.CheckoutPage })))
const CajaPage = lazy(() => importRegister().then(m => ({ default: m.CajaPage })))
const OpenCajaPage = lazy(() => importRegister().then(m => ({ default: m.OpenCajaPage })))
const CloseCajaWizard = lazy(() => importRegister().then(m => ({ default: m.CloseCajaWizard })))
const ClockPage = lazy(() => importClock().then(m => ({ default: m.ClockPage })))
const AgendaPage = lazy(() => importAgenda().then(m => ({ default: m.AgendaPage })))
const WalkInsPage = lazy(() => importWalkIns().then(m => ({ default: m.WalkInsPage })))
const MyDayPage = lazy(() => importMyDay().then(m => ({ default: m.MyDayPage })))
const HelloPosPage = lazy(() => importHelloPos().then(m => ({ default: m.HelloPosPage })))

/**
 * Mapa de prefetchers por path. PosShell + BottomTabNav lo usan para
 * disparar el dynamic import en hover/touchstart antes del click — cuando
 * el operador tape, el chunk ya está descargado y parseado.
 */
export const routePrefetchers: Record<string, () => Promise<unknown>> = {
  '/checkout': importCheckout,
  '/caja': importRegister,
  '/caja/abrir': importRegister,
  '/caja/cerrar': importRegister,
  '/clock': importClock,
  '/reloj': importClock,
  '/agenda': importAgenda,
  '/walkins': importWalkIns,
  '/my-day': importMyDay,
  '/mis-ventas': importMyDay,
}

/**
 * Probe de telemetría: su efecto monta SOLO cuando el componente lazy hijo
 * resolvió y el árbol commiteó — o sea, cuando la ruta ya está lista para
 * pintar. Reporta la latencia tap→pintado vía navTiming. Cero UI.
 */
function RouteReady({ name, children }: { name: string; children: ReactNode }) {
  useEffect(() => {
    reportRoutePainted(name)
  }, [name])
  return children
}

function lazyRoute(name: string, Component: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <Suspense fallback={<RouteLoader />}>
      <RouteReady name={name}>
        <Component />
      </RouteReady>
    </Suspense>
  )
}

export const router = createBrowserRouter([
  { path: '/', element: <LockPage /> },
  {
    element: <PosShell />,
    children: [
      { path: '/hoy', element: <HoyPage /> },
      { path: '/home', element: <Navigate to="/hoy" replace /> },
      { path: '/checkout', element: lazyRoute('/checkout', CheckoutPage) },
      { path: '/caja', element: lazyRoute('/caja', CajaPage) },
      { path: '/caja/abrir', element: lazyRoute('/caja/abrir', OpenCajaPage) },
      { path: '/caja/cerrar', element: lazyRoute('/caja/cerrar', CloseCajaWizard) },
      { path: '/register', element: <Navigate to="/caja" replace /> },
      { path: '/clock', element: lazyRoute('/clock', ClockPage) },
      { path: '/reloj', element: <Navigate to="/clock" replace /> },
      { path: '/agenda', element: lazyRoute('/agenda', AgendaPage) },
      { path: '/walkins', element: lazyRoute('/walkins', WalkInsPage) },
      { path: '/my-day', element: lazyRoute('/my-day', MyDayPage) },
      { path: '/mis-ventas', element: <Navigate to="/my-day" replace /> },
    ],
  },
  { path: '/dev/hello-pos', element: lazyRoute('/dev/hello-pos', HelloPosPage) },
  { path: '*', element: <Navigate to="/" replace /> },
])
