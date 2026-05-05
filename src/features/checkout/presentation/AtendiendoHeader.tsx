interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
}

interface AtendiendoHeaderProps {
  barber: Barber
  onTap: () => void
}

export function AtendiendoHeader({ barber, onTap }: AtendiendoHeaderProps) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="flex w-full cursor-pointer items-center justify-between border border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.06] px-4 py-3 transition-colors hover:bg-[var(--color-bravo)]/[0.12]"
    >
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
          Atendiendo
        </span>
        <span className="text-[16px] font-extrabold leading-none text-[var(--color-bone)]">
          {barber.fullName}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {barber.photoUrl ? (
          <img src={barber.photoUrl} alt="" loading="lazy" decoding="async" className="h-10 w-10 border border-[var(--color-leather-muted)] object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[18px] font-extrabold text-[var(--color-bone)]">
            {barber.fullName[0]}
          </div>
        )}
        <span className="font-mono text-[12px] text-[var(--color-bone-muted)]">↓</span>
      </div>
    </button>
  )
}
