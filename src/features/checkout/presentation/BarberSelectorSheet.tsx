import { cn } from '@/shared/lib/cn'

interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
}

interface BarberSelectorSheetProps {
  open: boolean
  barbers: Barber[]
  currentBarberId: string
  onSelect: (id: string) => void
  onClose: () => void
}

export function BarberSelectorSheet({ open, barbers, currentBarberId, onSelect, onClose }: BarberSelectorSheetProps) {
  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label="Seleccionar barbero"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl border-t border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-6 py-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 font-[var(--font-pos-display)] text-[20px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
          ¿Quién atiende?
        </p>
        <div className="grid grid-cols-3 gap-3">
          {barbers.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                onSelect(b.id)
                onClose()
              }}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-2 border p-3 transition-colors',
                b.id === currentBarberId
                  ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.06]'
                  : 'border-[var(--color-leather-muted)]/40 hover:bg-[var(--color-cuero-viejo)]',
              )}
            >
              {b.photoUrl ? (
                <img src={b.photoUrl} alt="" className="h-14 w-14 border border-[var(--color-leather-muted)] object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[24px] font-extrabold text-[var(--color-bone)]">
                  {b.fullName[0]}
                </div>
              )}
              <span className="text-center text-[12px] text-[var(--color-bone)]">{b.fullName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
