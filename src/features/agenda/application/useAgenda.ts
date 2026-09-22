import { useState, useEffect, useCallback } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import { useLocation } from '@/core/location/useLocation'
import { localDayInTz, localDayRangeInTz } from '@/shared/lib/date'
import type { Appointment } from '../domain/agenda.types.ts'

/**
 * Citas de hoy en la sucursal. Clase VIVO sin dinero (spec 2026-09-18 § 3.1):
 * se puede pintar lo que quedó en memoria de ESTA sesión, pero TODA lectura
 * —la del montaje incluida— se revalida contra la red. Cuándo recargar lo
 * decide el canal único de frescura (la pantalla registra `refresh` con
 * `useLiveRefresh`); el hook no vigila la ventana ni pregunta por su cuenta.
 *
 * @param _staffUserId barbero de la sesión. La consulta trae la agenda de la
 *   SUCURSAL completa (no filtra por barbero), así que hoy no se usa: queda en
 *   la firma para cuando exista el filtro "sólo mis citas". Fuera de las
 *   dependencias a propósito: incluirlo dispara una segunda lectura de red en
 *   cuanto el viewer termina de cargar.
 */
export function useAgenda(_staffUserId: string | null, locationId: string | null) {
  const { agenda } = useRepositories()
  const { locationTimezone } = useLocation()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /**
   * Hora del último dato BUENO. Es lo que se le canta al operador cuando la
   * red falla y seguimos mostrando la lista anterior; `null` = todavía no
   * llegó nada, así que no hay hora que inventar.
   */
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)

  /**
   * Lectura pura: ni un `setState`, para que el montaje pueda llamarla desde
   * el cuerpo del efecto sin arrastrar escritura de estado a un efecto.
   *
   * Siempre `force` (→ network-only). Sin eso, el caché serviría el mismo
   * snapshot toda la sesión y las citas creadas desde el admin, el kiosko u
   * otra tablet no aparecerían nunca. El repositorio conserva su parámetro
   * porque Hoy también lo usa.
   */
  const fetchAppointments = useCallback((): Promise<Appointment[] | null> => {
    if (!locationId) return Promise.resolve(null)
    const { startUtc: from, endUtc: to } = localDayRangeInTz(
      localDayInTz(new Date(), locationTimezone),
      locationTimezone,
    )
    return agenda.getAppointments(
      from.toISOString(),
      to.toISOString(),
      locationId,
      undefined,
      { force: true },
    )
  }, [agenda, locationId, locationTimezone])

  /**
   * Recarga que se registra en el canal de frescura. Devuelve su promesa y
   * RE-LANZA el fallo después de pintarlo: si se lo tragara, el canal movería
   * su hora de "actualizado" con datos que nunca llegaron (handoff T-007).
   */
  const refresh = useCallback((): Promise<void> => {
    if (!locationId) return Promise.resolve()
    setLoading(true)
    return fetchAppointments()
      .then((all) => {
        if (!all) return
        setAppointments(all)
        setLastLoadedAt(new Date())
        // El aviso se retira al recuperarse: antes el mensaje se quedaba
        // pegado para siempre porque sólo se escribía en el fallo.
        setError(null)
      })
      .catch((err: unknown) => {
        // La lista en memoria NO se tira: [D-018] (tirar el dato al fallar)
        // es regla de DINERO. Lo vivo se conserva, pero con aviso: la
        // pantalla lo acompaña con la hora de `lastLoadedAt`.
        setError('No se pudo cargar la agenda')
        throw err
      })
      .finally(() => setLoading(false))
  }, [fetchAppointments, locationId])

  // Carga inicial. El efecto sólo lanza la lectura: todo setState vive en los
  // callbacks de la promesa y `cancelled` evita pintar sobre un componente ya
  // desmontado.
  useEffect(() => {
    if (!locationId) return
    let cancelled = false
    void fetchAppointments()
      .then((all) => {
        if (cancelled || !all) return
        setAppointments(all)
        setLastLoadedAt(new Date())
        setError(null)
      })
      .catch(() => {
        if (cancelled) return
        setError('No se pudo cargar la agenda')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [locationId, fetchAppointments])

  // Re-sincronización tras una mutación propia. El rechazo se traga AQUÍ a
  // propósito: `refresh` ya lo pintó y nadie espera esta promesa; dejarla
  // suelta sería un rechazo sin manejar.
  const checkIn = useCallback(async (id: string) => {
    await agenda.checkIn(id)
    void refresh().catch(() => {})
  }, [agenda, refresh])

  const startService = useCallback(async (id: string) => {
    await agenda.startService(id)
    void refresh().catch(() => {})
  }, [agenda, refresh])

  const complete = useCallback(async (id: string) => {
    await agenda.complete(id)
    void refresh().catch(() => {})
  }, [agenda, refresh])

  const noShow = useCallback(async (id: string) => {
    await agenda.noShow(id)
    void refresh().catch(() => {})
  }, [agenda, refresh])

  return { appointments, loading, error, lastLoadedAt, refresh, checkIn, startService, complete, noShow }
}
