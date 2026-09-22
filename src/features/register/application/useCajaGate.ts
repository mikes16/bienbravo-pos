import { useState, useEffect, useCallback, useContext, useRef } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import {
  FreshnessContext,
  type FreshnessContextValue,
  type FreshnessTopic,
} from '@/core/freshness/FreshnessProvider'

export type CajaGateState =
  | { kind: 'checking' }
  | { kind: 'clear' }
  | { kind: 'stale'; openedAt: string }

/**
 * Tema del canal de frescura que mueve el gate ([D-019]: una carga por CLASE
 * de dato). `register` lo alimentan `posDataChanged` REGISTER (otra iPad o el
 * admin abrió/cerró la caja) y PAYMENT, además de la reconexión del socket, la
 * puesta al día del propio canal, `refreshAll()` (botón "Actualizar" y la
 * recuperación del cobro cuando el API rechaza con caja de ayer) y el
 * desbloqueo con PIN.
 *
 * Constante de módulo: un literal nuevo por render re-registraría sin parar.
 */
const GATE_TOPICS: readonly FreshnessTopic[] = ['register']

/**
 * Registro del gate en el canal de frescura, TOLERANTE a que no haya canal.
 *
 * No usa `useLiveRefresh` a propósito ([D-029] / [D-030]): ése lanza cuando no
 * hay provider arriba, y a este hook lo llama `PosShell`, cuyas guardas de
 * sesión corren DESPUÉS de los hooks. O sea que el shell —y este hook con él—
 * también se monta SIN sesión (deep link a /hoy con la cookie muerta, logout
 * estando dentro), justo donde `FreshnessGate` no monta el provider: lanzar ahí
 * deja la pantalla en blanco en vez de mandar al lock screen. Sin canal arriba
 * simplemente no hay registro, y la consulta de montaje sigue igual.
 *
 * NO invoca `load` al montar, mismo contrato que `useLiveRefresh`: eso lo hace
 * el efecto de montaje del hook. El cargador va por ref para que el registro
 * dependa sólo del canal y no de la identidad de la closure.
 */
function useRegisterChannel(
  register: FreshnessContextValue['register'] | undefined,
  load: () => Promise<void>,
): void {
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })
  useEffect(() => {
    if (!register) return
    return register(() => loadRef.current(), GATE_TOPICS)
  }, [register])
}

/**
 * Gate del shell: ¿la caja abierta de la sucursal es de un día anterior?
 *
 * Se pone al día por el canal ÚNICO de frescura (`src/core/freshness`), no por
 * su cuenta: cero temporizadores y cero vigilancia propia de la ventana
 * ([D-015], spec 2026-09-18 § 3.3 — los disparadores son eventos del servidor
 * y acciones del usuario). Antes se revalidaba solo, y por eso ni el aviso de
 * corte pendiente que emite el cobro al ser rechazado ni el corte hecho desde
 * otra tablet soltaban el bloqueo hasta cambiar de ruta.
 *
 * Además consulta al montar —`PosShell` se monta de nuevo en cada desbloqueo
 * con PIN, así que "montar" == "iniciar sesión"— y, sólo mientras bloquea, en
 * cada cambio de ruta: es acción del usuario (el wizard de cierre navega al
 * terminar) y suelta el bloqueo sin esperar el aviso del servidor.
 *
 * La regla "¿es de un día anterior?" la decide el API (`isStale`, con la tz de
 * la sucursal) — aquí no se recalcula. Fail-open: si la consulta falla no
 * atrapamos al operador por un blip de red; el API rechaza igual las ventas
 * contra una caja de ayer. El fallo se RE-LANZA después de pintar `clear`: si
 * se lo tragara, el canal movería su "Actualizado HH:MM" con un dato que nunca
 * llegó (contrato del handoff T-007).
 */
export function useCajaGate(locationId: string | null, pathname: string): CajaGateState {
  const { register: registerRepo } = useRepositories()
  // Canal leído DIRECTO del contexto (puede no existir): ver `useRegisterChannel`.
  const freshnessRegister = useContext(FreshnessContext)?.register
  const [state, setState] = useState<CajaGateState>(() =>
    locationId ? { kind: 'checking' } : { kind: 'clear' },
  )
  // Última respuesta gana: un check disparado por el canal puede resolver
  // después de uno más nuevo disparado por ruta; ignoramos las viejas.
  const seqRef = useRef(0)
  const staleRef = useRef(false)

  const check = useCallback((): Promise<void> => {
    if (!locationId) return Promise.resolve()
    const seq = ++seqRef.current
    return registerRepo
      .getCajaStatus(locationId)
      .then((status) => {
        if (seq !== seqRef.current) return
        const stale = status.isOpen && status.isStale && !!status.openedAt
        staleRef.current = stale
        setState(stale ? { kind: 'stale', openedAt: status.openedAt! } : { kind: 'clear' })
      })
      .catch((err: unknown) => {
        if (seq === seqRef.current) {
          staleRef.current = false
          setState({ kind: 'clear' })
        }
        // Se re-lanza siempre, incluso si otra respuesta ya ganó: la pantalla
        // queda abierta (fail-open) pero el canal tiene que saber que esta
        // carga NO trajo dato.
        throw err
      })
  }, [registerRepo, locationId])

  useRegisterChannel(freshnessRegister, check)

  // Mount / cambio de sucursal o tz. El rechazo se traga AQUÍ a propósito:
  // `check` ya pintó el fail-open y nadie espera esta promesa; dejarla suelta
  // sería un rechazo sin manejar. Re-lanzar es para el canal, que sí la espera.
  useEffect(() => {
    void check().catch(() => {})
    return () => {
      // Invalida respuestas en vuelo al desmontar.
      seqRef.current += 1
    }
  }, [check])

  // Mientras está bloqueado, cada navegación re-verifica: el wizard de cierre
  // navega al terminar y eso es la señal de que quizá ya hubo corte.
  useEffect(() => {
    if (staleRef.current) void check().catch(() => {})
  }, [pathname, check])

  return state
}
