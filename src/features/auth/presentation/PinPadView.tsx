import { useState } from 'react'
import { cn } from '@/shared/lib/cn.ts'

interface PinPadViewProps {
  staffName: string
  photoUrl: string | null
  error: string | null
  onSubmit: (pin: string) => void
  onBack: () => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

export function PinPadView({ staffName, photoUrl, error, onSubmit, onBack }: PinPadViewProps) {
  const [pin, setPin] = useState('')

  function handleKey(key: string) {
    if (key === 'del') {
      setPin((prev) => prev.slice(0, -1))
      return
    }
    if (pin.length >= 4) return
    const next = pin + key
    setPin(next)
    if (next.length === 4) {
      onSubmit(next)
      setTimeout(() => setPin(''), 600)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 px-6 py-10">
      <button
        type="button"
        onClick={onBack}
        className="self-start rounded-xl px-4 py-2 text-sm text-bb-muted hover:text-bb-text active:scale-[0.97]"
      >
        ← Cambiar
      </button>

      <div className="flex flex-col items-center gap-3">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={staffName}
            className="h-20 w-20 rounded-full object-cover bg-bb-surface-2"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-bb-surface-2 text-2xl font-semibold text-bb-muted">
            {staffName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <h2 className="font-bb-display text-xl font-semibold">{staffName}</h2>
      </div>

      {/* PIN dots */}
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-4 w-4 rounded-full transition-colors duration-150',
              i < pin.length ? 'bg-bb-primary' : 'bg-bb-surface-2',
            )}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-bb-danger">{error}</p>
      )}

      {/* Numeric pad */}
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((key, i) => {
          if (key === '') return <div key={i} />
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleKey(key)}
              className={cn(
                'flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-semibold',
                'bg-bb-surface transition-transform duration-[var(--bb-motion-duration-fast)]',
                'active:scale-[0.93] hover:bg-bb-surface-2',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-bb-primary',
              )}
            >
              {key === 'del' ? '⌫' : key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
