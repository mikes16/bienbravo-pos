import { useState, useEffect } from 'react'
import { formatMoney } from '@/shared/lib/money.ts'
import { usePosAuth } from '@/core/auth/usePosAuth.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import type { Appointment } from '@/features/agenda/domain/agenda.types.ts'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository.ts'

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

interface DaySummary {
  completedCount: number
  revenueCents: number
  hoursWorked: string
  clockedIn: boolean
}

function computeSummary(appointments: Appointment[], clockEvents: TimeClockEvent[]): DaySummary {
  const completed = appointments.filter((a) => a.status === 'COMPLETED')
  const revenueCents = completed.reduce((s, a) => s + a.totalCents, 0)

  let totalMinutes = 0
  for (let i = 0; i < clockEvents.length; i += 2) {
    const inEvt = clockEvents[i]
    const outEvt = clockEvents[i + 1]
    if (inEvt?.type === 'CLOCK_IN') {
      const end = outEvt ? new Date(outEvt.at) : new Date()
      totalMinutes += (end.getTime() - new Date(inEvt.at).getTime()) / 60000
    }
  }

  const h = Math.floor(totalMinutes / 60)
  const m = Math.round(totalMinutes % 60)
  const clockedIn = clockEvents.length > 0 && clockEvents[clockEvents.length - 1].type === 'CLOCK_IN'

  return { completedCount: completed.length, revenueCents, hoursWorked: `${h}h ${m}m`, clockedIn }
}

interface KPICardProps {
  label: string
  value: string
  loading?: boolean
}

function KPICard({ label, value, loading = false }: KPICardProps) {
  return (
    <div className="border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-4 py-4">
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
        {label}
      </p>
      {loading ? (
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-[var(--color-leather-muted)]/20" />
      ) : (
        <p className="mt-2 font-[var(--font-pos-display)] text-[28px] font-extrabold tabular-nums leading-none text-[var(--color-bone)]">
          {value}
        </p>
      )}
    </div>
  )
}

export function MyDayPage() {
  const { viewer } = usePosAuth()
  const { locationId } = useLocation()
  const { agenda, clock } = useRepositories()
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [loading, setLoading] = useState(true)

  const staffName = viewer?.staff?.fullName ?? ''

  useEffect(() => {
    if (!viewer || !locationId) return
    const d = todayISO()
    setLoading(true)
    Promise.all([
      agenda.getAppointments(d, d, locationId),
      clock.getEvents(viewer.staff.id, locationId, d, d),
    ])
      .then(([appts, events]) => setSummary(computeSummary(appts, events)))
      .finally(() => setLoading(false))
  }, [agenda, clock, viewer, locationId])

  return (
    <div className="flex h-full flex-col gap-6 px-6 py-5">
      <div>
        <h1 className="font-[var(--font-pos-display)] text-[28px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
          Mi Día
        </h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          {staffName}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KPICard
          label="Ventas hoy"
          value={summary ? formatMoney(summary.revenueCents) : '—'}
          loading={loading}
        />
        <KPICard
          label="Citas completadas"
          value={summary ? String(summary.completedCount) : '—'}
          loading={loading}
        />
        <KPICard
          label="Tiempo trabajado"
          value={summary ? summary.hoursWorked : '—'}
          loading={loading}
        />
      </div>

      <div className="border border-[var(--color-leather-muted)]/40 px-5 py-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Turno actual
        </p>
        {loading ? (
          <div className="mt-2 h-4 w-32 animate-pulse rounded bg-[var(--color-leather-muted)]/20" />
        ) : (
          <p className="mt-2 text-[14px] text-[var(--color-bone-muted)]">
            {summary?.clockedIn ? 'Dentro del turno' : 'Fuera del turno'}
          </p>
        )}
      </div>
    </div>
  )
}
