import { useState, useEffect, useCallback } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import type { Register, RegisterSession, CloseSessionInput } from '../domain/register.types.ts'

export function useRegister(locationId: string | null) {
  const { register } = useRepositories()
  const [registers, setRegisters] = useState<Register[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!locationId) return
    setLoading(true)
    register
      .getRegisters(locationId)
      .then(setRegisters)
      .catch(() => setError('No se pudo cargar las cajas'))
      .finally(() => setLoading(false))
  }, [register, locationId])

  useEffect(() => { refresh() }, [refresh])

  const openSession = useCallback(
    async (registerId: string, openingCashCents: number) => {
      try {
        await register.openSession(registerId, openingCashCents)
        refresh()
      } catch {
        setError('No se pudo abrir la sesión')
      }
    },
    [register, refresh],
  )

  const closeSession = useCallback(
    async (input: CloseSessionInput): Promise<RegisterSession | null> => {
      try {
        const session = await register.closeSession(input)
        refresh()
        return session
      } catch {
        setError('No se pudo cerrar la sesión')
        return null
      }
    },
    [register, refresh],
  )

  return { registers, loading, error, openSession, closeSession, refresh }
}
