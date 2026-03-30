import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { LockIcon } from '@/shared/pos-ui/GoogleIcon.tsx'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useLocation } from '@/core/location/useLocation.ts'

/* ── Live clock hook ─────────────────────────────────────────────────── */

function useLiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/* ── Shell ────────────────────────────────────────────────────────────── */

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
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-bb-border bg-bb-surface px-4">
        {/* Left: brand + location */}
        <div className="flex items-center gap-3">
          <span className="font-bb-display text-base font-bold tracking-tight">BIEN BRAVO</span>
          {locationId && (
            <span className="text-xs text-bb-muted">Sucursal activa</span>
          )}
          <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            ONLINE
          </span>
        </div>

        {/* Right: clock, caja, user */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums">{timeStr}</p>
            <p className="text-[10px] uppercase text-bb-muted">{dateStr}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Avatar */}
            {viewer?.staff.photoUrl ? (
              <img
                src={viewer.staff.photoUrl}
                alt={staffName}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bb-surface-2 text-xs font-bold text-bb-muted">
                {initials}
              </div>
            )}

            {/* Lock button */}
            <button
              type="button"
              onClick={lock}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-bb-muted hover:bg-bb-surface-2 hover:text-bb-text"
              aria-label="Bloquear sesión"
            >
              <LockIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
