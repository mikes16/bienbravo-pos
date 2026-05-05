import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ShoppingCartIcon, ClockIcon, CalendarIcon, SeatReclineIcon, WalletIcon, AnalyticsIcon } from '@/shared/pos-ui/GoogleIcon.tsx'
import type { FeatureManifest } from './feature.types.ts'
import { PosShell } from './PosShell.tsx'
import { LockPage } from '@/features/auth/index.ts'
import { HoyPage } from '@/features/home/index.ts'
import { RouteLoader } from './RouteLoader.tsx'

const CheckoutPage = lazy(() => import('@/features/checkout/index.ts').then(m => ({ default: m.CheckoutPage })))
const CajaPage = lazy(() => import('@/features/register/index.ts').then(m => ({ default: m.CajaPage })))
const OpenCajaPage = lazy(() => import('@/features/register/index.ts').then(m => ({ default: m.OpenCajaPage })))
const CloseCajaWizard = lazy(() => import('@/features/register/index.ts').then(m => ({ default: m.CloseCajaWizard })))
const ClockPage = lazy(() => import('@/features/clock/index.ts').then(m => ({ default: m.ClockPage })))
const AgendaPage = lazy(() => import('@/features/agenda/index.ts').then(m => ({ default: m.AgendaPage })))
const WalkInsPage = lazy(() => import('@/features/walkins/index.ts').then(m => ({ default: m.WalkInsPage })))
const MyDayPage = lazy(() => import('@/features/my-day/index.ts').then(m => ({ default: m.MyDayPage })))
const HelloPosPage = lazy(() => import('@/features/_dev/HelloPosPage').then(m => ({ default: m.HelloPosPage })))

function lazyRoute(Component: React.LazyExoticComponent<React.ComponentType>) {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Component />
    </Suspense>
  )
}

export const features: FeatureManifest[] = [
  { id: 'checkout', label: 'Nueva Venta', icon: ShoppingCartIcon, path: '/checkout', permission: 'pos.sale.create', order: 1 },
  { id: 'agenda', label: 'Mi Agenda', icon: CalendarIcon, path: '/agenda', permission: 'appointments.read', order: 2 },
  { id: 'walkins', label: 'Walk-ins', icon: SeatReclineIcon, path: '/walkins', permission: 'walkins.manage', order: 3 },
  { id: 'register', label: 'Caja', icon: WalletIcon, path: '/caja', permission: 'pos.register.manage', order: 4 },
  { id: 'clock', label: 'Reloj', icon: ClockIcon, path: '/clock', permission: 'timeclock.manage', order: 5 },
  { id: 'my-day', label: 'Mi Día', icon: AnalyticsIcon, path: '/my-day', order: 6 },
]

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
