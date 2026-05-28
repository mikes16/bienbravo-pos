import { type ApolloClient } from '@apollo/client'
import { graphql } from '@/core/graphql/generated'
import type { WalkIn } from '../domain/walkins.types.ts'

const WALKINS_QUERY = graphql(`
  query PosWalkIns($locationId: ID!, $fromDate: String, $toDate: String) {
    walkIns(locationId: $locationId, fromDate: $fromDate, toDate: $toDate) {
      id status customerName customerPhone customerEmail createdAt assignedAt sortOrder pausedAt
      assignedStaffUser { id fullName }
      customer { id fullName email phone }
      preferredStaffUserId
      preferredStaffUser { id fullName photoUrl }
      requestedService { id name }
      requestedServices { id name baseDurationMin }
      requestedCatalogCombo { id name }
      sale { id totalCents }
    }
  }
`)

const CREATE_WALKIN = graphql(`
  mutation CreateWalkIn(
    $locationId: ID!
    $customerId: ID
    $customerName: String
    $customerPhone: String
    $customerEmail: String
    $requestedServiceId: ID
    $requestedServiceIds: [ID!]
    $requestedCatalogComboId: ID
    $preferredStaffUserId: ID
  ) {
    createWalkIn(
      locationId: $locationId
      customerId: $customerId
      customerName: $customerName
      customerPhone: $customerPhone
      customerEmail: $customerEmail
      requestedServiceId: $requestedServiceId
      requestedServiceIds: $requestedServiceIds
      requestedCatalogComboId: $requestedCatalogComboId
      preferredStaffUserId: $preferredStaffUserId
    ) {
      id status customerName customerPhone customerEmail createdAt sortOrder pausedAt
      customer { id fullName email phone }
      requestedService { id name baseDurationMin }
      requestedServices { id name baseDurationMin }
      requestedCatalogCombo { id name }
      preferredStaffUserId
      preferredStaffUser { id fullName photoUrl }
    }
  }
`)

const ASSIGN_WALKIN = graphql(`
  mutation AssignWalkIn($walkInId: ID!, $staffUserId: ID!) {
    assignWalkIn(walkInId: $walkInId, staffUserId: $staffUserId) {
      walkIn { id status assignedStaffUser { id fullName } }
      warning
    }
  }
`)

const COMPLETE_WALKIN = graphql(`
  mutation CompleteWalkIn($walkInId: ID!) {
    completeWalkIn(walkInId: $walkInId)
  }
`)

const DROP_WALKIN = graphql(`
  mutation DropWalkIn($walkInId: ID!, $reason: String) { dropWalkIn(walkInId: $walkInId, reason: $reason) }
`)

export const PAUSE_WALKIN_MUTATION = graphql(`
  mutation PauseWalkIn($walkInId: ID!) {
    pauseWalkIn(walkInId: $walkInId) {
      id
      pausedAt
    }
  }
`)

export const RESUME_WALKIN_MUTATION = graphql(`
  mutation ResumeWalkIn($walkInId: ID!) {
    resumeWalkIn(walkInId: $walkInId) {
      id
      pausedAt
    }
  }
`)

export const MARK_WALKIN_NO_SHOW_MUTATION = graphql(`
  mutation MarkWalkInNoShow($walkInId: ID!) {
    markWalkInNoShow(walkInId: $walkInId) {
      id
      status
    }
  }
`)

export const REORDER_WALKINS_MUTATION = graphql(`
  mutation ReorderWalkIns($input: ReorderWalkInsInput!) {
    reorderWalkIns(input: $input) {
      id
      sortOrder
    }
  }
`)

export const SUGGESTED_NEXT_WALKIN_QUERY = graphql(`
  query SuggestedNextWalkIn($input: SuggestedNextWalkInInput!) {
    suggestedNextWalkIn(input: $input) {
      id
      status
      customerName
      customer { id fullName }
      requestedService { id name }
      requestedServices { id name baseDurationMin }
      requestedCatalogCombo { id name }
      preferredStaffUserId
      preferredStaffUser { id fullName photoUrl }
      pausedAt
      sortOrder
      createdAt
    }
  }
`)

export interface CreateWalkInInput {
  locationId: string
  customerId?: string | null
  customerName: string | null
  customerPhone?: string | null
  customerEmail?: string | null
  // Pick N services OR un combo, never both. El API da precedencia al
  // combo si vienen ambos; el client mantiene el contrato limpio.
  requestedServiceId?: string | null
  requestedServiceIds?: string[] | null
  requestedCatalogComboId?: string | null
  preferredStaffUserId?: string | null
}

