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

export function useClock(staffUserId: string | null, locationId: string | null) {
  const { clock } = useRepositories()
  const [events, setEvents] = useState<TimeClockEvent[]>([])
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!staffUserId || !locationId) return
    const d = todayISO()
    setLoading(true)
    Promise.all([
      clock.getEvents(staffUserId, locationId, d, d),
      clock.getShiftTemplates(staffUserId, locationId),
    ])
      .then(([evts, templates]) => {
        setEvents(evts)
        setShiftTemplates(templates)
      })
      .catch(() => setError('No se pudo cargar el reloj'))
      .finally(() => setLoading(false))
  }, [clock, staffUserId, locationId])

  useEffect(() => { refresh() }, [refresh])

  const isClockedIn = events.length > 0 && events[events.length - 1].type === 'CLOCK_IN'

  const shiftStatus: ShiftStatus = useMemo(() => {
    const dow = todayDayOfWeek()
    const todayShift = shiftTemplates.find((t) => t.dayOfWeek === dow)

    const firstClockIn = events.find((e) => e.type === 'CLOCK_IN')
    const arrivalMin = firstClockIn ? minutesFromMidnight(firstClockIn.at) : null

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

  return { events, isClockedIn, loading, error, doClockIn, doClockOut, refresh, shiftStatus }
}
