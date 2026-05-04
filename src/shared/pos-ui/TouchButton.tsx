import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'min' | 'row' | 'secondary' | 'primary'

interface TouchButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-[var(--color-bravo)] text-white hover:bg-[var(--color-bravo-muted)]',
  secondary:
    'bg-transparent border border-[var(--color-leather-muted)] text-[var(--color-bone)] hover:bg-[var(--color-cuero-viejo)]',
  ghost:
    'bg-transparent text-[var(--color-bone-muted)] hover:text-[var(--color-bone)] hover:bg-[var(--color-cuero-viejo)]',
  danger:
    'bg-transparent border border-[var(--color-bravo)]/50 text-[var(--color-bravo)] hover:bg-[var(--color-bravo)]/10',
}

const sizeClasses: Record<Size, string> = {
  min: 'min-h-[var(--pos-touch-min)] px-4 py-2 text-[14px] font-medium',
  row: 'min-h-[var(--pos-touch-row)] px-5 py-2 text-[14px] font-medium',
  secondary: 'min-h-[var(--pos-touch-secondary)] px-6 py-3 text-[16px] font-medium',
  primary: 'min-h-[var(--pos-touch-primary)] px-7 py-3 text-[17px] font-bold',
}

/**
 * Editorial touch button with size tiers (min / row / secondary / primary).
 * Sharp corners, sentence case, designed for iPad landscape POS.
 */
export function TouchButton({
  variant = 'primary',
  size = 'primary',
  className,
  disabled,
  children,
  type = 'button',
  ...rest
}: TouchButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center transition-colors duration-[var(--duration-pos-tap)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
