import { usePosAuth } from '@/core/auth/usePosAuth.ts'

export function usePermission(key: string): boolean {
  const { viewer } = usePosAuth()
  if (!viewer) return false
  return viewer.permissions.includes(key)
}
