import { cn } from '@/shared/lib/cn.ts'

type StatusPillColor = 'amber' | 'blue' | 'green' | 'red' | 'gray'

interface StatusPillProps {
  label: string
  color?: StatusPillColor
  className?: string
}

const colorStyles: Record<StatusPillColor, string> = {
  amber: 'bg-amber-500/15 text-amber-400',
  blue: 'bg-blue-500/15 text-blue-400',
  green: 'bg-green-500/15 text-green-400',
  red: 'bg-red-500/15 text-red-400',
  gray: 'bg-bb-surface-2 text-bb-muted',
}

export function StatusPill({ label, color = 'gray', className }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        colorStyles[color],
        className,
      )}
    >
      {label}
    </span>
  )
}
