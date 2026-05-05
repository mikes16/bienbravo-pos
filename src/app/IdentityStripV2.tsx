import { LockIcon } from '@/shared/pos-ui/GoogleIcon'

interface IdentityStripV2Props {
  brand?: string
  sucursalName: string
  isOnline: boolean
  now: Date
  staffName: string
  staffPhotoUrl: string | null
  onLock: () => void
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

export function IdentityStripV2({
  brand = 'BIENBRAVO',
  sucursalName,
  isOnline,
  now,
  staffName,
  staffPhotoUrl,
  onLock,
}: IdentityStripV2Props) {
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const dateStr = now
    .toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase()
  const initials = getInitials(staffName)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 sm:h-16 sm:px-5">
      <div className="flex items-baseline gap-3">
        <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--color-bone)]">{brand}</span>
        <span className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] sm:inline">
          {sucursalName}
        </span>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {isOnline && (
          <span className="hidden items-center gap-1.5 border border-[var(--color-success)]/40 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-success)] sm:flex">
            <span aria-hidden className="h-1.5 w-1.5 bg-[var(--color-success)]" />
            ONLINE
          </span>
        )}
        <div className="text-right">
          <p className="text-[14px] font-bold leading-none tabular-nums text-[var(--color-bone)]">{timeStr}</p>
          <p className="mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
            {dateStr}
          </p>
        </div>

        {staffPhotoUrl ? (
          <img
            src={staffPhotoUrl}
            alt={staffName}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-leather-muted)] bg-[var(--color-cuero-viejo)] text-[11px] font-bold text-[var(--color-bone)]">
            {initials}
          </div>
        )}

        <button
          type="button"
          onClick={onLock}
          className="flex h-9 w-9 cursor-pointer items-center justify-center text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)] hover:text-[var(--color-bone)]"
          aria-label="Bloquear sesión"
        >
          <LockIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
