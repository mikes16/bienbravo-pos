import { type ApolloClient } from '@apollo/client'
import { graphql } from '@/core/graphql/generated'
import type { WalkIn } from '../domain/walkins.types.ts'

const WALKINS_QUERY = graphql(`
  query PosWalkIns($locationId: ID!) {
    walkIns(locationId: $locationId) {
      id status customerName customerPhone customerEmail createdAt sortOrder pausedAt
      assignedStaffUser { id fullName }
      customer { id fullName email phone }
      preferredStaffUserId
      preferredStaffUser { id fullName photoUrl }
      requestedService { id name }
      requestedCatalogCombo { id name }
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
      requestedCatalogComboId: $requestedCatalogComboId
      preferredStaffUserId: $preferredStaffUserId
    ) {
      id status customerName customerPhone customerEmail createdAt sortOrder pausedAt
      customer { id fullName email phone }
      requestedService { id name baseDurationMin }
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
  // Pick service OR combo, not both. The API gives combo precedence if both
  // are sent, but the client should keep the contract clean.
  requestedServiceId?: string | null
  requestedCatalogComboId?: string | null
  preferredStaffUserId?: string | null
}

export interface WalkInsRepository {
  getWalkIns(locationId: string): Promise<WalkIn[]>
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

  async getWalkIns(locationId: string): Promise<WalkIn[]> {
    // network-only: the queue mutates on every create / assign / complete /
    // drop, so cache-first kept showing the previous snapshot until the user
    // hard-refreshed. Same fix as getEvents in the clock repository.
    const { data } = await this.#client.query<{ walkIns: WalkIn[] }>({
      query: WALKINS_QUERY,
      variables: { locationId },
      fetchPolicy: 'network-only',
    })
    return data!.walkIns
  }

  async create(input: CreateWalkInInput): Promise<WalkIn> {
    const { data } = await this.#client.mutate<{ createWalkIn: WalkIn }>({
      mutation: CREATE_WALKIN,
      variables: {
        locationId: input.locationId,
        customerId: input.customerId ?? null,
        customerName: input.customerName,
        customerPhone: input.customerPhone ?? null,
        customerEmail: input.customerEmail ?? null,
        requestedServiceId: input.requestedServiceId ?? null,
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
