import { useMemo } from 'react'
import { TouchButton } from '@/shared/pos-ui'

interface NoPinMessageViewProps {
  staffName: string
  photoUrl: string | null
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

export function NoPinMessageView({ staffName, photoUrl, onBack }: NoPinMessageViewProps) {
  const initials = useMemo(() => getInitials(staffName), [staffName])

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-3">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={staffName}
            loading="lazy"
            decoding="async"
            className="h-20 w-20 rounded-full object-cover bg-[var(--color-cuero-viejo)]"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-cuero-viejo)] font-[var(--font-pos-display)] text-[24px] font-extrabold text-[var(--color-bone)]">
            {initials}
          </div>
        )}
        <p className="text-[var(--pos-text-body-lg)] text-[var(--color-bone)]">{staffName}</p>
      </div>

      <p className="max-w-sm text-center text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
        PIN no configurado. Pide a tu manager que lo establezca desde el admin.
      </p>

      <TouchButton variant="ghost" size="row" onClick={onBack}>
        Otro barbero
      </TouchButton>
    </div>
  )
}
