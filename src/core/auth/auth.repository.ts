import { type ApolloClient } from '@apollo/client'
import { graphql } from '@/core/graphql/generated'
import type { PosViewer, PosStaffUser, PosLocation, LocationScope } from './auth.types.ts'

/* ── GraphQL Documents ── */

const VIEWER_QUERY = graphql(`
  query PosViewer {
    viewer {
      kind
      staff { id fullName email phone photoUrl isActive hasPosPin }
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
        staff { id fullName email phone photoUrl isActive hasPosPin }
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
}

/* ── Apollo Implementation ── */

function mapViewer(data: {
  kind: string
  staff: PosStaffUser | null
  permissions: string[]
  locationScopes: { scopeType: string; locationId: string | null }[]
}): PosViewer | null {
  if (data.kind !== 'STAFF' || !data.staff) return null
  return {
    kind: 'STAFF',
    staff: data.staff,
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
    const { data } = await this.#client.mutate<{
      staffPinLogin: { viewer: Parameters<typeof mapViewer>[0] }
    }>({
      mutation: STAFF_PIN_LOGIN,
      variables: { email, pin4 },
    })
    const viewer = mapViewer(data!.staffPinLogin.viewer)
    if (!viewer) throw new Error('Credenciales inválidas')
    return viewer
  }

  async logout(): Promise<void> {
    await this.#client.mutate({ mutation: LOGOUT_MUTATION })
  }

  async getBarbers(locationId: string): Promise<PosStaffUser[]> {
    const { data } = await this.#client.query<{ barbers: PosStaffUser[] }>({
      query: BARBERS_QUERY,
      variables: { locationId },
      fetchPolicy: 'network-only',
    })
    return data!.barbers.filter((b: PosStaffUser) => b.isActive)
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
}
