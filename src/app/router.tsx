import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { PosShell } from './PosShell.tsx'
import { LockPage } from '@/features/auth/index.ts'
import { HoyPage } from '@/features/home/index.ts'
import { RouteLoader } from './RouteLoader.tsx'

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

function lazyRoute(Component: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Component />
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
      { path: '/checkout', element: lazyRoute(CheckoutPage) },
      { path: '/caja', element: lazyRoute(CajaPage) },
      { path: '/caja/abrir', element: lazyRoute(OpenCajaPage) },
      { path: '/caja/cerrar', element: lazyRoute(CloseCajaWizard) },
      { path: '/register', element: <Navigate to="/caja" replace /> },
      { path: '/clock', element: lazyRoute(ClockPage) },
      { path: '/reloj', element: <Navigate to="/clock" replace /> },
      { path: '/agenda', element: lazyRoute(AgendaPage) },
      { path: '/walkins', element: lazyRoute(WalkInsPage) },
      { path: '/my-day', element: lazyRoute(MyDayPage) },
      { path: '/mis-ventas', element: <Navigate to="/my-day" replace /> },
    ],
  },
  { path: '/dev/hello-pos', element: lazyRoute(HelloPosPage) },
  { path: '*', element: <Navigate to="/" replace /> },
])
