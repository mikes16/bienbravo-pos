export interface PosStaffUser {
  id: string
  fullName: string
  email: string
  phone: string | null
  photoUrl: string | null
  isActive: boolean
  hasPosPin: boolean
  pinAttempts: number
  pinLockedUntil: Date | null
}

export interface PosPinLockoutStatus {
  lockedUntil: Date | null
  attemptsRemaining: number
}

export type PinLoginError =
  | { code: 'INVALID_PIN'; attemptsRemaining: number }
  | { code: 'PIN_LOCKED_OUT'; lockedUntil: Date }
  | { code: 'INVALID_CREDENTIALS' }
  | { code: 'TOO_MANY_REQUESTS' }
  | { code: 'UNKNOWN' }

export class PinLoginException extends Error {
  readonly detail: PinLoginError
  constructor(detail: PinLoginError) {
    super(detail.code)
    this.detail = detail
    this.name = 'PinLoginException'
  }
}

export interface PosLocation {
  id: string
  name: string
}

export interface LocationScope {
  scopeType: 'GLOBAL' | 'LOCATION' | 'SELF'
  locationId: string | null
}

export interface PosViewer {
  kind: 'STAFF'
  staff: PosStaffUser
  permissions: string[]
  locationScopes: LocationScope[]
}

export interface PinLoginInput {
  email: string
  pin4: string
}

export interface AuthState {
  viewer: PosViewer | null
  isAuthenticated: boolean
  isLocked: boolean
  loading: boolean
}
