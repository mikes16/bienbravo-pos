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
  photoPublicId: string | null
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
        id fullName email phone photoUrl photoPublicId isActive hasPosPin
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
      slug
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
          id fullName email phone photoUrl photoPublicId isActive hasPosPin
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
      id fullName email phone photoUrl photoPublicId isActive hasPosPin
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

/**
 * Estado en piso del barbero, derivado de TimeClockEvent + walk-ins/citas
 * actuales. Sirve para la pantalla de selección de perfil:
 *   - en_piso:        clocked-in + sin servicio activo (puede atender)
 *   - en_servicio:    clocked-in + actualmente atendiendo
 *   - fuera_de_turno: no ha marcado entrada hoy
 *
 * El POS lockscreen no bloquea el tap por status — cualquier barbero puede
 * loguearse y luego clockear-in. Solo es info visible.
 */
export type PosBarberStatus = 'en_piso' | 'en_servicio' | 'fuera_de_turno'

const BARBER_STATUSES_QUERY = graphql(`
  query PosBarberStatuses($locationId: ID!) {
    posAvailableBarbers(locationId: $locationId) {
      id
      hasClockedIn
      isOccupied
    }
  }
`)

/* ── Interface ── */

export interface AuthRepository {
  getViewer(): Promise<PosViewer | null>
  getCachedViewer(): PosViewer | null
  revalidateViewer(): Promise<PosViewer | null>
  evictViewerCache(): void
  pinLogin(email: string, pin4: string): Promise<PosViewer>
  logout(): Promise<void>
  getBarbers(locationId: string): Promise<PosStaffUser[]>
  getBarbersFresh(locationId: string): Promise<PosStaffUser[]>
  getBarberStatuses(locationId: string): Promise<Map<string, PosBarberStatus>>
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
    photoPublicId: s.photoPublicId,
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

  /**
   * Lectura sincrónica del viewer desde el InMemoryCache (que está hidratado
   * desde localStorage al boot). Devuelve null si no hay cache válido.
   *
   * Patrón usado por PosAuthProvider para pintar instant la UI mientras
   * `revalidateViewer()` corre en background — evita el blanco de 200-400ms
   * que hace que cada reload se sienta lento.
   */
  getCachedViewer(): PosViewer | null {
    try {
      const cached = this.#client.cache.readQuery<{ viewer: RawViewer }>({
        query: VIEWER_QUERY,
      })
      return cached ? mapViewer(cached.viewer) : null
    } catch {
      return null
    }
  }

  async getViewer(): Promise<PosViewer | null> {
    // cache-first: si ya está en cache (típico tras reload con persistencia),
    // resuelve sin red. La revalidación explícita la hace `revalidateViewer()`.
    const { data } = await this.#client.query<{ viewer: RawViewer }>({
      query: VIEWER_QUERY,
      fetchPolicy: 'cache-first',
    })
    return mapViewer(data!.viewer)
  }

  /**
   * Forza fetch a red ignorando el cache. Usado después de login/logout y por
   * el listener de visibility-change para confirmar que la sesión sigue
   * válida server-side. Re-popula el cache con la respuesta fresca.
   */
  async revalidateViewer(): Promise<PosViewer | null> {
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
        if (code === 'TOO_MANY_REQUESTS') {
          throw new PinLoginException({ code: 'TOO_MANY_REQUESTS' })
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

  /**
   * Cirugía de cache para logout: SOLO evicta el campo `viewer` del root
   * Query. NO purgamos todo el cache (lo hacía antes), porque eso tiraba
   * datos compartidos entre sesiones (catálogo, barberos, locations) que
   * no son privados — el cookie viejo ya es inválido server-side.
   *
   * Resultado: tras logout, la pantalla de selección de barbero pinta
   * instant desde cache, no espera red.
   */
  evictViewerCache(): void {
    this.#client.cache.evict({ fieldName: 'viewer' })
    this.#client.cache.gc()
  }

  async getBarbers(locationId: string): Promise<PosStaffUser[]> {
    // cache-first: el listado de barberos cambia rara vez (admin agrega/baja
    // staff). Pintar instant desde cache → tap → login. La revalidación pasa
    // en background via getBarbersFresh() o cuando vuelva el focus.
    const { data } = await this.#client.query<{ barbers: RawStaff[] }>({
      query: BARBERS_QUERY,
      variables: { locationId },
      fetchPolicy: 'cache-first',
    })
    return data!.barbers.filter((b) => b.isActive).map(mapStaff)
  }

  /**
   * Forza fetch a red del listado de barberos. Llamado por la pantalla de
   * selección on mount (background, no bloquea el primer paint) para que la
   * lista cached muestre el dato fresco en cuanto llegue.
   */
  async getBarbersFresh(locationId: string): Promise<PosStaffUser[]> {
    const { data } = await this.#client.query<{ barbers: RawStaff[] }>({
      query: BARBERS_QUERY,
      variables: { locationId },
      fetchPolicy: 'network-only',
    })
    return data!.barbers.filter((b) => b.isActive).map(mapStaff)
  }

  async getBarberStatuses(locationId: string): Promise<Map<string, PosBarberStatus>> {
    const { data } = await this.#client.query<{
      posAvailableBarbers: { id: string; hasClockedIn: boolean; isOccupied: boolean }[]
    }>({
      query: BARBER_STATUSES_QUERY as never,
      variables: { locationId },
      fetchPolicy: 'network-only',
    })
    // posAvailableBarbers solo devuelve los que tienen actividad hoy
    // (clocked-in en algún momento). Los que no aparecen → fuera_de_turno.
    // El LockPage consume este Map por staff.id; los ausentes se derivan
    // como fuera_de_turno por default.
    const map = new Map<string, PosBarberStatus>()
    for (const b of data?.posAvailableBarbers ?? []) {
      if (!b.hasClockedIn) {
        map.set(b.id, 'fuera_de_turno')
      } else if (b.isOccupied) {
        map.set(b.id, 'en_servicio')
      } else {
        map.set(b.id, 'en_piso')
      }
    }
    return map
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
