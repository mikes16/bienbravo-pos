import { type ApolloClient } from '@apollo/client'
import { CombinedGraphQLErrors } from '@apollo/client/errors'
import { graphql } from '@/core/graphql/generated'
import {
  type PosViewer,
  type PosStaffUser,
  type PosLocation,
  type LocationScope,
  type PosPinLockoutStatus,
  PinLoginException,
} from './auth.types.ts'

/* ── Raw API shapes ── */

type RawStaff = {
  id: string; fullName: string; email: string
  phone: string | null; photoUrl: string | null
  isActive: boolean; hasPosPin: boolean
  pinAttempts: number; pinLockedUntil: string | null
}

type RawViewer = {
  kind: string; staff: RawStaff | null
  permissions: string[]
  locationScopes: { scopeType: string; locationId: string | null }[]
}

/* ── GraphQL Documents ── */

const VIEWER_QUERY = graphql(`
  query PosViewer {
    viewer {
      kind
      staff {
        id fullName email phone photoUrl isActive hasPosPin
        pinAttempts pinLockedUntil
      }
      permissions
      locationScopes { scopeType locationId }
    }
  }
`)

const LOCATIONS_QUERY = graphql(`
  query PosPublicLocations {
    posPublicLocations {
      id
      name
    }
  }
`)

const VERIFY_POS_LOCATION_ACCESS = graphql(`
  mutation VerifyPosLocationAccess($locationId: ID!, $password: String!) {
    verifyPosLocationAccess(locationId: $locationId, password: $password)
  }
`)

const STAFF_PIN_LOGIN = graphql(`
  mutation StaffPinLogin($email: String!, $pin4: String!) {
    staffPinLogin(email: $email, pin4: $pin4) {
      viewer {
        kind
        staff {
          id fullName email phone photoUrl isActive hasPosPin
          pinAttempts pinLockedUntil
        }
        permissions
        locationScopes { scopeType locationId }
      }
    }
  }
`)

const BARBERS_QUERY = graphql(`
  query PosBarbers($locationId: ID!) {
    barbers(locationId: $locationId) {
      id fullName email phone photoUrl isActive hasPosPin
      pinAttempts pinLockedUntil
    }
  }
`)

const POS_PIN_LOCKOUT_STATUS = graphql(`
  query PosPinLockoutStatus($email: String!) {
    posPinLockoutStatus(email: $email) {
      lockedUntil
      attemptsRemaining
    }
  }
`)

const LOGOUT_MUTATION = graphql(`
  mutation PosLogout { logout }
`)

/* ── Interface ── */

export interface AuthRepository {
  getViewer(): Promise<PosViewer | null>
  pinLogin(email: string, pin4: string): Promise<PosViewer>
  logout(): Promise<void>
  getBarbers(locationId: string): Promise<PosStaffUser[]>
  getLocations(): Promise<PosLocation[]>
  verifyLocationAccess(locationId: string, password: string): Promise<boolean>
  getPinLockoutStatus(email: string): Promise<PosPinLockoutStatus>
}

/* ── Apollo Implementation ── */

function mapStaff(s: RawStaff): PosStaffUser {
  return {
    id: s.id,
    fullName: s.fullName,
    email: s.email,
    phone: s.phone,
    photoUrl: s.photoUrl,
    isActive: s.isActive,
    hasPosPin: s.hasPosPin,
    pinAttempts: s.pinAttempts,
    pinLockedUntil: s.pinLockedUntil ? new Date(s.pinLockedUntil) : null,
  }
}

function mapViewer(data: RawViewer): PosViewer | null {
  if (data.kind !== 'STAFF' || !data.staff) return null
  return {
    kind: 'STAFF',
    staff: mapStaff(data.staff),
    permissions: data.permissions ?? [],
    locationScopes: (data.locationScopes ?? []).map((s) => ({
      scopeType: s.scopeType as LocationScope['scopeType'],
      locationId: s.locationId,
    })),
  }
}

export class ApolloAuthRepository implements AuthRepository {
  #client: ApolloClient
  constructor(client: ApolloClient) {
    this.#client = client
  }

  async getViewer(): Promise<PosViewer | null> {
    const { data } = await this.#client.query<{ viewer: RawViewer }>({
      query: VIEWER_QUERY,
      fetchPolicy: 'network-only',
    })
    return mapViewer(data!.viewer)
  }

  async pinLogin(email: string, pin4: string): Promise<PosViewer> {
    let result
    try {
      result = await this.#client.mutate<{
        staffPinLogin: { viewer: RawViewer }
      }>({
        mutation: STAFF_PIN_LOGIN,
        variables: { email, pin4 },
      })
    } catch (e) {
      if (CombinedGraphQLErrors.is(e)) {
        const ext = e.errors[0]?.extensions
        const code = typeof ext?.code === 'string' ? ext.code : undefined
        if (code === 'INVALID_PIN') {
          const attemptsRemaining = typeof ext?.attemptsRemaining === 'number' ? ext.attemptsRemaining : 0
          throw new PinLoginException({ code: 'INVALID_PIN', attemptsRemaining })
        }
        if (code === 'PIN_LOCKED_OUT') {
          const lockedUntil = typeof ext?.lockedUntil === 'string' ? new Date(ext.lockedUntil) : new Date()
          throw new PinLoginException({ code: 'PIN_LOCKED_OUT', lockedUntil })
        }
      }
      throw new PinLoginException({ code: 'UNKNOWN' })
    }
    const viewer = mapViewer(result.data!.staffPinLogin.viewer)
    if (!viewer) throw new PinLoginException({ code: 'INVALID_CREDENTIALS' })
    return viewer
  }

  async logout(): Promise<void> {
    await this.#client.mutate({ mutation: LOGOUT_MUTATION })
  }

  async getBarbers(locationId: string): Promise<PosStaffUser[]> {
    const { data } = await this.#client.query<{ barbers: RawStaff[] }>({
      query: BARBERS_QUERY,
      variables: { locationId },
      fetchPolicy: 'network-only',
    })
    return data!.barbers.filter((b) => b.isActive).map(mapStaff)
  }

  async getLocations(): Promise<PosLocation[]> {
    const { data } = await this.#client.query<{ posPublicLocations: PosLocation[] }>({
      query: LOCATIONS_QUERY,
      fetchPolicy: 'network-only',
    })
    return data!.posPublicLocations
  }

  async verifyLocationAccess(locationId: string, password: string): Promise<boolean> {
    const { data } = await this.#client.mutate<{ verifyPosLocationAccess: boolean }>({
      mutation: VERIFY_POS_LOCATION_ACCESS,
      variables: { locationId, password },
    })
    return data!.verifyPosLocationAccess
  }

  async getPinLockoutStatus(email: string): Promise<PosPinLockoutStatus> {
    const { data } = await this.#client.query<{
      posPinLockoutStatus: { lockedUntil: string | null; attemptsRemaining: number }
    }>({
      query: POS_PIN_LOCKOUT_STATUS,
      variables: { email },
      fetchPolicy: 'no-cache',
    })
    return {
      lockedUntil: data!.posPinLockoutStatus.lockedUntil
        ? new Date(data!.posPinLockoutStatus.lockedUntil)
        : null,
      attemptsRemaining: data!.posPinLockoutStatus.attemptsRemaining,
    }
  }
}
