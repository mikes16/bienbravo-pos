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
  useAutoLock()
  // Solo se precargan los chunks de los tabs que este operador puede ver.
  useIdleRoutePrefetch(viewer?.permissions ?? NO_PERMISSIONS)
  return <RouterProvider router={router} />
}

export function App() {
  return (
    <Providers>
      <AppShell />
    </Providers>
  )
}
