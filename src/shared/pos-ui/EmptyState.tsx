import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn.ts'

interface EmptyStateProps {
  icon?: ReactNode
  message: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, message, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center', className)}>
      {icon && <span className="text-4xl">{icon}</span>}
      <p className="text-sm text-bb-muted">{message}</p>
      {action}
    </div>
  )
}
