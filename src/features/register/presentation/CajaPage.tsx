import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocation } from '@/core/location/useLocation'
import { useRegister } from '../application/useRegister'
import { CajaClosedView } from './CajaClosedView'
import { CajaOpenView } from './CajaOpenView'

// TODO: derive fondoCents from session metadata (the API doesn't expose
// opening fondo as a discrete field today). For Sub-#3 v1 we use a placeholder;
// post-merge follow-up: compute as session.expectedCashCents - sum(cash sales).
const FONDO_PLACEHOLDER_CENTS = 50000

export function CajaPage() {
  const navigate = useNavigate()
  const { locationId } = useLocation()
  const { registers, loading, refresh } = useRegister(locationId)

  // Refetch on focus (consistent with sub-#2 D pattern)
  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const openRegister = useMemo(
    () => registers.find((r) => r.openSession),
    [registers],
  )

  const handleAbrir = (registerId: string) => {
    navigate(`/caja/abrir?reg=${registerId}`)
  }

  const handleCerrar = () => {
    navigate('/caja/cerrar')
  }

  if (loading && registers.length === 0) return null

  if (openRegister?.openSession) {
    return (
      <CajaOpenView
        session={openRegister.openSession}
        todayTransactions={[]}
        fondoCents={FONDO_PLACEHOLDER_CENTS}
        onCerrar={handleCerrar}
      />
    )
  }

  return <CajaClosedView registers={registers} onAbrir={handleAbrir} />
}
