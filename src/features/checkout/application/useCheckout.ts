import { useState, useCallback } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import type { PaymentMethod, SaleResult, SaleItemInput } from '../domain/checkout.types.ts'

interface UseCheckoutOptions {
  locationId: string
  registerSessionId: string | null
  staffUserId: string | null
  customerId: string | null
  completeWalkInId?: string | null
  completeAppointmentId?: string | null
}

export function useCheckout({
  locationId,
  registerSessionId,
  staffUserId,
  customerId,
  completeWalkInId,
  completeAppointmentId,
}: UseCheckoutOptions) {
  const { checkout } = useRepositories()
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SaleResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (items: SaleItemInput[], tipCents: number, paymentMethod: PaymentMethod) => {
      setSubmitting(true)
      setError(null)
      try {
        const sale = await checkout.createSale({
          locationId,
          registerSessionId,
          customerId,
          staffUserId,
          completeWalkInId: completeWalkInId ?? null,
          completeAppointmentId: completeAppointmentId ?? null,
          items,
          tipCents,
          paymentMethod,
        })
        setResult(sale)
        return sale
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al procesar la venta'
        setError(msg)
        return null
      } finally {
        setSubmitting(false)
      }
    },
    [checkout, locationId, registerSessionId, customerId, staffUserId, completeWalkInId, completeAppointmentId],
  )

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { submit, submitting, result, error, reset }
}
