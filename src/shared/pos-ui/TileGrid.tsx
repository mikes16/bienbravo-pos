import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

interface TileGridProps {
  children: ReactNode
  /** Number of columns. Default 4. */
  cols?: 2 | 3 | 4 | 5 | 6
  className?: string
}

const colsClasses: Record<NonNullable<TileGridProps['cols']>, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
}

/**
 * Grid container for TileButtons. Default 4 columns matches catalog layout
 * on iPad landscape; payment-method screens use 3, denominations 4-5.
 */
export function TileGrid({ children, cols = 4, className }: TileGridProps) {
  return (
    <div className={cn('grid gap-3', colsClasses[cols], className)}>{children}</div>
  )
}
