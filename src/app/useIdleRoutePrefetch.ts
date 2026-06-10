import { useEffect } from 'react'
import { routePrefetchers } from './router'

/**
 * Tras el primer paint, en idle, dispara el dynamic import de TODOS los chunks
 * de ruta. El prefetch on-hover/touchstart de BottomTabNav cubre la navegación
 * deliberada; esto cubre el PRIMER tap a cualquier ruta aunque no haya hover
 * (las tablets táctiles no generan hover). Llamar dos veces el mismo import es
 * no-op: el browser cachea el módulo.
 */
export function useIdleRoutePrefetch(): void {
  useEffect(() => {
    const prefetchers = Array.from(new Set(Object.values(routePrefetchers)))
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
  }, [])
}
