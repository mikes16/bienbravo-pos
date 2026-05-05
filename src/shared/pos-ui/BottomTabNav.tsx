import { useNavigate } from 'react-router-dom'
import type { ComponentType, SVGProps } from 'react'
import { cn } from '@/shared/lib/cn'

export interface BottomTabNavTab {
  to: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  meta?: string
  badge?: number
}

interface BottomTabNavProps {
  tabs: BottomTabNavTab[]
  activeTo: string
  className?: string
}

export function BottomTabNav({ tabs, activeTo, className }: BottomTabNavProps) {
  const navigate = useNavigate()
  return (
    <nav
      className={cn(
        'grid grid-cols-4 border-t border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)]',
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTo === tab.to
        const Icon = tab.icon
        return (
          <button
            key={tab.to}
            type="button"
            onClick={() => navigate(tab.to)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative flex h-16 cursor-pointer flex-col items-center justify-center gap-1 px-2 py-3 transition-colors sm:h-20',
              'border-t-2 border-transparent',
              isActive
                ? 'border-t-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.04] text-[var(--color-bone)]'
                : 'text-[var(--color-bone-muted)] hover:bg-white/[0.02] hover:text-[var(--color-bone)]',
            )}
          >
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em]">
              {tab.label}
            </span>
            {tab.meta && (
              <span className="text-[10px] font-semibold text-[var(--color-success)]">
                {tab.meta}
              </span>
            )}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute right-2 top-2 bg-[var(--color-bravo)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-bone)]">
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
