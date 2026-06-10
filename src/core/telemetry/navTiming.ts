import { bootKind, sendRum } from './rum'

/**
 * Mide "tap → ruta pintada" por navegación in-app.
 *
 * Las rutas se cargan con React.lazy + Suspense (no con loaders del router),
 * así que el router marca la navegación 'idle' de inmediato y el tiempo real
 * lo consume el Suspense mientras baja el chunk. Por eso medimos así:
 *   - `markNavStart()` se dispara cuando el router cambia de location.
 *   - `reportRoutePainted(route)` lo llama un probe (<RouteReady>) que monta
 *     SOLO cuando el componente lazy resolvió y el árbol commiteó — es decir,
 *     cuando la pantalla destino ya está lista para pintar.
 * La delta entre ambos ≈ descarga del chunk + render. Es la latencia que el
 * operador percibe al tocar una pestaña.
 */

let navStart = 0

export function markNavStart(): void {
  navStart = performance.now()
}

export function reportRoutePainted(route: string): void {
  if (navStart === 0) return
  const duration = performance.now() - navStart
  navStart = 0
  sendRum({ kind: 'nav', name: 'route-painted', value: duration, route, boot: bootKind() })
}

// Forma laxa del data router de React Router — evita acoplar al tipo interno
// de @remix-run/router (que cambia entre minors).
interface NavRouter {
  state: { location: { pathname: string } }
  subscribe: (cb: (state: { location: { pathname: string } }) => void) => () => void
}

/**
 * Marca el inicio de cada navegación al cambiar la location. Se llama una vez
 * en el arranque con el router singleton. Devuelve el unsubscribe.
 */
export function attachNavTiming(router: NavRouter): () => void {
  let lastPath = router.state.location.pathname
  return router.subscribe((state) => {
    if (state.location.pathname !== lastPath) {
      lastPath = state.location.pathname
      markNavStart()
    }
  })
}
