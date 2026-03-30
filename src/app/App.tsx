import { RouterProvider } from 'react-router-dom'
import { Providers } from './Providers.tsx'
import { router } from './router.tsx'
import { useAutoLock } from '@/core/auth/useAutoLock.ts'

function AppShell() {
  useAutoLock()
  return <RouterProvider router={router} />
}

export function App() {
  return (
    <Providers>
      <AppShell />
    </Providers>
  )
}
