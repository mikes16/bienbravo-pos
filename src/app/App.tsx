import { useMemo } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Providers } from './Providers.tsx'
import { router } from './router.tsx'
import { useAutoLock } from '@/core/auth/useAutoLock.ts'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useIdleRoutePrefetch } from './useIdleRoutePrefetch.ts'

// Referencia estable para el hueco "aún no hay viewer": un `[]` inline sería
// un array nuevo en cada render y reprogramaría el prefetch en bucle
// (cada re-render cancelaría el idle pendiente antes de que dispare).
const NO_PERMISSIONS: readonly string[] = []

function AppShell() {
  const { viewer } = usePosAuth()
  // Un solo montaje del bloqueo automático en toda la app: dos montajes serían
  // dos juegos de temporizadores y de oyentes de actividad sobre `document`.
  // El aviso de los últimos segundos (`secondsRemaining`) lo pintará la franja
  // de la tarea siguiente; aquí todavía nadie lo consume.
  useAutoLock()
  // Solo se precargan los chunks de los tabs que este operador puede ver.
  useIdleRoutePrefetch(viewer?.permissions ?? NO_PERMISSIONS)

  // Elemento memoizado: `AppShell` re-renderiza con cada cambio del contexto de
  // auth y, en los últimos segundos antes del bloqueo, una vez por segundo.
  // Con la misma referencia de elemento React se salta el subárbol del router
  // entero en esos renders; sin esto, el aviso repintaría toda la pantalla.
  return useMemo(() => <RouterProvider router={router} />, [])
}

export function App() {
  return (
    <Providers>
      <AppShell />
    </Providers>
  )
}
