import { useState, useEffect, useCallback } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import type { WalkIn } from '../domain/walkins.types.ts'

/**
 * Cola de walk-ins de la sucursal. Clase VIVO sin dinero (spec 2026-09-18
 * § 3.1): se puede pintar lo que quedó en memoria de ESTA sesión, pero TODA
 * lectura —la del montaje incluida— se revalida contra la red. Cuándo
 * recargar lo decide el canal único de frescura (la pantalla registra
 * `refresh` con `useLiveRefresh`); el hook no espía el estado de la ventana
 * ni vuelve a preguntar cada N segundos por su cuenta.
 */
export function useWalkIns(locationId: string | null) {
  const { walkins } = useRepositories()
  const [list, setList] = useState<WalkIn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /**
   * Hora del último dato BUENO. Es lo que se le canta al operador cuando la
   * red falla y seguimos mostrando la cola anterior; `null` = todavía no
   * llegó nada, así que no hay hora que inventar.
   */
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)

  /**
   * Lectura pura: ni un `setState`, para que el montaje pueda llamarla desde
   * el cuerpo del efecto sin arrastrar escritura de estado a un efecto.
   *
   * Siempre `force` (→ network-only) y ya sin opción para el caller: la cola
   * es dato compartido de toda la sucursal — otro operador puede
   * assign/complete/drop desde SU tablet sin que ésta reciba nada — así que
   * servirla del caché sería mostrar la fila de otro momento. El repositorio
   * conserva su parámetro porque Hoy también lo usa.
   */
  const fetchWalkIns = useCallback((): Promise<WalkIn[] | null> => {
    if (!locationId) return Promise.resolve(null)
    return walkins.getWalkIns(locationId, undefined, undefined, { force: true })
  }, [walkins, locationId])

  /**
   * Recarga que se registra en el canal de frescura. Devuelve su promesa y
   * RE-LANZA el fallo después de pintarlo: si se lo tragara, el canal movería
   * su hora de "actualizado" con datos que nunca llegaron (handoff T-007).
   */
  const refresh = useCallback((): Promise<void> => {
    if (!locationId) return Promise.resolve()
    setLoading(true)
    return fetchWalkIns()
      .then((all) => {
        if (!all) return
        setList(all)
        setLastLoadedAt(new Date())
        // El aviso se retira al recuperarse: antes el mensaje se quedaba
        // pegado para siempre porque sólo se escribía en el fallo.
        setError(null)
      })
      .catch((err: unknown) => {
        // La cola en memoria NO se tira: [D-018] (tirar el dato al fallar)
        // es regla de DINERO. Lo vivo se conserva, pero con aviso: la
        // pantalla lo acompaña con la hora de `lastLoadedAt`.
        setError('No se pudo cargar walk-ins')
        throw err
      })
      .finally(() => setLoading(false))
  }, [fetchWalkIns, locationId])

  // Carga inicial. El efecto sólo lanza la lectura: todo setState vive en los
  // callbacks de la promesa y `cancelled` evita pintar sobre un componente ya
  // desmontado.
  useEffect(() => {
    if (!locationId) return
    let cancelled = false
    void fetchWalkIns()
      .then((all) => {
        if (cancelled || !all) return
        setList(all)
        setLastLoadedAt(new Date())
        setError(null)
      })
      .catch(() => {
        if (cancelled) return
        setError('No se pudo cargar walk-ins')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [locationId, fetchWalkIns])

  // Re-sincronización tras una mutación propia (el repositorio además evicta
  // el campo `walkIns` del caché). El rechazo se traga AQUÍ a propósito:
  // `refresh` ya lo pintó y nadie espera esta promesa; dejarla suelta sería
  // un rechazo sin manejar.
  const create = useCallback(
    async (
      customerName: string | null,
      customerPhone?: string | null,
      customerEmail?: string | null,
      customerId?: string | null,
    ) => {
      if (!locationId) return
      await walkins.create({ locationId, customerId, customerName, customerPhone, customerEmail })
      void refresh().catch(() => {})
    },
    [walkins, locationId, refresh],
  )

  const assign = useCallback(
    async (walkInId: string, staffUserId: string) => {
      const result = await walkins.assign(walkInId, staffUserId)
      void refresh().catch(() => {})
      return result
    },
    [walkins, refresh],
  )

  const complete = useCallback(
    async (walkInId: string) => {
      await walkins.complete(walkInId)
      void refresh().catch(() => {})
    },
    [walkins, refresh],
  )

  const drop = useCallback(
    async (walkInId: string, reason?: string | null) => {
      await walkins.drop(walkInId, reason)
      void refresh().catch(() => {})
    },
    [walkins, refresh],
  )

  const pauseWalkIn = useCallback(
    async (walkInId: string) => {
      await walkins.pauseWalkIn(walkInId)
      void refresh().catch(() => {})
    },
    [walkins, refresh],
  )

  const resumeWalkIn = useCallback(
    async (walkInId: string) => {
      await walkins.resumeWalkIn(walkInId)
      void refresh().catch(() => {})
    },
    [walkins, refresh],
  )

  const markWalkInNoShow = useCallback(
    async (walkInId: string) => {
      await walkins.markWalkInNoShow(walkInId)
      void refresh().catch(() => {})
    },
    [walkins, refresh],
  )

  const reorderWalkIns = useCallback(
    async (orderedIds: string[]) => {
      if (!locationId) return
      await walkins.reorderWalkIns({ locationId, orderedIds })
      void refresh().catch(() => {})
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
    lastLoadedAt,
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
