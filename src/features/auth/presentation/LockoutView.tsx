import { useEffect, useMemo, useState } from 'react'
import { TouchButton } from '@/shared/pos-ui'

interface LockoutViewProps {
  staffName: string
  photoUrl: string | null
  lockedUntil: Date
  onUnlocked: () => void
  onBack: () => void
  onPoll: () => Promise<Date | null>
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function formatCountdown(secondsRemaining: number): string {
  const m = Math.floor(secondsRemaining / 60)
  const s = secondsRemaining % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function LockoutView({
  staffName,
  photoUrl,
  lockedUntil,
  onUnlocked,
  onBack,
  onPoll,
}: LockoutViewProps) {
  const [now, setNow] = useState(() => new Date())
  const [released, setReleased] = useState(false)

  const initials = useMemo(() => getInitials(staffName), [staffName])
  const remainingMs = lockedUntil.getTime() - now.getTime()
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))

  useEffect(() => {
    if (released) return
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [released])

  useEffect(() => {
    if (released) return
    let cancelled = false
    const interval = setInterval(async () => {
      if (cancelled) return
      try {
        const next = await onPoll()
        if (cancelled) return
        if (next === null) setReleased(true)
      } catch {
        // Network error — keep counting down locally.
      }
    }, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [onPoll, released])

  useEffect(() => {
    if (!released && remainingSeconds === 0) setReleased(true)
  }, [remainingSeconds, released])

  useEffect(() => {
    if (released) onUnlocked()
    // Intentionally only on `released` — re-running on onUnlocked identity would re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [released])

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-3">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={staffName}
            className="h-20 w-20 rounded-full object-cover bg-[var(--color-cuero-viejo)] grayscale"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-cuero-viejo)] font-[var(--font-pos-display)] text-[24px] font-extrabold text-[var(--color-bone-muted)]">
            {initials}
          </div>
        )}
        <p className="text-[var(--pos-text-body-lg)] text-[var(--color-bone)]">{staffName}</p>
      </div>

      <p className="font-[var(--font-pos-display)] text-[var(--pos-text-numeral-l)] font-extrabold leading-none text-[var(--color-bravo)] tabular-nums">
        {formatCountdown(remainingSeconds)}
      </p>

      <p className="max-w-sm text-center text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
        Demasiados intentos. Espera o pide a tu manager que desbloquee desde el admin.
      </p>

      <TouchButton variant="ghost" size="row" onClick={onBack}>
        Otro barbero
      </TouchButton>
    </div>
  )
}
