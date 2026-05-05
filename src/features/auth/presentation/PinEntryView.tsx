import { useMemo, useState } from 'react'
import { PinKeypad, TouchButton } from '@/shared/pos-ui'

interface PinEntryViewProps {
  staffName: string
  photoUrl: string | null
  error: string | null
  onSubmit: (pin: string) => void
  onBack: () => void
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

export function PinEntryView({
  staffName,
  photoUrl,
  error,
  onSubmit,
  onBack,
}: PinEntryViewProps) {
  const initials = useMemo(() => getInitials(staffName), [staffName])
  const [submitting, setSubmitting] = useState(false)

  function handleComplete(pin: string) {
    setSubmitting(true)
    onSubmit(pin)
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-3">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={staffName}
            className="h-24 w-24 rounded-full object-cover bg-[var(--color-cuero-viejo)]"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--color-cuero-viejo)] font-[var(--font-pos-display)] text-[28px] font-extrabold text-[var(--color-bone)]">
            {initials}
          </div>
        )}
        <p className="text-[var(--pos-text-subtitle)] font-bold text-[var(--color-bone)]">
          {staffName}
        </p>
        <p className="text-[var(--pos-text-label)] text-[var(--color-bone-muted)]">
          {submitting ? 'Validando…' : 'Ingresa tu PIN'}
        </p>
      </div>

      <div className={submitting ? 'pointer-events-none opacity-50 transition-opacity' : 'transition-opacity'}>
        <PinKeypad length={4} onComplete={handleComplete} />
      </div>

      {error && (
        <div role="alert" className="w-full border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/[0.06] px-4 py-3">
          <p className="text-[13px] text-[var(--color-bravo)]">{error}</p>
        </div>
      )}

      <TouchButton variant="ghost" size="row" onClick={onBack} disabled={submitting}>
        Otro barbero
      </TouchButton>
    </div>
  )
}
