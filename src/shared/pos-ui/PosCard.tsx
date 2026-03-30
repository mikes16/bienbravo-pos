import { cn } from '@/shared/lib/cn.ts'
import type { ReactNode, HTMLAttributes } from 'react'

type PosCardVariant = 'default' | 'dark' | 'highlighted'

interface PosCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: PosCardVariant
  children: ReactNode
}

const variantStyles: Record<PosCardVariant, string> = {
  default: 'bg-bb-surface',
  dark: 'bg-[var(--bb-color-text)] text-[var(--bb-color-bg)]',
  highlighted: 'bg-bb-primary/10 border border-bb-primary/30',
}

export function PosCard({ variant = 'default', className, children, ...rest }: PosCardProps) {
  return (
    <div
      className={cn('rounded-2xl p-4', variantStyles[variant], className)}
      {...rest}
    >
      {children}
    </div>
  )
}
