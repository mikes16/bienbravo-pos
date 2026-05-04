import { cn } from '@/shared/lib/cn'

type Size = 'S' | 'M' | 'L'

interface MoneyDisplayProps {
  /** Amount in cents (e.g. 82000 = $820.00). */
  cents: number
  size?: Size
  className?: string
}

const sizeClasses: Record<Size, string> = {
  S: 'text-[var(--pos-text-numeral-s)]',
  M: 'text-[var(--pos-text-numeral-m)]',
  L: 'text-[var(--pos-text-numeral-l)]',
}

/**
 * Editorial money display — Barlow Condensed numeral with leather peso sign.
 * Whole cents render without decimals (e.g. $820); fractional cents render
 * decimals in a dimmer span (e.g. $820.50).
 */
export function MoneyDisplay({ cents, size = 'M', className }: MoneyDisplayProps) {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = Math.floor(abs / 100).toLocaleString('es-MX')
  const fractional = abs % 100
  const decimals = fractional === 0 ? null : `.${String(fractional).padStart(2, '0')}`

  return (
    <span
      className={cn(
        'font-[var(--font-pos-display)] font-extrabold leading-[0.95] tabular-nums text-[var(--color-bone)]',
        sizeClasses[size],
        className,
      )}
    >
      {sign}
      <span className="text-[var(--color-leather)]">$</span>
      {whole}
      {decimals && <span className="text-[var(--color-bone-muted)]">{decimals}</span>}
    </span>
  )
}
