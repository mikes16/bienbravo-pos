import { useState, useEffect, useCallback } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import type { WalkIn } from '../domain/walkins.types.ts'

export function useWalkIns(locationId: string | null) {
  const { walkins } = useRepositories()
  const [list, setList] = useState<WalkIn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!locationId) return
    setLoading(true)
    walkins
      .getWalkIns(locationId)
      .then(setList)
      .catch(() => setError('No se pudo cargar walk-ins'))
      .finally(() => setLoading(false))
  }, [walkins, locationId])

  useEffect(() => { refresh() }, [refresh])

  const create = useCallback(
    async (
      customerName: string | null,
      customerPhone?: string | null,
      customerEmail?: string | null,
      customerId?: string | null,
    ) => {
      if (!locationId) return
      await walkins.create({ locationId, customerId, customerName, customerPhone, customerEmail })
      refresh()
    },
    [walkins, locationId, refresh],
  )

  const assign = useCallback(
    async (walkInId: string, staffUserId: string) => {
      const result = await walkins.assign(walkInId, staffUserId)
      refresh()
      return result
    },
    [walkins, refresh],
  )

  const complete = useCallback(
    async (walkInId: string) => {
      await walkins.complete(walkInId)
      refresh()
    },
    [walkins, refresh],
  )

  const drop = useCallback(
    async (walkInId: string, reason?: string | null) => {
      await walkins.drop(walkInId, reason)
      refresh()
    },
    [walkins, refresh],
  )

  const pauseWalkIn = useCallback(
    async (walkInId: string) => {
      await walkins.pauseWalkIn(walkInId)
      refresh()
    },
    [walkins, refresh],
  )

  const resumeWalkIn = useCallback(
    async (walkInId: string) => {
      await walkins.resumeWalkIn(walkInId)
      refresh()
    },
    [walkins, refresh],
  )

  const markWalkInNoShow = useCallback(
    async (walkInId: string) => {
      await walkins.markWalkInNoShow(walkInId)
      refresh()
    },
    [walkins, refresh],
  )

  const reorderWalkIns = useCallback(
    async (orderedIds: string[]) => {
      if (!locationId) return
      await walkins.reorderWalkIns({ locationId, orderedIds })
      refresh()
    },
    [walkins, refresh, locationId],
  )

  const fetchSuggestedNext = useCallback(
    async (staffUserId: string) => {
      if (!locationId) return null
      return walkins.suggestedNextWalkIn({ locationId, staffUserId })
    },
    [walkins, locationId],
  )

  return {
    list,
    loading,
    error,
    create,
    assign,
    complete,
    drop,
    refresh,
    pauseWalkIn,
    resumeWalkIn,
    markWalkInNoShow,
    reorderWalkIns,
    fetchSuggestedNext,
  }
}
