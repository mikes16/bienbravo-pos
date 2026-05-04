import { useState, useCallback } from 'react'
import type { PosStaffUser, PosLocation } from '@/core/auth/auth.types'

const KEY_LOCATION = 'bb-pos-location-id'
const KEY_LAST_BARBER = 'bb-pos-last-barber-id'

export type LockState =
  | { kind: 'INITIAL_LOAD' }
  | { kind: 'PAIRING'; locations: PosLocation[]; loading: boolean }
  | { kind: 'BARBER_SELECTOR'; locationId: string; barbers: PosStaffUser[]; loading: boolean }
  | { kind: 'PIN_ENTRY'; locationId: string; barber: PosStaffUser; error: string | null }
  | { kind: 'LOCKED_OUT'; locationId: string; barber: PosStaffUser; lockedUntil: Date }
  | { kind: 'NO_PIN_MESSAGE'; locationId: string; barber: PosStaffUser }

export interface LockStateActions {
  setLocationPaired: (locationId: string) => void
  selectBarber: (barber: PosStaffUser) => void
  backToSelector: () => void
  unpair: () => void
  rememberLastBarber: (barberId: string) => void
  forgetLastBarber: () => void
  getLastBarberId: () => string | null
  getStoredLocationId: () => string | null
}

export function useLockState(initial: LockState = { kind: 'INITIAL_LOAD' }) {
  const [state, setState] = useState<LockState>(initial)

  const getStoredLocationId = useCallback((): string | null => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(KEY_LOCATION)
  }, [])

  const getLastBarberId = useCallback((): string | null => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(KEY_LAST_BARBER)
  }, [])

  const setLocationPaired = useCallback((locationId: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(KEY_LOCATION, locationId)
    }
  }, [])

  const unpair = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(KEY_LOCATION)
      window.localStorage.removeItem(KEY_LAST_BARBER)
    }
    setState({ kind: 'PAIRING', locations: [], loading: true })
  }, [])

  const rememberLastBarber = useCallback((barberId: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(KEY_LAST_BARBER, barberId)
    }
  }, [])

  const forgetLastBarber = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(KEY_LAST_BARBER)
    }
  }, [])

  const selectBarber = useCallback((barber: PosStaffUser) => {
    setState((prev) => {
      if (
        prev.kind !== 'BARBER_SELECTOR' &&
        prev.kind !== 'PIN_ENTRY' &&
        prev.kind !== 'LOCKED_OUT' &&
        prev.kind !== 'NO_PIN_MESSAGE'
      ) {
        return prev
      }
      const locationId = 'locationId' in prev ? prev.locationId : ''
      if (!barber.hasPosPin) {
        return { kind: 'NO_PIN_MESSAGE', locationId, barber }
      }
      const now = new Date()
      if (barber.pinLockedUntil && barber.pinLockedUntil > now) {
        return { kind: 'LOCKED_OUT', locationId, barber, lockedUntil: barber.pinLockedUntil }
      }
      return { kind: 'PIN_ENTRY', locationId, barber, error: null }
    })
  }, [])

  const backToSelector = useCallback(() => {
    setState((prev) => {
      const locationId = 'locationId' in prev ? prev.locationId : ''
      return { kind: 'BARBER_SELECTOR', locationId, barbers: [], loading: true }
    })
  }, [])

  return {
    state,
    setState,
    actions: {
      setLocationPaired,
      selectBarber,
      backToSelector,
      unpair,
      rememberLastBarber,
      forgetLastBarber,
      getLastBarberId,
      getStoredLocationId,
    } satisfies LockStateActions,
  }
}
