import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { LockIcon } from '@/shared/pos-ui/GoogleIcon.tsx'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useLocation } from '@/core/location/useLocation.ts'

function useLiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

export function PosShell() {
  const { viewer, lock, isLocked, loading } = usePosAuth()
  const { locationId } = useLocation()
  const now = useLiveClock()

  if (loading) return null
  if (!viewer || isLocked) return <Navigate to="/" replace />

  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dateStr = now.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
  const staffName = viewer.staff.fullName
  const initials = staffName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4">
        <div className="flex items-center gap-3">
          <span className="font-[var(--font-pos-display)] text-[var(--pos-text-body)] font-bold tracking-[0.06em] text-[var(--color-bone)]">
            BIENBRAVO
          </span>
          {locationId && (
            <span className="text-[var(--pos-text-caption)] text-[var(--color-bone-muted)]">
              Sucursal activa
            </span>
          )}
          <span className="flex items-center gap-1.5 border border-[var(--color-success)]/40 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-success)]">
            <span aria-hidden className="h-1.5 w-1.5 bg-[var(--color-success)]" />
            ONLINE
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[var(--pos-text-label)] font-bold tabular-nums text-[var(--color-bone)]">
              {timeStr}
            </p>
            <p className="text-[var(--pos-text-caption)] uppercase text-[var(--color-bone-muted)]">
              {dateStr}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {viewer?.staff.photoUrl ? (
              <img
                src={viewer.staff.photoUrl}
                alt={staffName}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-cuero-viejo)] text-[var(--pos-text-caption)] font-bold text-[var(--color-bone-muted)]">
                {initials}
              </div>
            )}

            <button
              type="button"
              onClick={lock}
              className="flex h-10 w-10 items-center justify-center text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)] hover:text-[var(--color-bone)]"
              aria-label="Bloquear sesión"
            >
              <LockIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
