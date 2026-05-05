import { cn } from '@/shared/lib/cn'

interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
}

interface BarberPickerInlineProps {
  barbers: Barber[]
  currentBarberId: string | null
  onSelect: (id: string) => void
}

export function BarberPickerInline({ barbers, currentBarberId, onSelect }: BarberPickerInlineProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-1 py-2">
      {barbers.map((b) => (
        <button
          key={b.id}
          type="button"
          aria-label={b.fullName}
          onClick={() => onSelect(b.id)}
          className={cn(
            'flex shrink-0 cursor-pointer flex-col items-center gap-1 border p-2 transition-colors',
            b.id === currentBarberId
              ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08]'
              : 'border-[var(--color-leather-muted)]/40 hover:bg-[var(--color-cuero-viejo)]',
          )}
        >
          {b.photoUrl ? (
            <img src={b.photoUrl} alt="" className="h-10 w-10 border border-[var(--color-leather-muted)] object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[16px] font-extrabold text-[var(--color-bone)]">
              {b.fullName[0]}
            </div>
          )}
          <span className="text-[10px] text-[var(--color-bone)]">{b.fullName.split(' ')[0]}</span>
        </button>
      ))}
    </div>
  )
}
