/**
 * "¿Hay una venta en curso?" — store mínimo, fuera de React.
 *
 * Por qué NO es un contexto de React (spec § 3.3 punto 4): el único lector es
 * el bloqueo automático, que vive en el shell de la app, y los únicos que
 * escriben están dentro del flujo de cobro. Con un contexto, el proveedor
 * tendría que envolver toda la app para que un feature le hablara a `core/auth`,
 * y cada publicación re-renderizaría el árbol entero. Aquí el cobro importa dos
 * setters, `useAutoLock` se suscribe con `useSyncExternalStore` y nadie más se
 * entera.
 *
 * Es deliberadamente tonto: dos banderas, sin historial, sin timers y sin
 * ninguna regla de negocio. Quién cuenta como "venta en curso" lo decide el
 * feature de cobro al llamar a los setters, no este archivo.
 *
 * Alcance: un solo POS por pestaña, así que un módulo con estado global es
 * exactamente la vida del proceso. No se persiste en ningún lado — una venta
 * en curso no sobrevive a un reload.
 */

/** Las dos banderas que el cobro publica para el bloqueo automático. */
export interface SaleActivity {
  /**
   * Hay un cobro abierto: carrito con al menos un concepto o pantalla de pago
   * en pantalla. Le da al operador el tiempo largo (`checkoutSeconds`), porque
   * en ese rato el cliente busca el efectivo o la terminal tarda.
   *
   * La pantalla de recibo NO cuenta como venta en curso (spec § 3.3 punto 1):
   * al cerrar el cobro vuelve a correr el tiempo corto.
   */
  readonly inProgress: boolean
  /**
   * Un cobro se está ENVIANDO al API. Mientras sea `true` el POS no se bloquea
   * por mucho que pase el tiempo: bloquear a media petición dejaría al operador
   * sin saber si la venta se registró.
   */
  readonly submitting: boolean
}

/** Estado de arranque y de reposo: ni venta abierta ni cobro en vuelo. */
const IDLE: SaleActivity = Object.freeze({ inProgress: false, submitting: false })

let snapshot: SaleActivity = IDLE
const listeners = new Set<() => void>()

/**
 * Suscripción para `useSyncExternalStore`. Devuelve la función de baja.
 */
export function subscribeSaleActivity(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
  }
}

/**
 * Instantánea para `useSyncExternalStore`. La referencia SOLO cambia cuando
 * cambia alguna bandera: si devolviera un objeto nuevo en cada llamada, React
 * entraría en un bucle de renders ("getSnapshot should be cached").
 */
export function getSaleActivitySnapshot(): SaleActivity {
  return snapshot
}

function publish(next: SaleActivity): void {
  if (next.inProgress === snapshot.inProgress && next.submitting === snapshot.submitting) return
  snapshot = Object.freeze(next)
  // Copia de la lista: un oyente puede darse de baja durante la notificación.
  for (const listener of [...listeners]) listener()
}

/** El cobro abre o cierra una venta (carrito con líneas / pantalla de pago). */
export function setSaleInProgress(inProgress: boolean): void {
  publish({ inProgress, submitting: snapshot.submitting })
}

/** El cobro empieza o termina de enviar la venta al API. */
export function setSaleSubmitting(submitting: boolean): void {
  publish({ inProgress: snapshot.inProgress, submitting })
}

/**
 * Vuelta a reposo. Para el cierre del flujo de cobro (venta cobrada o
 * cancelada) y para aislar tests entre sí.
 */
export function resetSaleActivity(): void {
  publish(IDLE)
}
