import { useContext, useEffect, useRef } from 'react'
import {
  FreshnessContext,
  type FreshnessContextValue,
  type FreshnessLoader,
  type FreshnessTopic,
} from './FreshnessProvider'

/**
 * Acceso al canal de frescura: estado de la conexión en vivo, hora del último
 * dato y el `refreshAll()` del botón "Actualizar".
 */
export function useFreshness(): FreshnessContextValue {
  const ctx = useContext(FreshnessContext)
  if (!ctx) throw new Error('useFreshness debe usarse dentro de FreshnessProvider')
  return ctx
}

/**
 * Registra la carga de una pantalla en los temas que le importan.
 *
 * **No invoca `load` al montar**: la carga inicial la decide la pantalla (con
 * su propia política de fetch). Esto sólo la conecta al canal de eventos —
 * cuando el servidor avisa de una venta, un walk-in o una cita, y cuando toca
 * ponerse al día (reconexión, foco, "Actualizar").
 *
 * `load` puede ser una closure distinta en cada render sin re-registrar nada:
 * se guarda en un ref y el registro sólo depende de los temas.
 */
export function useLiveRefresh(load: FreshnessLoader, topics: readonly FreshnessTopic[]): void {
  const { register } = useFreshness()

  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  // Llave por CONTENIDO: un array literal como dependencia cambia de
  // identidad en cada render y re-registraría (des/re-suscribiendo) sin
  // parar. `topics` es una lista corta y cerrada, así que la llave basta.
  const topicsKey = topics.join(',')

  useEffect(() => {
    const list = (topicsKey ? topicsKey.split(',') : []) as FreshnessTopic[]
    if (list.length === 0) return
    return register(() => loadRef.current(), list)
  }, [register, topicsKey])
}
