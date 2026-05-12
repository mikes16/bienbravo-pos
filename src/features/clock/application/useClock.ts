import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import type { TimeClockEvent, ShiftTemplate } from '../data/clock.repository.ts'

function todayISO(): string {
  // Local date — must match how the API and HoyPage interpret "today" so a
  // clock-in registered at 10am local doesn't disappear from the filter once
  // local time crosses 18:00 (UTC midnight) into the next UTC day.
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayDayOfWeek(): number {
  return new Date().getDay()
}

function minutesFromMidnight(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

function formatMinToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export interface ShiftStatus {
  scheduledStartMin: number | null
  scheduledEndMin: number | null
  arrivalMin: number | null
  scheduledStartLabel: string | null
  arrivalLabel: string | null
  latenessMin: number
  isLate: boolean
  statusLabel: string
}

function isForbidden(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /forbidden|unauthorized|not authorized|no autorizad/i.test(msg)
}

export function useClock(staffUserId: string | null, locationId: string | null) {
  const { clock } = useRepositories()
  const [events, setEvents] = useState<TimeClockEvent[]>([])
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // True when the API rejected the events/templates queries with Forbidden,
  // i.e. the barber isn't assigned to this location (a setup task for the
  // admin, not a transient runtime error).
  const [notAssignedHere, setNotAssignedHere] = useState(false)

  const refresh = useCallback(() => {
    if (!staffUserId || !locationId) return
    const d = todayISO()
    setLoading(true)
    setError(null)
    setNotAssignedHere(false)
    // Independent fetches: events and shift templates fail / succeed for
    // different reasons (permissions vs setup). A missing shift template is
    // not a hard error — it just means the admin hasn't assigned a schedule
    // yet. Forbidden on either query means the barber isn't a member of this
    // location — show a setup hint, not a generic failure banner.
    void Promise.allSettled([
      clock.getEvents(staffUserId, locationId, d, d),
      clock.getShiftTemplates(staffUserId, locationId),
    ]).then(([evtsRes, templatesRes]) => {
      const eventsForbidden = evtsRes.status === 'rejected' && isForbidden(evtsRes.reason)
      const templatesForbidden = templatesRes.status === 'rejected' && isForbidden(templatesRes.reason)

      if (evtsRes.status === 'fulfilled') {
        setEvents(evtsRes.value)
      } else {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[useClock] getEvents failed', evtsRes.reason)
        }
        setEvents([])
        if (!eventsForbidden) {
          setError('No se pudo cargar el historial. Reintenta.')
        }
      }
      if (templatesRes.status === 'fulfilled') {
        setShiftTemplates(templatesRes.value)
      } else {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[useClock] getShiftTemplates failed', templatesRes.reason)
        }
        setShiftTemplates([])
      }

      if (eventsForbidden || templatesForbidden) {
        setNotAssignedHere(true)
      }
      setLoading(false)
    })
  }, [clock, staffUserId, locationId])

  useEffect(() => { refresh() }, [refresh])

  const isClockedIn = events.length > 0 && events[events.length - 1].type === 'CLOCK_IN'

  const shiftStatus: ShiftStatus = useMemo(() => {
    const dow = todayDayOfWeek()
    const todayShift = shiftTemplates.find((t) => t.dayOfWeek === dow)

    // Use the LATEST CLOCK_IN, not the first. With double shifts (IN→OUT→IN),
    // the first CLOCK_IN belongs to the morning shift; for the afternoon shift
    // the operator expects to see the 3pm entry, not the 8am one.
    const latestClockIn = events.filter((e) => e.type === 'CLOCK_IN').at(-1)
    const arrivalMin = latestClockIn ? minutesFromMidnight(latestClockIn.at) : null

    if (!todayShift) {
      return {
        scheduledStartMin: null,
        scheduledEndMin: null,
        arrivalMin,
        scheduledStartLabel: null,
        arrivalLabel: arrivalMin !== null ? formatMinToTime(arrivalMin) : null,
        latenessMin: 0,
        isLate: false,
        statusLabel: 'Sin turno programado',
      }
    }

    const scheduledStart = todayShift.startMin
    const latenessMin = arrivalMin !== null ? Math.max(0, arrivalMin - scheduledStart - 5) : 0
    const isLate = latenessMin > 0

    let statusLabel: string
    if (arrivalMin === null) statusLabel = 'Esperando entrada'
    else if (isLate) statusLabel = `Retardo (+${latenessMin} min)`
    else statusLabel = 'A tiempo'

    return {
      scheduledStartMin: scheduledStart,
      scheduledEndMin: todayShift.endMin,
      arrivalMin,
      scheduledStartLabel: formatMinToTime(scheduledStart),
      arrivalLabel: arrivalMin !== null ? formatMinToTime(arrivalMin) : null,
      latenessMin,
      isLate,
      statusLabel,
    }
  }, [events, shiftTemplates])

  const doClockIn = useCallback(async () => {
    if (!locationId) return
    try {
      const ok = await clock.clockIn(locationId)
      if (!ok) {
        setError('Ya tienes una entrada registrada hoy')
        return
      }
      setError(null)
      refresh()
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[doClockIn] failed', err)
      }
      setError('No se pudo registrar entrada')
    }
  }, [clock, locationId, refresh])

  const doClockOut = useCallback(async () => {
    if (!locationId) return
    try {
      const ok = await clock.clockOut(locationId)
      if (!ok) {
        setError('No hay entrada activa para cerrar')
        return
      }
      setError(null)
      refresh()
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[doClockOut] failed', err)
      }
      setError('No se pudo registrar salida')
    }
  }, [clock, locationId, refresh])

  return { events, isClockedIn, loading, error, notAssignedHere, doClockIn, doClockOut, refresh, shiftStatus }
}
