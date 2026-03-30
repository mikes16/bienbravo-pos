import { useState, useEffect } from 'react'
import { AnalyticsIcon } from '@/shared/pos-ui/GoogleIcon.tsx'
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

export function MyDayPage() {
  const { viewer } = usePosAuth()
  const { locationId } = useLocation()
  const { agenda, clock } = useRepositories()
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [loading, setLoading] = useState(true)

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
    <div className="flex min-h-full flex-col items-center px-6 py-10">
      <AnalyticsIcon className="mt-6 h-14 w-14 text-bb-primary" />
      <h1 className="mt-4 font-bb-display text-2xl font-bold">Mi Día</h1>
      <p className="text-sm text-bb-muted">
        {new Date().toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>

      {loading || !summary ? (
        <div className="mt-10 grid w-full max-w-sm grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-bb-surface" />
          ))}
        </div>
      ) : (
        <div className="mt-10 grid w-full max-w-sm grid-cols-2 gap-4">
          <StatCard label="Citas completadas" value={String(summary.completedCount)} />
          <StatCard label="Ingresos" value={formatMoney(summary.revenueCents)} />
          <StatCard label="Tiempo trabajado" value={summary.hoursWorked} />
          <StatCard
            label="Reloj"
            value={summary.clockedIn ? 'Dentro' : 'Fuera'}
            highlight={summary.clockedIn}
          />
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-bb-surface p-5">
      <span className={`text-2xl font-bold ${highlight ? 'text-green-600' : ''}`}>{value}</span>
      <span className="text-xs text-bb-muted">{label}</span>
    </div>
  )
}
