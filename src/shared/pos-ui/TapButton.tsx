import { cn } from '@/shared/lib/cn.ts'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type TapButtonVariant = 'primary' | 'danger' | 'ghost' | 'dark'
type TapButtonSize = 'md' | 'lg' | 'xl'

interface TapButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TapButtonVariant
  size?: TapButtonSize
  children: ReactNode
}

const variantStyles: Record<TapButtonVariant, string> = {
  primary: 'bg-bb-primary text-white',
  danger: 'bg-bb-danger text-white',
  ghost: 'bg-bb-surface text-bb-text hover:bg-bb-surface-2',
  dark: 'bg-[var(--bb-color-text)] text-[var(--bb-color-bg)]',
}

const sizeStyles: Record<TapButtonSize, string> = {
  md: 'min-h-[48px] px-5 py-3 text-sm',
  lg: 'min-h-[56px] px-6 py-4 text-base',
  xl: 'min-h-[72px] px-8 py-5 text-lg',
}

export function TapButton({
  variant = 'primary',
  size = 'lg',
  className,
  disabled,
  children,
  ...rest
}: TapButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'rounded-2xl font-bold transition-transform active:scale-[0.97]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-bb-primary',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
