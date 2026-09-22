import { useState, useEffect, useCallback } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import type { Register, RegisterSession, CloseSessionInput } from '../domain/register.types.ts'

export function useRegister(locationId: string | null) {
  const { register } = useRepositories()
  const [registers, setRegisters] = useState<Register[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Devuelve la promesa para que los callers puedan `await refresh()` — clave
  // para auto-sanar la vista en el catch de open/closeSession antes de re-lanzar.
  const refresh = useCallback((): Promise<void> => {
    if (!locationId) return Promise.resolve()
    setLoading(true)
    setError(null)
    return register
      .getRegisters(locationId)
      .then((data) => {
        setRegisters(data)
        setError(null)
      })
      .catch(() => setError('No se pudo cargar las cajas'))
      .finally(() => setLoading(false))
  }, [register, locationId])

  // Entrar a Caja SIEMPRE refleja el servidor: el repositorio va a la red en
  // cada lectura ([D-017]), así que si el admin cerró la caja remotamente ya no
  // hay snapshot viejo que diga "CAJA ABIERTA" y engañe al operador.
  useEffect(() => { refresh() }, [refresh])

  const openSession = useCallback(
    async (registerId: string, openingCashCents: number) => {
      try {
        await register.openSession(registerId, openingCashCents)
        refresh()
      } catch (e) {
        setError('No se pudo abrir la sesión')
        // Re-sincroniza contra el servidor y re-lanza: el caller decide cómo
        // mostrar el fallo — nunca lo tragamos devolviendo silenciosamente.
        await refresh()
        throw e
      }
    },
    [register, refresh],
  )

  const closeSession = useCallback(
    async (input: CloseSessionInput): Promise<RegisterSession> => {
      try {
        const session = await register.closeSession(input)
        refresh()
        return session
      } catch (e) {
        setError('No se pudo cerrar la sesión')
        // Re-sincroniza contra el servidor ANTES de re-lanzar: un rechazo por
        // "esta caja ya fue cerrada" (cierre remoto desde el admin) auto-sana la
        // vista — al re-leer `registers` la caja pasa a cerrada y el wizard sale
        // limpio a la vista de caja cerrada en vez de mostrar un éxito falso.
        await refresh()
        throw e
      }
    },
    [register, refresh],
  )

  return { registers, loading, error, openSession, closeSession, refresh }
}
