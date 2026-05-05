import { cn } from '@/shared/lib/cn'

interface SkeletonRowProps {
  className?: string
  heightPx?: number
  widthPercent?: number
}

export function SkeletonRow({ className, heightPx = 14, widthPercent }: SkeletonRowProps) {
  return (
    <div
      className={cn('animate-pulse bg-[var(--color-cuero-viejo)]', className)}
      style={{ height: `${heightPx}px`, width: widthPercent ? `${widthPercent}%` : undefined }}
    />
  )
}

interface SkeletonCardProps {
  className?: string
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn('animate-pulse bg-[var(--color-cuero-viejo)]', className)}
      style={{ aspectRatio: '1 / 1' }}
    />
  )
}

interface SkeletonTextProps {
  className?: string
  widthPercent?: number
}

export function SkeletonText({ className, widthPercent = 100 }: SkeletonTextProps) {
  return (
    <span
      className={cn('inline-block animate-pulse bg-[var(--color-cuero-viejo)]', className)}
      style={{ width: `${widthPercent}%`, height: '1em' }}
    />
  )
}

interface SkeletonCircleProps {
  className?: string
  size: number
}

export function SkeletonCircle({ className, size }: SkeletonCircleProps) {
  return (
    <div
      className={cn('animate-pulse rounded-full bg-[var(--color-cuero-viejo)]', className)}
      style={{ height: `${size}px`, width: `${size}px` }}
    />
  )
}
