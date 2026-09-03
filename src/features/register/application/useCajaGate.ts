import { useState, useEffect, useCallback, useRef } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'

export type CajaGateState =
  | { kind: 'checking' }
  | { kind: 'clear' }
  | { kind: 'stale'; openedAt: string }

/**
 * Gate del shell: ¿la caja abierta de la sucursal es de un día anterior?
 *
 * Verifica por red al montar (PosShell se monta de nuevo en cada desbloqueo
 * con PIN, así que "montar" == "iniciar sesión"), al volver el foco o la
 * visibilidad de la pantalla, y — solo mientras está bloqueado — en cada
 * cambio de ruta, para soltar el bloqueo apenas el wizard cierra la caja.
 *
 * La regla "¿es de un día anterior?" la decide el API (`isStale`, con la tz
 * de la sucursal) — aquí no se recalcula. Fail-open: si la consulta falla no
 * atrapamos al operador por un blip de red; el API rechaza igual las ventas
 * contra una caja de ayer.
 */
export function useCajaGate(locationId: string | null, pathname: string): CajaGateState {
  const { register } = useRepositories()
  const [state, setState] = useState<CajaGateState>(() =>
    locationId ? { kind: 'checking' } : { kind: 'clear' },
  )
  // Última respuesta gana: un check disparado por foco puede resolver después
  // de uno más nuevo disparado por ruta; ignoramos las respuestas viejas.
  const seqRef = useRef(0)
  const staleRef = useRef(false)

  const check = useCallback((): Promise<void> => {
    if (!locationId) return Promise.resolve()
    const seq = ++seqRef.current
    return register
      .getCajaStatus(locationId)
      .then((status) => {
        if (seq !== seqRef.current) return
        const stale = status.isOpen && status.isStale && !!status.openedAt
        staleRef.current = stale
        setState(stale ? { kind: 'stale', openedAt: status.openedAt! } : { kind: 'clear' })
      })
      .catch(() => {
        if (seq !== seqRef.current) return
        staleRef.current = false
        setState({ kind: 'clear' })
      })
  }, [register, locationId])

  // Mount / cambio de sucursal o tz.
  useEffect(() => {
    check()
    return () => {
      // Invalida respuestas en vuelo al desmontar.
      seqRef.current += 1
    }
  }, [check])

  // Volver a la pantalla: en tablet, alternar apps no dispara window.focus,
  // así que escuchamos también visibilitychange (mismo patrón que CajaPage).
  useEffect(() => {
    const onFocus = () => { check() }
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [check])

  // Mientras está bloqueado, cada navegación re-verifica: el wizard de cierre
  // navega al terminar y eso es la señal de que quizá ya hubo corte.
  useEffect(() => {
    if (staleRef.current) check()
  }, [pathname, check])

  return state
}
