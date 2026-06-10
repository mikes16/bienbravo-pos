import { cn } from '@/shared/lib/cn'
import { cldThumb } from '@/shared/lib/cloudinary'

interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
  // A1: undefined = sin info (se permite); false = sin turno iniciado (bloqueado).
  hasClockedIn?: boolean
}

interface BarberPickerInlineProps {
  barbers: Barber[]
  currentBarberId: string | null
  onSelect: (id: string) => void
}

export function BarberPickerInline({ barbers, currentBarberId, onSelect }: BarberPickerInlineProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-1 py-2">
      {barbers.map((b) => {
        const blocked = b.hasClockedIn === false
        return (
          <button
            key={b.id}
            type="button"
            aria-label={blocked ? `${b.fullName} (sin turno)` : b.fullName}
            disabled={blocked}
            onClick={() => {
              if (!blocked) onSelect(b.id)
            }}
            className={cn(
              'flex shrink-0 flex-col items-center gap-1 border p-2 transition-colors',
              blocked
                ? 'cursor-not-allowed border-[var(--color-leather-muted)]/40 opacity-40'
                : 'cursor-pointer',
              !blocked &&
                (b.id === currentBarberId
                  ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08]'
                  : 'border-[var(--color-leather-muted)]/40 hover:bg-[var(--color-cuero-viejo)]'),
            )}
          >
            {b.photoUrl ? (
              <img src={cldThumb(b.photoUrl, { w: 40, h: 40, dpr: 'auto' }) ?? b.photoUrl} alt="" loading="lazy" decoding="async" className="h-10 w-10 border border-[var(--color-leather-muted)] object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[16px] font-extrabold text-[var(--color-bone)]">
                {b.fullName[0]}
              </div>
            )}
            <span className="text-[10px] text-[var(--color-bone)]">
              {blocked ? 'Sin turno' : b.fullName.split(' ')[0]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
