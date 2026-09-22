import { useState, useEffect, useCallback } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import { useFreshness, useLiveRefresh } from '@/core/freshness/useLiveRefresh'
import type { FreshnessTopic } from '@/core/freshness/FreshnessProvider'
import type { Register, RegisterSession, CloseSessionInput } from '../domain/register.types.ts'

const LOAD_ERROR_MESSAGE = 'No se pudo cargar las cajas'

/**
 * Temas del canal de frescura que mueven la caja ([D-019]: una carga por CLASE
 * de dato, no una por pantalla).
 *
 * - `register`: otra iPad (o el admin) abrió o cerró la caja —
 *   `posDataChanged` REGISTER lo emite.
 * - `sales`: una venta cobrada en otra terminal mueve el ESPERADO de la
 *   sesión abierta (efectivo/tarjeta/transferencia), que es dinero en
 *   pantalla; `posDataChanged` PAYMENT además emite los dos temas.
 *
 * Constante de módulo: un literal nuevo por render re-registraría sin parar.
 */
const REGISTER_TOPICS: readonly FreshnessTopic[] = ['sales', 'register']

/**
 * Estados de la lectura de caja, en el mismo vocabulario que las cifras de
 * dinero (spec § 3.1b, `MoneyValueStatus`): `loading` mientras no hay
 * respuesta del servidor, `updating` cuando ya hubo una y viene otra en
 * camino, `offline` si el canal en vivo está caído y `error` si la consulta
 * falló con el canal arriba. Nunca hay un estado que pinte dato viejo.
 */
export type RegisterStatus = 'loading' | 'fresh' | 'updating' | 'offline' | 'error'

/**
 * Lectura de las cajas de la sucursal para Caja (pantalla + wizard de corte).
 *
 * `registers` es `Register[] | null`: `null` es "no sé" ([D-020]) — ni lista
 * vacía ni la anterior. Un fallo TIRA lo que había ([D-018]) porque la sesión
 * abierta trae los montos esperados del corte: dejarlos en pantalla con un
 * banner es justo lo que hace cuadrar mal una caja.
 *
 * No vigila el foco ni la visibilidad de la ventana: se registra en el canal
 * ÚNICO de frescura (`src/core/freshness`) y ahí se entera de lo que pasa en
 * otras terminales.
 */
export function useRegister(locationId: string | null) {
  const { register } = useRepositories()
  // Distingue "se cayó la red" de "el servidor respondió con error".
  const { connection } = useFreshness()
  const [registers, setRegisters] = useState<Register[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Recarga por aviso del canal, por "Reintentar" o tras abrir/cerrar sesión.
  // Devuelve la promesa y la deja FALLAR: el canal sólo mueve la hora del
  // último dato si todas las pantallas resolvieron. Nunca se invoca desde el
  // cuerpo síncrono de un efecto (ver el montaje, abajo).
  const load = useCallback((): Promise<void> => {
    if (!locationId) return Promise.resolve()
    setLoadFailed(false)
    setRefreshing(true)
    return register
      .getRegisters(locationId)
      .then((data) => {
        setRegisters(data)
      })
      .catch((err: unknown) => {
        // [D-018]: lo anterior se tira. El operador ve "no se pudo cargar",
        // no un esperado de hace media hora haciéndose pasar por el de ahora.
        setRegisters(null)
        setLoadFailed(true)
        throw err
      })
      .finally(() => {
        setRefreshing(false)
      })
  }, [register, locationId])

  useLiveRefresh(load, REGISTER_TOPICS)

  // Carga inicial: el efecto SÓLO lanza el fetch, cero setState en su cuerpo
  // (mismo patrón que DaySalesPage). El estado inicial ya es "no sé"
  // (registers=null), así que no hace falta repetirlo aquí; todo lo que
  // escribe estado vive en los callbacks, con `cancelled` para no pintar
  // sobre un componente desmontado.
  //
  // Entrar a Caja SIEMPRE refleja el servidor: el repositorio va a la red en
  // cada lectura ([D-017]), así que si el admin cerró la caja remotamente ya
  // no hay snapshot viejo que diga "CAJA ABIERTA" y engañe al operador.
  useEffect(() => {
    if (!locationId) return
    let cancelled = false
    register
      .getRegisters(locationId)
      .then((data) => {
        if (cancelled) return
        setRegisters(data)
      })
      .catch(() => {
        if (cancelled) return
        setLoadFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [register, locationId])

  const openSession = useCallback(
    async (registerId: string, openingCashCents: number) => {
      try {
        await register.openSession(registerId, openingCashCents)
        // El fallo del refresco ya se pinta en el estado; acá sólo se evita
        // la promesa suelta (load re-lanza para el canal).
        void load().catch(() => {})
      } catch (e) {
        // Re-sincroniza contra el servidor y re-lanza el error ORIGINAL: el
        // caller decide cómo mostrar el fallo — nunca lo tragamos devolviendo
        // silenciosamente, y un tropiezo del refresco no lo suplanta.
        await load().catch(() => {})
        throw e
      }
    },
    [register, load],
  )

  const closeSession = useCallback(
    async (input: CloseSessionInput): Promise<RegisterSession> => {
      try {
        const session = await register.closeSession(input)
        void load().catch(() => {})
        return session
      } catch (e) {
        // Re-sincroniza ANTES de re-lanzar: un rechazo por "esta caja ya fue
        // cerrada" (cierre remoto desde el admin) auto-sana la vista — al
        // re-leer `registers` la caja pasa a cerrada y el wizard sale limpio
        // a la vista de caja cerrada en vez de mostrar un éxito falso.
        await load().catch(() => {})
        throw e
      }
    },
    [register, load],
  )

  // Derivado en render, sin espejo del dato en estado: "no sé" es `null`, y
  // `updating` exige que YA haya una lista del servidor y otra carga en vuelo.
  const status: RegisterStatus = loadFailed
    ? connection === 'offline'
      ? 'offline'
      : 'error'
    : registers === null
      ? 'loading'
      : refreshing
        ? 'updating'
        : 'fresh'

  return {
    registers,
    status,
    error: loadFailed ? LOAD_ERROR_MESSAGE : null,
    openSession,
    closeSession,
    /** Recarga a red. RECHAZA si falla (el canal cuenta con eso). */
    refresh: load,
  }
}
