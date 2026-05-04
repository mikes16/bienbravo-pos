import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { useLocation } from '@/core/location/useLocation'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { PinLoginException } from '@/core/auth/auth.types'
import { LockShell } from './LockShell'
import { PairingView } from './PairingView'
import { BarberSelectorView } from './BarberSelectorView'
import { PinEntryView } from './PinEntryView'
import { LockoutView } from './LockoutView'
import { NoPinMessageView } from './NoPinMessageView'
import { useLockState } from './useLockState'

export function LockPage() {
  const navigate = useNavigate()
  const { auth } = useRepositories()
  const { setLocationId } = useLocation()
  const { pinLogin, isAuthenticated, isLocked } = usePosAuth()
  const { state, setState, actions } = useLockState()

  // Per-attempt counter to force PinKeypad remount on each wrong PIN.
  // Without this, PinKeypad keeps its internal `digits` state across attempts.
  const [attemptCount, setAttemptCount] = useState(0)

  // 1) Initial state decision based on viewer + localStorage
  useEffect(() => {
    if (state.kind !== 'INITIAL_LOAD') return
    if (isAuthenticated && !isLocked) {
      navigate('/home', { replace: true })
      return
    }
    const storedLocationId = actions.getStoredLocationId()
    if (!storedLocationId) {
      setState({ kind: 'PAIRING', locations: [], loading: true })
      return
    }
    setState({ kind: 'BARBER_SELECTOR', locationId: storedLocationId, barbers: [], loading: true })
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
    auth
      .getBarbers(locationId)
      .then((bs) => {
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
        setState({ kind: 'BARBER_SELECTOR', locationId, barbers: bs, loading: false })
      })
      .catch(() => {
        if (cancelled) return
        setState({ kind: 'BARBER_SELECTOR', locationId, barbers: [], loading: false })
      })
    return () => {
      cancelled = true
    }
    // barberSelectorLocationId + barberSelectorLoading + barberSelectorSkipMemory fully capture
    // the trigger conditions without re-running when other union members change.
  }, [barberSelectorLocationId, barberSelectorLoading, barberSelectorSkipMemory, auth, setState, actions])

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
      navigate('/home', { replace: true })
    }
  }, [isAuthenticated, isLocked, navigate])

  // 6) Render based on state.kind
  if (state.kind === 'INITIAL_LOAD') {
    return null
  }

  if (state.kind === 'PAIRING') {
    return (
      <LockShell>
        <PairingView
          locations={state.locations}
          loading={state.loading}
          onPair={async (locationId, password) => {
            const ok = await auth.verifyLocationAccess(locationId, password)
            if (!ok) return false
            setLocationId(locationId)
            actions.setLocationPaired(locationId)
            setState({ kind: 'BARBER_SELECTOR', locationId, barbers: [], loading: true })
            return true
          }}
        />
      </LockShell>
    )
  }

  if (state.kind === 'BARBER_SELECTOR') {
    return (
      <LockShell>
        <BarberSelectorView
          barbers={state.barbers}
          loading={state.loading}
          onSelect={(b) => actions.selectBarber(b)}
          onChangeLocation={() => actions.unpair()}
        />
      </LockShell>
    )
  }

  if (state.kind === 'PIN_ENTRY') {
    return (
      <LockShell>
        <PinEntryView
          key={`${state.barber.id}-${attemptCount}`}
          staffName={state.barber.fullName}
          photoUrl={state.barber.photoUrl}
          error={state.error}
          onSubmit={handlePinSubmit}
          onBack={() => actions.backToSelector()}
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
