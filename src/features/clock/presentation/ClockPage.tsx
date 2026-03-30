import { LoginIcon, LogoutIcon, ClockIcon, CalendarClockIcon } from '@/shared/pos-ui/GoogleIcon.tsx'
import { cn } from '@/shared/lib/cn.ts'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import { useClock } from '../application/useClock.ts'
import { PosCard, TapButton, StatusPill, SkeletonBlock, SectionHeader } from '@/shared/pos-ui/index.ts'

export function ClockPage() {
  const { viewer } = usePosAuth()
  const { locationId } = useLocation()
  const { events, isClockedIn, loading, error, doClockIn, doClockOut, shiftStatus } = useClock(
    viewer?.staff.id ?? null,
    locationId,
  )

  const staffName = viewer?.staff.fullName ?? ''
  const initials = staffName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  if (loading) {
    return (
      <div className="flex h-full gap-6 px-6 py-6">
        <div className="flex flex-1 flex-col gap-4">
          <SkeletonBlock className="h-32" />
          <div className="flex gap-4">
            <SkeletonBlock className="h-28 flex-1" />
            <SkeletonBlock className="h-28 flex-1" />
          </div>
          <SkeletonBlock className="h-36" />
        </div>
        <div className="flex w-80 flex-col gap-4">
          <SkeletonBlock className="h-8 w-24" />
          <SkeletonBlock className="h-16" />
          <SkeletonBlock className="h-16" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-6 px-6 py-6">
      {/* ── Left column: staff + actions + shift status ──────── */}
      <div className="flex flex-1 flex-col gap-5">
        <SectionHeader title="Registro Horario" />

        {error && (
          <p className="rounded-xl bg-bb-danger/10 px-4 py-3 text-sm text-bb-danger">{error}</p>
        )}

        {/* Staff card */}
        <PosCard className="flex items-center gap-4">
          {viewer?.staff.photoUrl ? (
            <img
              src={viewer.staff.photoUrl}
              alt={staffName}
              className="h-16 w-16 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bb-surface-2 text-xl font-bold text-bb-muted">
              {initials}
            </div>
          )}
          <div className="flex-1">
            <p className="text-base font-bold">{staffName}</p>
            <p className="text-xs text-bb-muted">Barbero</p>
          </div>
          <StatusPill
            label={isClockedIn ? 'Activo' : 'Inactivo'}
            color={isClockedIn ? 'green' : 'gray'}
          />
        </PosCard>

        {/* Clock in / out buttons */}
        <div className="flex gap-4">
          <TapButton
            size="xl"
            variant="dark"
            className={cn('flex flex-1 flex-col items-center gap-2', isClockedIn && 'opacity-40 cursor-not-allowed')}
            disabled={isClockedIn}
            onClick={doClockIn}
          >
            <LoginIcon className="h-7 w-7" />
            <span>CLOCK IN</span>
          </TapButton>
          <TapButton
            size="xl"
            variant="danger"
            className={cn('flex flex-1 flex-col items-center gap-2', !isClockedIn && 'opacity-40 cursor-not-allowed')}
            disabled={!isClockedIn}
            onClick={doClockOut}
          >
            <LogoutIcon className="h-7 w-7" />
            <span>CLOCK OUT</span>
          </TapButton>
        </div>

        {/* Shift status card */}
        <PosCard className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClockIcon className="h-4 w-4 text-bb-muted" />
            <span className="text-xs font-bold uppercase tracking-wider text-bb-muted">Estado del Turno</span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] text-bb-muted">Programado</p>
              <p className="text-sm font-bold">
                {shiftStatus.scheduledStartLabel ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-bb-muted">Llegada</p>
              <p className="text-sm font-bold">
                {shiftStatus.arrivalLabel ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-bb-muted">Estado</p>
              <StatusPill
                label={shiftStatus.statusLabel}
                color={shiftStatus.isLate ? 'amber' : shiftStatus.arrivalMin !== null ? 'green' : 'gray'}
              />
            </div>
          </div>

          {shiftStatus.scheduledEndMin !== null && (
            <p className="text-xs text-bb-muted">
              Turno programado: {shiftStatus.scheduledStartLabel} – {formatMinToTime(shiftStatus.scheduledEndMin)}
            </p>
          )}
        </PosCard>
      </div>

      {/* ── Right column: event history ─────────────────────── */}
      <div className="flex w-80 shrink-0 flex-col gap-4">
        <SectionHeader title="Historial de Hoy" />

        {events.length === 0 ? (
          <PosCard className="flex flex-col items-center gap-2 py-8 text-bb-muted">
            <ClockIcon className="h-8 w-8" />
            <p className="text-xs">Sin registros hoy</p>
          </PosCard>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <PosCard key={e.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  {e.type === 'CLOCK_IN' ? (
                    <LoginIcon className="h-4 w-4 text-green-400" />
                  ) : (
                    <LogoutIcon className="h-4 w-4 text-bb-danger" />
                  )}
                  <span className={cn('text-sm font-semibold', e.type === 'CLOCK_IN' ? 'text-green-400' : 'text-bb-danger')}>
                    {e.type === 'CLOCK_IN' ? 'Entrada' : 'Salida'}
                  </span>
                </div>
                <span className="text-sm tabular-nums text-bb-muted">
                  {new Date(e.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </PosCard>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatMinToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}
