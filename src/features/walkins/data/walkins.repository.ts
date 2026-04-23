import { type ApolloClient } from '@apollo/client'
import { graphql } from '@/core/graphql/generated'
import type { WalkIn } from '../domain/walkins.types.ts'

const WALKINS_QUERY = graphql(`
  query PosWalkIns($locationId: ID!) {
    walkIns(locationId: $locationId) {
      id status customerName customerPhone customerEmail createdAt
      assignedStaffUser { id fullName }
      customer { id fullName email phone }
    }
  }
`)

const CREATE_WALKIN = graphql(`
  mutation CreateWalkIn($locationId: ID!, $customerName: String, $customerPhone: String, $customerEmail: String) {
    createWalkIn(locationId: $locationId, customerName: $customerName, customerPhone: $customerPhone, customerEmail: $customerEmail) {
      id status customerName customerPhone customerEmail createdAt
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

export interface WalkInsRepository {
  getWalkIns(locationId: string): Promise<WalkIn[]>
  create(locationId: string, customerName: string | null, customerPhone?: string | null, customerEmail?: string | null): Promise<WalkIn>
  assign(walkInId: string, staffUserId: string): Promise<{ walkIn: WalkIn; warning: string | null }>
  complete(walkInId: string): Promise<void>
  drop(walkInId: string, reason?: string | null): Promise<void>
}

export class ApolloWalkInsRepository implements WalkInsRepository {
  #client: ApolloClient
  constructor(client: ApolloClient) {
    this.#client = client
  }

  async getWalkIns(locationId: string): Promise<WalkIn[]> {
    const { data } = await this.#client.query<{ walkIns: WalkIn[] }>({
      query: WALKINS_QUERY,
      variables: { locationId },
      fetchPolicy: 'network-only',
    })
    return data!.walkIns
  }

  async create(locationId: string, customerName: string | null, customerPhone?: string | null, customerEmail?: string | null): Promise<WalkIn> {
    const { data } = await this.#client.mutate<{ createWalkIn: WalkIn }>({
      mutation: CREATE_WALKIN,
      variables: { locationId, customerName, customerPhone: customerPhone ?? null, customerEmail: customerEmail ?? null },
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
}
