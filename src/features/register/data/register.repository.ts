import { type ApolloClient } from '@apollo/client'
import { graphql } from '@/core/graphql/generated'
import type { Register, RegisterSession, CloseSessionInput } from '../domain/register.types.ts'

const REGISTERS_QUERY = graphql(`
  query PosRegisters($locationId: ID!) {
    registers(locationId: $locationId) {
      id name isActive locationId
      openSession { id status openedAt expectedCashCents expectedCardCents expectedTransferCents }
    }
  }
`)

const OPEN_SESSION = graphql(`
  mutation OpenRegisterSession($registerId: ID!, $openingCashCents: Int) {
    openRegisterSession(registerId: $registerId, openingCashCents: $openingCashCents) {
      id status openedAt expectedCashCents expectedCardCents expectedTransferCents
    }
  }
`)

const CLOSE_SESSION = graphql(`
  mutation CloseRegisterSession($input: CloseRegisterSessionInput!) {
    closeRegisterSession(input: $input) {
      id status closedAt
      countedCashCents countedCardCents countedTransferCents
      expectedCashCents expectedCardCents expectedTransferCents
    }
  }
`)

export interface RegisterRepository {
  getRegisters(locationId: string): Promise<Register[]>
  openSession(registerId: string, openingCashCents: number): Promise<RegisterSession>
  closeSession(input: CloseSessionInput): Promise<RegisterSession>
}

export class ApolloRegisterRepository implements RegisterRepository {
  #client: ApolloClient
  constructor(client: ApolloClient) {
    this.#client = client
  }

  async getRegisters(locationId: string): Promise<Register[]> {
    const { data } = await this.#client.query<{ registers: Register[] }>({
      query: REGISTERS_QUERY,
      variables: { locationId },
      fetchPolicy: 'cache-first',
    })
    return data!.registers.filter((r: Register) => r.isActive)
  }

  async openSession(registerId: string, openingCashCents: number): Promise<RegisterSession> {
    const { data } = await this.#client.mutate<{ openRegisterSession: RegisterSession }>({
      mutation: OPEN_SESSION,
      variables: { registerId, openingCashCents },
    })
    return data!.openRegisterSession
  }

  async closeSession(input: CloseSessionInput): Promise<RegisterSession> {
    const { data } = await this.#client.mutate<{ closeRegisterSession: RegisterSession }>({
      mutation: CLOSE_SESSION,
      variables: { input },
    })
    return data!.closeRegisterSession
  }
}
