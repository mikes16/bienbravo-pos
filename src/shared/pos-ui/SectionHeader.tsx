import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn.ts'

interface SectionHeaderProps {
  title: string
  action?: ReactNode
  className?: string
}

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <h2 className="text-xs font-bold uppercase tracking-wider text-bb-muted">{title}</h2>
      {action}
    </div>
  )
}
