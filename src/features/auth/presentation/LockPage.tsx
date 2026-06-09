import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApolloClient } from '@apollo/client/react'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { useLocation } from '@/core/location/useLocation'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { PinLoginException } from '@/core/auth/auth.types'
import { POS_MY_DAY_EARNINGS, POS_HOME_CAJA_STATUS } from '@/features/home/data/home.queries'
import { LockShell } from './LockShell'
import { PairingView } from './PairingView'
import { BarberSelectorView } from './BarberSelectorView'
import { PinEntryView } from './PinEntryView'
import { LockoutView } from './LockoutView'
import { NoPinMessageView } from './NoPinMessageView'
import { useLockState } from './useLockState'

function todayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function LockPage() {
  const navigate = useNavigate()
  const { auth, agenda, clock, walkins } = useRepositories()
  const { setLocationId, locationName } = useLocation()
  const { pinLogin, isAuthenticated, isLocked } = usePosAuth()
  const { state, setState, actions } = useLockState()
  const apollo = useApolloClient()

  // Per-attempt counter to force PinKeypad remount on each wrong PIN.
  // Without this, PinKeypad keeps its internal `digits` state across attempts.
  const [attemptCount, setAttemptCount] = useState(0)

  // 1) Initial state decision based on viewer + localStorage
  useEffect(() => {
    if (state.kind !== 'INITIAL_LOAD') return
    if (isAuthenticated && !isLocked) {
      navigate('/hoy', { replace: true })
      return
    }
    const storedLocationId = actions.getStoredLocationId()
    if (!storedLocationId) {
      setState({ kind: 'PAIRING', locations: [], loading: true })
      return
    }
    setState({ kind: 'BARBER_SELECTOR', locationId: storedLocationId, barbers: [], statuses: new Map(), loading: true })
  }, [state.kind, isAuthenticated, isLocked, navigate, setState, actions])

  // 2) Fetch locations when entering PAIRING (loading=true)
  const pairingLoading = state.kind === 'PAIRING' ? state.loading : null
  useEffect(() => {
    if (state.kind !== 'PAIRING' || !state.loading) return
    let cancelled = false
    auth
      .getLocations()
      .then((locs) => {
        if (cancelled) return
        setState({ kind: 'PAIRING', locations: locs, loading: false })
      })
      .catch(() => {
        if (cancelled) return
        setState({ kind: 'PAIRING', locations: [], loading: false })
      })
    return () => {
      cancelled = true
    }
    // pairingLoading captures both `kind === 'PAIRING'` and `loading` — avoids
    // re-running when unrelated fields of the union change.
  }, [pairingLoading, auth, setState])

  // 3) Fetch barbers when entering BARBER_SELECTOR (loading=true)
  const barberSelectorLocationId = state.kind === 'BARBER_SELECTOR' ? state.locationId : null
  const barberSelectorLoading = state.kind === 'BARBER_SELECTOR' ? state.loading : null
  const barberSelectorSkipMemory = state.kind === 'BARBER_SELECTOR' ? state.skipMemory ?? false : false
  useEffect(() => {
    if (state.kind !== 'BARBER_SELECTOR' || !state.loading) return
    const locationId = state.locationId
    const skipMemory = state.skipMemory ?? false
    let cancelled = false
    // Pedimos roster + statuses en paralelo. Si statuses falla, no rompemos
    // la pantalla — solo perdemos el badge "en piso/en servicio/fuera de
    // turno" y caemos a un fallback "Activo". Roster sí es crítico.
    Promise.all([
      auth.getBarbers(locationId),
      auth.getBarberStatuses(locationId).catch(() => new Map<string, import('@/core/auth/auth.repository').PosBarberStatus>()),
    ])
      .then(([bs, statuses]) => {
        if (cancelled) return
        if (!skipMemory) {
          const lastBarberId = actions.getLastBarberId()
          if (lastBarberId) {
            const lastBarber = bs.find((b) => b.id === lastBarberId)
            if (lastBarber && lastBarber.hasPosPin) {
              const now = new Date()
              if (lastBarber.pinLockedUntil && lastBarber.pinLockedUntil > now) {
                setState({ kind: 'LOCKED_OUT', locationId, barber: lastBarber, lockedUntil: lastBarber.pinLockedUntil })
                return
              }
              setState({ kind: 'PIN_ENTRY', locationId, barber: lastBarber, error: null })
              return
            }
            actions.forgetLastBarber()
          }
        }
        setState({ kind: 'BARBER_SELECTOR', locationId, barbers: bs, statuses, loading: false })
      })
      .catch(() => {
        if (cancelled) return
        setState({ kind: 'BARBER_SELECTOR', locationId, barbers: [], statuses: new Map(), loading: false })
      })
    // Revalidación silenciosa en background: el render inicial vino del
    // cache (cache-first), así que disparamos un fetch fresco para detectar
    // staff nuevo/dado de baja sin spinner. Si el dispatch resuelve después
    // de que el operador tapeó una card, el siguiente paint refleja el
    // dato fresco — Apollo merge automático en cache.
    void auth.getBarbersFresh(locationId).catch(() => {
      // Tragar errores: la red puede fallar y aún tenemos cards utiles
      // del cache. El siguiente intento de login revalidará.
    })
    return () => {
      cancelled = true
    }
    // barberSelectorLocationId + barberSelectorLoading + barberSelectorSkipMemory fully capture
    // the trigger conditions without re-running when other union members change.
  }, [barberSelectorLocationId, barberSelectorLoading, barberSelectorSkipMemory, auth, setState, actions])

  // Pre-warm de queries de Hoy/MyDay mientras el operador escribe el PIN.
  // Dispara los mismos queries que HoyPage va a pedir (cache-first), así
  // cuando el PIN se confirma y la app navega a /hoy, la data ya está
  // caliente en cache → render instant sin spinner.
  //
  // Cookie validity:
  //   - Lock (no logout): cookie sigue siendo válido → queries succeed,
  //     cache se llena. Caso común: barbero misma sesión sale a comer.
  //   - Logout: cookie es inválido → queries fallan → Apollo no cachea
  //     basura, el flujo normal post-login se encarga. Sin daño.
  //
  // Solo dispara al entrar a PIN_ENTRY (state.kind change). NO re-dispara
  // mientras tipean — Apollo dedupea queries en flight con mismas vars de
  // todas formas, pero esto evita scheduling churn innecesario.
  const pinEntryStaffId = state.kind === 'PIN_ENTRY' ? state.barber.id : null
  const pinEntryLocationId = state.kind === 'PIN_ENTRY' ? state.locationId : null
  useEffect(() => {
    if (!pinEntryStaffId || !pinEntryLocationId) return
    const date = todayISO()
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
    void Promise.allSettled([
      walkins.getWalkIns(pinEntryLocationId),
      agenda.getAppointments(date, date, pinEntryLocationId),
      clock.getEvents(pinEntryStaffId, pinEntryLocationId, date, date),
      apollo.query({
        query: POS_MY_DAY_EARNINGS,
        variables: { staffUserId: pinEntryStaffId, locationId: pinEntryLocationId, date },
        fetchPolicy: 'cache-first',
      }),
      apollo.query({
        query: POS_HOME_CAJA_STATUS,
        variables: { locationId: pinEntryLocationId },
        fetchPolicy: 'cache-first',
      }),
      // MyDay también usa este rango de walkIns con todayStart/todayEnd —
      // distinto cache key que el de Hoy (sin fechas), pero ambos son
      // baratos y los dos pantallas se sienten igual de instant.
      walkins.getWalkIns(pinEntryLocationId, todayStart.toISOString(), todayEnd.toISOString()),
    ])
  }, [pinEntryStaffId, pinEntryLocationId, walkins, agenda, clock, apollo])

  // 4) PIN submit handler
  const handlePinSubmit = useCallback(
    async (pin: string) => {
      if (state.kind !== 'PIN_ENTRY') return
      const barber = state.barber
      const locationId = state.locationId
      try {
        await pinLogin(barber.email, pin)
        actions.rememberLastBarber(barber.id)
        // Navigation happens via the isAuthenticated effect below
      } catch (e) {
        setAttemptCount(c => c + 1)
        if (e instanceof PinLoginException) {
          if (e.detail.code === 'INVALID_PIN') {
            setState({
              kind: 'PIN_ENTRY',
              locationId,
              barber,
              error: `PIN incorrecto · ${e.detail.attemptsRemaining} intentos restantes`,
            })
          } else if (e.detail.code === 'PIN_LOCKED_OUT') {
            setState({ kind: 'LOCKED_OUT', locationId, barber, lockedUntil: e.detail.lockedUntil })
          } else if (e.detail.code === 'TOO_MANY_REQUESTS') {
            setState({
              kind: 'PIN_ENTRY',
              locationId,
              barber,
              error: 'Demasiados intentos. Espera 15 minutos.',
            })
          } else {
            setState({
              kind: 'PIN_ENTRY',
              locationId,
              barber,
              error: 'Sin conexión, vuelve a intentar',
            })
          }
        } else {
          setState({
            kind: 'PIN_ENTRY',
            locationId,
            barber,
            error: 'Sin conexión, vuelve a intentar',
          })
        }
      }
    },
    [state, pinLogin, actions, setState],
  )

  // 5) On successful auth, navigate to home
  useEffect(() => {
    if (isAuthenticated && !isLocked) {
      navigate('/hoy', { replace: true })
    }
  }, [isAuthenticated, isLocked, navigate])

  // 6) Render based on state.kind
  if (state.kind === 'INITIAL_LOAD') {
    return null
  }

  if (state.kind === 'PAIRING') {
    // Pairing también es full-bleed con composición editorial propia
    // (header + sub-headline + grid + footer). El brand mark default del
    // shell competiría con el header interno.
    return (
      <LockShell hideBrand fullBleed>
        <PairingView
          locations={state.locations}
          loading={state.loading}
          onPair={async (locationId, password) => {
            const ok = await auth.verifyLocationAccess(locationId, password)
            if (!ok) return false
            setLocationId(locationId)
            actions.setLocationPaired(locationId)
            setState({ kind: 'BARBER_SELECTOR', locationId, barbers: [], statuses: new Map(), loading: true })
            return true
          }}
        />
      </LockShell>
    )
  }

  if (state.kind === 'BARBER_SELECTOR') {
    // Esta pantalla usa composición editorial propia (eyebrow + headline +
    // roster + footer). El brand mark default del shell sería redundante, y
    // el centrado vertical pelearía con el grid full-bleed.
    return (
      <LockShell hideBrand fullBleed>
        <BarberSelectorView
          barbers={state.barbers}
          statuses={state.statuses}
          loading={state.loading}
          onSelect={(b) => actions.selectBarber(b)}
          onChangeLocation={() => actions.unpair()}
          locationName={locationName}
        />
      </LockShell>
    )
  }

  if (state.kind === 'PIN_ENTRY') {
    // Mismo tratamiento full-bleed que los pasos anteriores — composición
    // editorial propia con header + main + footer.
    return (
      <LockShell hideBrand fullBleed>
        <PinEntryView
          key={`${state.barber.id}-${attemptCount}`}
          staffName={state.barber.fullName}
          photoUrl={state.barber.photoUrl}
          error={state.error}
          onSubmit={handlePinSubmit}
          onBack={() => actions.backToSelector()}
          locationName={locationName}
        />
      </LockShell>
    )
  }

  if (state.kind === 'LOCKED_OUT') {
    return (
      <LockShell>
        <LockoutView
          staffName={state.barber.fullName}
          photoUrl={state.barber.photoUrl}
          lockedUntil={state.lockedUntil}
          onUnlocked={() => {
            setState({ kind: 'PIN_ENTRY', locationId: state.locationId, barber: state.barber, error: null })
          }}
          onBack={() => actions.backToSelector()}
          onPoll={async () => {
            const status = await auth.getPinLockoutStatus(state.barber.email)
            return status.lockedUntil
          }}
        />
      </LockShell>
    )
  }

  if (state.kind === 'NO_PIN_MESSAGE') {
    return (
      <LockShell>
        <NoPinMessageView
          staffName={state.barber.fullName}
          photoUrl={state.barber.photoUrl}
          onBack={() => actions.backToSelector()}
        />
      </LockShell>
    )
  }

  return null
}