export interface WalkInsRepository {
  /**
   * Lista walk-ins de la sucursal. fromDate/toDate filtran por createdAt
   * (ISO 8601). Si se omiten, devuelve todo el histórico — el caso del
   * HoyPage que necesita ver todos los pending/assigned. MyDayPage pasa
   * el rango del día para evitar walk-ins viejos.
   */
  getWalkIns(locationId: string, fromDate?: string, toDate?: string): Promise<WalkIn[]>
  create(input: CreateWalkInInput): Promise<WalkIn>
  assign(walkInId: string, staffUserId: string): Promise<{ walkIn: WalkIn; warning: string | null }>
  complete(walkInId: string): Promise<void>
  drop(walkInId: string, reason?: string | null): Promise<void>
  pauseWalkIn(walkInId: string): Promise<{ id: string; pausedAt?: string | null } | null>
  resumeWalkIn(walkInId: string): Promise<{ id: string; pausedAt?: string | null } | null>
  markWalkInNoShow(walkInId: string): Promise<{ id: string; status: string } | null>
  reorderWalkIns(input: { locationId: string; orderedIds: string[] }): Promise<Array<{ id: string; sortOrder: number }> | null>
  suggestedNextWalkIn(input: { locationId: string; staffUserId: string }): Promise<WalkIn | null>
}

export class ApolloWalkInsRepository implements WalkInsRepository {
  #client: ApolloClient
  constructor(client: ApolloClient) {
    this.#client = client
  }

  async getWalkIns(locationId: string, fromDate?: string, toDate?: string): Promise<WalkIn[]> {
    // network-only: the queue mutates on every create / assign / complete /
    // drop, so cache-first kept showing the previous snapshot until the user
    // hard-refreshed. Same fix as getEvents in the clock repository.
    const { data } = await this.#client.query<{ walkIns: WalkIn[] }>({
      query: WALKINS_QUERY as never,
      variables: { locationId, fromDate: fromDate ?? null, toDate: toDate ?? null },
      fetchPolicy: 'network-only',
    })
    return data!.walkIns
  }

  async create(input: CreateWalkInInput): Promise<WalkIn> {
    const { data } = await this.#client.mutate<{ createWalkIn: WalkIn }>({
      mutation: CREATE_WALKIN as never,
      variables: {
        locationId: input.locationId,
        customerId: input.customerId ?? null,
        customerName: input.customerName,
        customerPhone: input.customerPhone ?? null,
        customerEmail: input.customerEmail ?? null,
        requestedServiceId: input.requestedServiceId ?? null,
        requestedServiceIds: input.requestedServiceIds ?? null,
        requestedCatalogComboId: input.requestedCatalogComboId ?? null,
        preferredStaffUserId: input.preferredStaffUserId ?? null,
      },
    })
    return data!.createWalkIn
  }

  async assign(walkInId: string, staffUserId: string): Promise<{ walkIn: WalkIn; warning: string | null }> {
    const { data } = await this.#client.mutate<{
      assignWalkIn: { walkIn: WalkIn; warning: string | null }
    }>({
      mutation: ASSIGN_WALKIN,
      variables: { walkInId, staffUserId },
    })
    return data!.assignWalkIn
  }

  async complete(walkInId: string): Promise<void> {
    await this.#client.mutate({ mutation: COMPLETE_WALKIN, variables: { walkInId } })
  }

  async drop(walkInId: string, reason?: string | null): Promise<void> {
    await this.#client.mutate({ mutation: DROP_WALKIN, variables: { walkInId, reason: reason ?? null } })
  }

  async pauseWalkIn(walkInId: string) {
    const r = await this.#client.mutate({ mutation: PAUSE_WALKIN_MUTATION, variables: { walkInId } })
    return r.data?.pauseWalkIn ?? null
  }

  async resumeWalkIn(walkInId: string) {
    const r = await this.#client.mutate({ mutation: RESUME_WALKIN_MUTATION, variables: { walkInId } })
    return r.data?.resumeWalkIn ?? null
  }

  async markWalkInNoShow(walkInId: string) {
    const r = await this.#client.mutate({ mutation: MARK_WALKIN_NO_SHOW_MUTATION, variables: { walkInId } })
    return r.data?.markWalkInNoShow ?? null
  }

  async reorderWalkIns(input: { locationId: string; orderedIds: string[] }) {
    const r = await this.#client.mutate({ mutation: REORDER_WALKINS_MUTATION, variables: { input } })
    return r.data?.reorderWalkIns ?? null
  }

  async suggestedNextWalkIn(input: { locationId: string; staffUserId: string }): Promise<WalkIn | null> {
    const r = await this.#client.query({
      query: SUGGESTED_NEXT_WALKIN_QUERY,
      variables: { input },
      fetchPolicy: 'network-only',
    })
    // Cast: el query selecciona el subset de campos que el caller realmente
    // usa. Apollo devuelve esos campos materializados; el opcional/undefined
    // que infiere codegen es overly conservative.
    return (r.data?.suggestedNextWalkIn ?? null) as WalkIn | null
  }
}
