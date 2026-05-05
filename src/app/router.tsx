import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ShoppingCartIcon, ClockIcon, CalendarIcon, SeatReclineIcon, WalletIcon, AnalyticsIcon } from '@/shared/pos-ui/GoogleIcon.tsx'
import type { FeatureManifest } from './feature.types.ts'
import { PosShell } from './PosShell.tsx'
import { LockPage } from '@/features/auth/index.ts'
import { HoyPage } from '@/features/home/index.ts'
import { CheckoutPage } from '@/features/checkout/index.ts'
import { CajaPage, OpenCajaPage, CloseCajaWizard } from '@/features/register'
import { ClockPage } from '@/features/clock/index.ts'
import { AgendaPage } from '@/features/agenda/index.ts'
import { WalkInsPage } from '@/features/walkins/index.ts'
import { MyDayPage } from '@/features/my-day/index.ts'
import { HelloPosPage } from '@/features/_dev/HelloPosPage'

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
      { path: '/checkout', element: <CheckoutPage /> },
      { path: '/caja', element: <CajaPage /> },
      { path: '/caja/abrir', element: <OpenCajaPage /> },
      { path: '/caja/cerrar', element: <CloseCajaWizard /> },
      { path: '/register', element: <Navigate to="/caja" replace /> },
      { path: '/clock', element: <ClockPage /> },
      { path: '/reloj', element: <Navigate to="/clock" replace /> },
      { path: '/agenda', element: <AgendaPage /> },
      { path: '/walkins', element: <WalkInsPage /> },
      { path: '/my-day', element: <MyDayPage /> },
      { path: '/mis-ventas', element: <Navigate to="/my-day" replace /> },
    ],
  },
  { path: '/dev/hello-pos', element: <HelloPosPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
])
