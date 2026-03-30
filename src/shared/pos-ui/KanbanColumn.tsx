import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn.ts'

type KanbanAccent = 'amber' | 'blue' | 'green' | 'red' | 'gray'

interface KanbanColumnProps {
  title: string
  count: number
  accent?: KanbanAccent
  children: ReactNode
  className?: string
}

const accentDot: Record<KanbanAccent, string> = {
  amber: 'bg-amber-400',
  blue: 'bg-blue-400',
  green: 'bg-green-400',
  red: 'bg-red-400',
  gray: 'bg-bb-muted',
}

export function KanbanColumn({ title, count, accent = 'gray', children, className }: KanbanColumnProps) {
  return (
    <div className={cn('flex min-w-[280px] flex-1 flex-col', className)}>
      <div className="mb-3 flex items-center gap-2">
        <span className={cn('h-2.5 w-2.5 rounded-full', accentDot[accent])} />
        <span className="text-xs font-bold uppercase tracking-wider text-bb-muted">{title}</span>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-bb-surface-2 px-1.5 text-[10px] font-bold text-bb-muted">
          {count}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
