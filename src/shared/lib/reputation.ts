/**
 * Reputación del cliente — espejo del enum `CustomerReputationTag` del API.
 * Se mantiene como union local (no se importa del codegen) por el mismo criterio
 * que `AppointmentStatus`: desacopla la capa de dominio del POS del preset de
 * codegen y evita que un cambio de generación rompa imports en cascada.
 */
export type CustomerReputationTag =
  | 'RELIABLE'
  | 'OCCASIONAL_NO_SHOW'
  | 'FREQUENT_NO_SHOW'
  | 'FLAGGED_BY_STAFF'
  | 'VIP'

/**
 * Marcas MANUALES que el POS muestra al barbero en el piso. Solo estas dos las
 * pone a mano admin/recepción y comunican algo accionable al atender:
 *   - VIP              → trato preferente.
 *   - FLAGGED_BY_STAFF → cliente señalado ("atención").
 * Los tags de no-show (ocasional/frecuente) se derivan automáticamente del
 * historial y serían ruido en la fila — NO se muestran.
 */
export type ReputationMark = 'VIP' | 'FLAGGED_BY_STAFF'

/**
 * Reduce el enum completo de reputación a las dos marcas manuales que el POS
 * hace visibles. Devuelve `null` para todo lo demás (RELIABLE, tags de no-show,
 * null, o un valor desconocido si el enum del API creciera). Fuente única de la
 * regla "qué marca se muestra" — compartida por la fila del Hoy y el chip del
 * cliente del checkout para que ambos superficies decidan idéntico.
 */
export function reputationMark(
  tag: CustomerReputationTag | string | null | undefined,
): ReputationMark | null {
  return tag === 'VIP' || tag === 'FLAGGED_BY_STAFF' ? tag : null
}
