import { useEffect } from 'react'
import { isRouteAllowed } from '@/core/permissions/posTabs.ts'
import { routePrefetchers } from './router'

/**
 * Tras el primer paint, en idle, dispara el dynamic import de los chunks de
 * ruta que el viewer PUEDE ver. El prefetch on-hover/touchstart de
 * BottomTabNav cubre la navegación deliberada; esto cubre el PRIMER tap a
 * cualquier ruta aunque no haya hover (las tablets táctiles no generan
 * hover). Llamar dos veces el mismo import es no-op: el browser cachea el
 * módulo.
 *
 * Solo rutas permitidas: un tab que el rol no tiene no debería ni
 * descargarse — es ancho de banda de la tablet gastado en código que el
 * operador nunca va a abrir (el guard de `PosShell` lo redirige). El mapa
 * ruta→tab→permiso vive en `posTabs.ts` (`isRouteAllowed`); aquí no se
 * duplica ninguna lista.
 */
export function useIdleRoutePrefetch(permissions: readonly string[]): void {
  useEffect(() => {
    // Sin ningún permiso no hay nada que el viewer pueda abrir (ve "Sin
    // módulos habilitados"): cero prefetch, ni siquiera de rutas que no
    // pertenecen a un tab.
    if (permissions.length === 0) return

    // Varios paths comparten prefetcher (`/caja`, `/caja/abrir`… → mismo
    // chunk): se deduplica por función después de filtrar.
    const prefetchers = Array.from(
      new Set(
        Object.entries(routePrefetchers)
          .filter(([path]) => isRouteAllowed(path, permissions))
          .map(([, prefetch]) => prefetch),
      ),
    )
    if (prefetchers.length === 0) return

    let cancelled = false
    let idleId: number | undefined

    const run = () => {
      if (cancelled) return
      for (const prefetch of prefetchers) {
        // Un chunk que falla al precachear no debe romper nada — la
        // navegación real lo reintenta. Silenciamos el rechazo.
        void prefetch().catch(() => {})
      }
    }

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: 2000 })
    } else {
      idleId = window.setTimeout(run, 1200)
    }

    return () => {
      cancelled = true
      if (idleId === undefined) return
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId)
      else window.clearTimeout(idleId)
    }
  }, [permissions])
}
