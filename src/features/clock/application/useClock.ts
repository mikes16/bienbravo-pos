import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import { useLocation } from '@/core/location/useLocation'
import { minutesOfDayInTz, dayOfWeekInTz, localDayInTz } from '@/shared/lib/date'
import type { TimeClockEvent, ShiftTemplate } from '../data/clock.repository.ts'

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
  departureMin: number | null
  scheduledStartLabel: string | null
  arrivalLabel: string | null
  departureLabel: string | null
  latenessMin: number
  isLate: boolean
  statusLabel: string
  /** Umbral de tolerancia en minutos para esta sucursal — viene del
   *  latenessRule del API (default 10). UI lo usa para calcular si el
   *  barbero llegó "tarde" según la política real, no un hardcode. */
  latenessThresholdMin: number
}

function isForbidden(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /forbidden|unauthorized|not authorized|no autorizad/i.test(msg)
}

export function useClock(staffUserId: string | null, locationId: string | null) {
  const { clock } = useRepositories()
  const { locationTimezone } = useLocation()
  const [events, setEvents] = useState<TimeClockEvent[]>([])
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([])
  const [loading, setLoading] = useState(true)
  // Submitting cubre las mutaciones clockIn/clockOut. La página usa este
  // flag para deshabilitar el botón y mostrar "Guardando…", evitando
  // doble-submit cuando el operador apreta varias veces antes del refresh.
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // True when the API rejected the events/templates queries with Forbidden,
  // i.e. the barber isn't assigned to this location (a setup task for the
  // admin, not a transient runtime error).
  const [notAssignedHere, setNotAssignedHere] = useState(false)
  // Tolerancia configurada por la sucursal (default 10 min). Se usa para
  // calcular el retardo del barbero según la política real, no un hardcode.
  const [latenessThresholdMin, setLatenessThresholdMin] = useState(10)

  // `showSpinner` = mount inicial muestra el skeleton; el refetch de
  // focus/visibilitychange (ver ClockPage) hace revalidación en background
  // sin parpadeo. `force` = network-only para shiftTemplates/latenessRule,
  // que son config del admin sin eviction local (a diferencia de
  // registers/openSession) — sin esto, un cambio de plantilla de turno o
  // de tolerancia de tardanza a mitad del día se queda stale hasta un hard
  // reload. Mismo patrón showSpinner/force que loadDay en MyDayPage.
  const refresh = useCallback((opts?: { showSpinner?: boolean; force?: boolean }) => {
    if (!staffUserId || !locationId) return
    const d = localDayInTz(new Date(), locationTimezone)
    const showSpinner = opts?.showSpinner ?? true
    const force = opts?.force ?? false
    if (showSpinner) setLoading(true)
    setError(null)
    setNotAssignedHere(false)
    // Independent fetches: events, shift templates, lateness rule — fallan o
    // pasan por razones distintas. La lateness rule es informativa: si falla
    // caemos al default (10 min) en lugar de bloquear el reloj.
    void Promise.allSettled([
      clock.getEvents(staffUserId, locationId, d, d),
      clock.getShiftTemplates(staffUserId, locationId, { force }),
      clock.getLatenessThresholdMin(locationId, { force }),
    ]).then(([evtsRes, templatesRes, latenessRes]) => {
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
      if (latenessRes.status === 'fulfilled') {
        setLatenessThresholdMin(latenessRes.value)
      }
      // Si la lateness query falla, mantenemos el default — no bloquea nada.

      if (eventsForbidden || templatesForbidden) {
        setNotAssignedHere(true)
      }
      setLoading(false)
    })
  }, [clock, staffUserId, locationId, locationTimezone])

  useEffect(() => { refresh() }, [refresh])

  const isClockedIn = events.length > 0 && events[events.length - 1].type === 'CLOCK_IN'

  const shiftStatus: ShiftStatus = useMemo(() => {
    const dow = dayOfWeekInTz(new Date().toISOString(), locationTimezone)
    const todayShift = shiftTemplates.find((t) => t.dayOfWeek === dow)

    // Use the LATEST CLOCK_IN, not the first. With double shifts (IN→OUT→IN),
    // the first CLOCK_IN belongs to the morning shift; for the afternoon shift
    // the operator expects to see the 3pm entry, not the 8am one.
    const latestClockIn = events.filter((e) => e.type === 'CLOCK_IN').at(-1)
    const arrivalMin = latestClockIn ? minutesOfDayInTz(latestClockIn.at, locationTimezone) : null

    // Surface the latest CLOCK_OUT once the barber has clocked out — without
    // this, there's no way to see "when did I leave?" on the reloj screen.
    const latestClockOut = events.filter((e) => e.type === 'CLOCK_OUT').at(-1)
    const departureMin =
      !isClockedIn && latestClockOut ? minutesOfDayInTz(latestClockOut.at, locationTimezone) : null
    const departureLabel = departureMin !== null ? formatMinToTime(departureMin) : null

    if (!todayShift) {
      return {
        scheduledStartMin: null,
        scheduledEndMin: null,
        arrivalMin,
        departureMin,
        scheduledStartLabel: null,
        arrivalLabel: arrivalMin !== null ? formatMinToTime(arrivalMin) : null,
        departureLabel,
        latenessMin: 0,
        isLate: false,
        statusLabel: 'Sin turno programado',
        latenessThresholdMin,
      }
    }

    const scheduledStart = todayShift.startMin
    // Usar el umbral real de la sucursal en vez del hardcode de 5 min. Si la
    // sucursal toleró 10 min y el barbero llegó 6 min tarde, NO es retardo.
    const latenessMin =
      arrivalMin !== null ? Math.max(0, arrivalMin - scheduledStart - latenessThresholdMin) : 0
    const isLate = latenessMin > 0

    let statusLabel: string
    if (arrivalMin === null) statusLabel = 'Esperando entrada'
    else if (isLate) statusLabel = `Retardo (+${latenessMin} min)`
    else statusLabel = 'A tiempo'

    return {
      scheduledStartMin: scheduledStart,
      scheduledEndMin: todayShift.endMin,
      arrivalMin,
      departureMin,
      scheduledStartLabel: formatMinToTime(scheduledStart),
      arrivalLabel: arrivalMin !== null ? formatMinToTime(arrivalMin) : null,
      departureLabel,
      latenessMin,
      isLate,
      statusLabel,
      latenessThresholdMin,
    }
  }, [events, shiftTemplates, isClockedIn, latenessThresholdMin, locationTimezone])

  const doClockIn = useCallback(async (): Promise<boolean> => {
    if (!locationId || submitting) return false
    setSubmitting(true)
    try {
      const ok = await clock.clockIn(locationId)
      if (!ok) {
        setError('Ya tienes una entrada registrada hoy')
        return false
      }
      setError(null)
      refresh()
      return true
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[doClockIn] failed', err)
      }
      setError('No se pudo registrar entrada')
      return false
    } finally {
      setSubmitting(false)
    }
  }, [clock, locationId, refresh, submitting])

  const doClockOut = useCallback(async () => {
    if (!locationId || submitting) return
    setSubmitting(true)
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
    } finally {
      setSubmitting(false)
    }
  }, [clock, locationId, refresh, submitting])

  return { events, isClockedIn, loading, submitting, error, notAssignedHere, doClockIn, doClockOut, refresh, shiftStatus }
}
