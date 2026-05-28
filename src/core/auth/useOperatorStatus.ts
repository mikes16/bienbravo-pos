import { useEffect, useState } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import type { PosBarberStatus } from './auth.repository'

/**
 * Status laboral en vivo del operador logueado. Reutiliza el query
 * `posAvailableBarbers` (mismo que el lock roster), filtra por el staffId
 * del viewer, y refresca cada 60s para que el badge del header siempre
 * refleje el estado real.
 *
 * Devuelve `null` mientras carga o si no hay locationId — el header
 * decide si esconde el badge o muestra un fallback durante ese hueco.
 *
 * Por qué un poll y no una subscription: la info no necesita ser
 * milisegundos-fresca. El operador hace clock-in/out unas pocas veces al
 * día. Un poll de 60s es barato y elimina la complejidad de subscripciones.
 */
export function useOperatorStatus(
  viewerStaffId: string | null | undefined,
  locationId: string | null | undefined,
): PosBarberStatus | null {
  const { auth } = useRepositories()
  const [status, setStatus] = useState<PosBarberStatus | null>(null)

  useEffect(() => {
    if (!viewerStaffId || !locationId) {
      setStatus(null)
      return
    }
    let cancelled = false

    async function fetchOnce() {
      try {
        const map = await auth.getBarberStatuses(locationId!)
        if (cancelled) return
        // Si el viewer no está en el map de availability (no marcó entrada),
        // por convención del repo eso significa "fuera_de_turno". El map
        // solo incluye los que aparecen en TimeClockEvent del día.
        setStatus(map.get(viewerStaffId!) ?? 'fuera_de_turno')
      } catch {
        if (!cancelled) setStatus(null)
      }
    }

    void fetchOnce()
    const id = window.setInterval(fetchOnce, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [viewerStaffId, locationId, auth])

  return status
}
