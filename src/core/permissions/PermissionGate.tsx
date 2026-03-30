import type { ReactNode } from 'react'
import { usePermission } from './usePermission.ts'

interface PermissionGateProps {
  requires: string
  fallback?: ReactNode
  children: ReactNode
}

export function PermissionGate({ requires, fallback = null, children }: PermissionGateProps) {
  const allowed = usePermission(requires)
  return allowed ? children : fallback
}
