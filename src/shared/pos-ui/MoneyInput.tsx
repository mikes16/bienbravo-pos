import { useCallback } from 'react'
import { cn } from '@/shared/lib/cn'
import { MoneyDisplay } from './MoneyDisplay'
import { Numpad, type NumpadKey } from './Numpad'

interface MoneyInputProps {
  /** Current amount in cents. */
  cents: number
  onChange: (nextCents: number) => void
  className?: string
}

/**
 * Money entry: large MoneyDisplay readout above + Numpad below. Each digit
 * shifts the value left (×10) — so "1" → "12" → "125" → 125 cents = $1.25.
 * Decimal key is intentionally ignored: cents are implicit by position
 * (last 2 digits are always cents).
 */
export function MoneyInput({ cents, onChange, className }: MoneyInputProps) {
  const handleKey = useCallback(
    (key: NumpadKey) => {
      if (key === '.') return
      if (key === 'backspace') {
        onChange(Math.floor(cents / 10))
        return
      }
      const digit = Number(key)
      onChange(cents * 10 + digit)
    },
    [cents, onChange],
  )

  return (
    <div className={cn('flex flex-col items-center gap-8', className)}>
      <MoneyDisplay cents={cents} size="L" />
      <Numpad onKey={handleKey} allowDecimal={false} />
    </div>
  )
}
