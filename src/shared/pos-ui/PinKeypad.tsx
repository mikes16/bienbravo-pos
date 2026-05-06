import { useEffect, useState, useCallback } from 'react'
import { cn } from '@/shared/lib/cn'
import { Numpad, type NumpadKey } from './Numpad'

interface PinKeypadProps {
  /** Number of digits the PIN should have (typically 4 or 6). */
  length: number
  /** Called once when the user reaches `length` digits. Receives the full PIN string. */
  onComplete: (pin: string) => void
  /** When true, neither tap nor physical-keyboard input is accepted. */
  disabled?: boolean
  className?: string
}

/**
 * PIN entry — Numpad without decimal, plus dot indicators above showing
 * how many digits have been entered. Calls onComplete once when full
 * length reached; subsequent digits are ignored until parent resets
 * (typically by remounting with a new `key` prop).
 */
export function PinKeypad({ length, onComplete, disabled = false, className }: PinKeypadProps) {
  const [digits, setDigits] = useState('')

  const handleKey = useCallback(
    (key: NumpadKey) => {
      if (disabled) return
      if (key === 'backspace') {
        setDigits((prev) => prev.slice(0, -1))
        return
      }
      if (key === '.') return
      setDigits((prev) => {
        if (prev.length >= length) return prev
        const next = prev + key
        if (next.length === length) {
          // Defer onComplete so React state has settled before parent reacts.
          queueMicrotask(() => onComplete(next))
        }
        return next
      })
    },
    [length, onComplete, disabled],
  )

  // Physical keyboard support: digits 0-9 and Backspace map to handleKey.
  // Skips keys when another input is focused so we don't hijack form fields.
  useEffect(() => {
    if (disabled) return
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        handleKey(e.key as NumpadKey)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        handleKey('backspace')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleKey, disabled])

  return (
    <div className={cn('flex flex-col items-center gap-8', className)}>
      <div className="flex gap-3">
        {Array.from({ length }).map((_, i) => {
          const filled = i < digits.length
          return (
            <span
              key={i}
              data-pin-dot={filled ? 'filled' : 'empty'}
              className={cn(
                'h-4 w-4 rounded-full border-2 transition-colors duration-[var(--duration-pos-tap)]',
                filled
                  ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]'
                  : 'border-[var(--color-leather-muted)] bg-transparent',
              )}
            />
          )
        })}
      </div>
      <Numpad onKey={handleKey} allowDecimal={false} />
    </div>
  )
}
