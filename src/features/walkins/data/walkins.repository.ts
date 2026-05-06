import { type ApolloClient, gql } from '@apollo/client'
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

// Use gql() at runtime because we extended the mutation to take an optional
// customerId — codegen hasn't regenerated against the new shape, so the typed
// graphql() tag would fail to resolve. Migrate back to graphql() after the next
// sync-schema + codegen run.
const CREATE_WALKIN = gql`
  mutation CreateWalkIn(
    $locationId: ID!
    $customerId: ID
    $customerName: String
    $customerPhone: String
    $customerEmail: String
  ) {
    createWalkIn(
      locationId: $locationId
      customerId: $customerId
      customerName: $customerName
      customerPhone: $customerPhone
      customerEmail: $customerEmail
    ) {
      id status customerName customerPhone customerEmail createdAt
      customer { id fullName email phone }
    }
  }
`

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

export interface CreateWalkInInput {
  locationId: string
  customerId?: string | null
  customerName: string | null
  customerPhone?: string | null
  customerEmail?: string | null
}

export interface WalkInsRepository {
  getWalkIns(locationId: string): Promise<WalkIn[]>
  create(input: CreateWalkInInput): Promise<WalkIn>
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
}
