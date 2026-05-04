import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

interface TileButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  title: string
  subtitle?: string
  selected?: boolean
}

/**
 * Square tile button used for category items, payment methods,
 * denominations. Aspect 1:1, sharp corners, leather border.
 */
export function TileButton({
  title,
  subtitle,
  selected,
  disabled,
  className,
  type = 'button',
  ...rest
}: TileButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'flex aspect-square w-full flex-col items-center justify-center gap-1 px-3 py-3',
        'border bg-[var(--color-cuero-viejo)] text-[var(--color-bone)]',
        'transition-colors duration-[var(--duration-pos-tap)]',
        'hover:bg-[var(--color-cuero-viejo-hover)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-[var(--color-bravo)] bg-[var(--color-cuero-viejo-hover)]'
          : 'border-[var(--color-leather-muted)]',
        className,
      )}
      {...rest}
    >
      <span className="text-center text-[16px] font-medium leading-tight">{title}</span>
      {subtitle && (
        <span className="font-mono text-[13px] text-[var(--color-leather)]">{subtitle}</span>
      )}
    </button>
  )
}
