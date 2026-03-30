export interface PosStaffUser {
  id: string
  fullName: string
  email: string
  phone: string | null
  photoUrl: string | null
  isActive: boolean
  hasPosPin: boolean
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
