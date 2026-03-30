import { useState, useEffect, useCallback } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import type { Appointment } from '../domain/agenda.types.ts'

function todayRangeISO(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now)
  from.setHours(0, 0, 0, 0)
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function useAgenda(staffUserId: string | null, locationId: string | null) {
  const { agenda } = useRepositories()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!locationId) return
    const { from, to } = todayRangeISO()
    setLoading(true)
    agenda
      .getAppointments(from, to, locationId)
      .then((all: Appointment[]) => {
        setAppointments(all)
      })
      .catch(() => setError('No se pudo cargar la agenda'))
      .finally(() => setLoading(false))
  }, [agenda, staffUserId, locationId])

  useEffect(() => { refresh() }, [refresh])

  const checkIn = useCallback(async (id: string) => {
    await agenda.checkIn(id); refresh()
  }, [agenda, refresh])

  const startService = useCallback(async (id: string) => {
    await agenda.startService(id); refresh()
  }, [agenda, refresh])

  const complete = useCallback(async (id: string) => {
    await agenda.complete(id); refresh()
  }, [agenda, refresh])

  const noShow = useCallback(async (id: string) => {
    await agenda.noShow(id); refresh()
  }, [agenda, refresh])

  return { appointments, loading, error, refresh, checkIn, startService, complete, noShow }
}
