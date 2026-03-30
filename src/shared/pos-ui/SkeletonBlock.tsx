import { cn } from '@/shared/lib/cn.ts'

interface SkeletonBlockProps {
  className?: string
}

export function SkeletonBlock({ className }: SkeletonBlockProps) {
  return (
    <div className={cn('animate-pulse rounded-2xl bg-bb-surface', className)} />
  )
}
