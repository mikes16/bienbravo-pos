import { useCallback, useEffect, useState } from 'react'
import type { DaySale } from '../domain/day-sales.types'

/**
 * Reimpresión de un ticket ya cobrado. `ReprintTicketHost` monta el
 * `PrintableTicket` (oculto en pantalla, visible solo en @media print) de la
 * venta pedida; este hook dispara `window.print()` en el siguiente frame —
 * cuando el DOM ya lo pintó — y lo desmonta al terminar (`afterprint`). Solo
 * hay un ticket imprimible montado a la vez: el CSS de print muestra TODO
 * `.bb-print-receipt`.
 */
export function useReprintTicket() {
  const [target, setTarget] = useState<DaySale | null>(null)

  useEffect(() => {
    if (!target) return
    const onAfterPrint = () => setTarget(null)
    window.addEventListener('afterprint', onAfterPrint)
    const raf = window.requestAnimationFrame(() => window.print())
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [target])

  const requestPrint = useCallback((sale: DaySale) => setTarget(sale), [])
  return { printTarget: target, requestPrint }
}
