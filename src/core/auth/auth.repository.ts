import { type ApolloClient } from '@apollo/client'
import { graphql } from '@/core/graphql/generated'
import {
  type PosViewer,
  type PosStaffUser,
  type PosLocation,
  type LocationScope,
  type PosPinLockoutStatus,
  PinLoginException,
} from './auth.types.ts'

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

function mapStaff(s: {
  id: string
  fullName: string
  email: string
  phone: string | null
  photoUrl: string | null
  isActive: boolean
  hasPosPin: boolean
  pinAttempts: number
  pinLockedUntil: string | null
}): PosStaffUser {
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

function mapViewer(data: {
  kind: string
  staff: Parameters<typeof mapStaff>[0] | null
  permissions: string[]
  locationScopes: { scopeType: string; locationId: string | null }[]
}): PosViewer | null {
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
    const { data } = await this.#client.query<{ viewer: Parameters<typeof mapViewer>[0] }>({
      query: VIEWER_QUERY,
      fetchPolicy: 'network-only',
    })
    return mapViewer(data!.viewer)
  }

  async pinLogin(email: string, pin4: string): Promise<PosViewer> {
    try {
      const { data } = await this.#client.mutate<{
        staffPinLogin: { viewer: Parameters<typeof mapViewer>[0] }
      }>({
        mutation: STAFF_PIN_LOGIN,
        variables: { email, pin4 },
      })
      const viewer = mapViewer(data!.staffPinLogin.viewer)
      if (!viewer) throw new PinLoginException({ code: 'INVALID_CREDENTIALS' })
      return viewer
    } catch (e) {
      const apollo = e as { graphQLErrors?: Array<{ extensions?: Record<string, unknown> }> }
      const ext = apollo.graphQLErrors?.[0]?.extensions
      if (!ext) {
        if (e instanceof PinLoginException) throw e
        throw new PinLoginException({ code: 'UNKNOWN' })
      }
      const code = ext.code as string | undefined
      if (code === 'INVALID_PIN') {
        throw new PinLoginException({
          code: 'INVALID_PIN',
          attemptsRemaining: (ext.attemptsRemaining as number) ?? 0,
        })
      }
      if (code === 'PIN_LOCKED_OUT') {
        throw new PinLoginException({
          code: 'PIN_LOCKED_OUT',
          lockedUntil: new Date(ext.lockedUntil as string),
        })
      }
      throw new PinLoginException({ code: 'UNKNOWN' })
    }
  }

  async logout(): Promise<void> {
    await this.#client.mutate({ mutation: LOGOUT_MUTATION })
  }

  async getBarbers(locationId: string): Promise<PosStaffUser[]> {
    const { data } = await this.#client.query<{ barbers: Parameters<typeof mapStaff>[0][] }>({
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
      fetchPolicy: 'network-only',
    })
    return {
      lockedUntil: data!.posPinLockoutStatus.lockedUntil
        ? new Date(data!.posPinLockoutStatus.lockedUntil)
        : null,
      attemptsRemaining: data!.posPinLockoutStatus.attemptsRemaining,
    }
  }
}
