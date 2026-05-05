import { useMemo } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { cn } from '@/shared/lib/cn'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { useLocation } from '@/core/location/useLocation'
import { useClock } from '../application/useClock'

function formatTimeMx(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Monterrey',
  })
}

export function ClockPage() {
  const { viewer } = usePosAuth()
  const { locationId } = useLocation()
  const { events, isClockedIn, loading, error, doClockIn, doClockOut, shiftStatus } = useClock(
    viewer?.staff?.id ?? null,
    locationId,
  )

  const staffName = viewer?.staff?.fullName ?? ''
  const initials = useMemo(
    () =>
      staffName
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase(),
    [staffName],
  )

  if (loading) {
    return (
      <div className="flex h-full flex-col gap-6 px-6 py-6">
        <div className="h-12 w-32 animate-pulse bg-[var(--color-cuero-viejo)]" />
        <div className="h-20 animate-pulse bg-[var(--color-cuero-viejo)]" />
        <div className="h-16 animate-pulse bg-[var(--color-cuero-viejo)]" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-6 py-6">
      <h1 className="font-[var(--font-pos-display)] text-[28px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
        Reloj
      </h1>

      {error && (
        <div role="alert" className="border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/[0.06] px-4 py-3">
          <p className="text-[13px] text-[var(--color-bravo)]">{error}</p>
        </div>
      )}

      {/* Staff hero */}
      <div className="flex items-center gap-4 border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-5 py-4">
        {viewer?.staff?.photoUrl ? (
          <img
            src={viewer.staff.photoUrl}
            alt=""
            className="h-16 w-16 border border-[var(--color-leather-muted)] object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[24px] font-extrabold text-[var(--color-bone)]">
            {initials || '—'}
          </div>
        )}
        <div className="flex-1">
          <p className="text-[18px] font-extrabold leading-tight text-[var(--color-bone)]">{staffName}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">Barbero</p>
        </div>
        <span
          className={cn(
            'flex items-center gap-2 border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em]',
            isClockedIn
              ? 'border-[var(--color-success)]/40 bg-[var(--color-success)]/[0.06] text-[var(--color-success)]'
              : 'border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[var(--color-bone-muted)]',
          )}
        >
          <span aria-hidden className={cn('h-2 w-2', isClockedIn ? 'bg-[var(--color-success)]' : 'bg-[var(--color-bone-muted)]')} />
          {isClockedIn ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {/* Single contextual CTA */}
      <TouchButton
        variant="primary"
        size="primary"
        onClick={isClockedIn ? doClockOut : doClockIn}
        className="rounded-none uppercase tracking-[0.06em]"
      >
        {isClockedIn ? 'Salir →' : 'Entrar →'}
      </TouchButton>

      {/* Shift status */}
      <div className="flex flex-col gap-2 border border-[var(--color-leather-muted)]/40 px-5 py-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Turno hoy
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">Programado</p>
            <p className="text-[14px] font-bold tabular-nums text-[var(--color-bone)]">
              {shiftStatus.scheduledStartLabel ?? '—'}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">Llegada</p>
            <p className="text-[14px] font-bold tabular-nums text-[var(--color-bone)]">
              {shiftStatus.arrivalLabel ?? '—'}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">Estado</p>
            <p
              className={cn(
                'text-[13px] font-bold',
                shiftStatus.isLate
                  ? 'text-[var(--color-warning)]'
                  : shiftStatus.arrivalMin !== null
                  ? 'text-[var(--color-success)]'
                  : 'text-[var(--color-bone-muted)]',
              )}
            >
              {shiftStatus.statusLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Today's history */}
      <div className="flex flex-col gap-2">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Historial de hoy
        </p>
        {events.length === 0 ? (
          <div className="flex items-center justify-center border border-[var(--color-leather-muted)]/40 px-5 py-8">
            <p className="text-[13px] text-[var(--color-bone-muted)]">Sin registros hoy</p>
          </div>
        ) : (
          <div className="flex flex-col border border-[var(--color-leather-muted)]/40">
            {events.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between border-b border-[var(--color-leather-muted)]/30 px-4 py-2.5 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      'h-2 w-2',
                      e.type === 'CLOCK_IN' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-bravo)]',
                    )}
                  />
                  <span
                    className={cn(
                      'font-mono text-[10px] font-bold uppercase tracking-[0.18em]',
                      e.type === 'CLOCK_IN' ? 'text-[var(--color-success)]' : 'text-[var(--color-bravo)]',
                    )}
                  >
                    {e.type === 'CLOCK_IN' ? 'Entrada' : 'Salida'}
                  </span>
                </div>
                <span className="font-mono text-[12px] tabular-nums text-[var(--color-bone)]">
                  {formatTimeMx(e.at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
