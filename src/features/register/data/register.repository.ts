import { gql, type ApolloClient } from '@apollo/client'
import type { Register, RegisterSession, CloseSessionInput } from '../domain/register.types.ts'

const REGISTERS_QUERY = gql`
  query PosRegisters($locationId: ID!) {
    registers(locationId: $locationId) {
      id name isActive locationId
      openSession { id status openedAt expectedCashCents expectedCardCents expectedTransferCents }
    }
  }
`

const OPEN_SESSION = gql`
  mutation OpenRegisterSession($registerId: ID!) {
    openRegisterSession(registerId: $registerId) {
      id status openedAt expectedCashCents expectedCardCents expectedTransferCents
    }
  }
`

const CLOSE_SESSION = gql`
  mutation CloseRegisterSession($input: CloseRegisterSessionInput!) {
    closeRegisterSession(input: $input) {
      id status closedAt
      countedCashCents countedCardCents countedTransferCents
      expectedCashCents expectedCardCents expectedTransferCents
    }
  }
`

export interface RegisterRepository {
  getRegisters(locationId: string): Promise<Register[]>
  openSession(registerId: string): Promise<RegisterSession>
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
      fetchPolicy: 'network-only',
    })
    return data!.registers.filter((r: Register) => r.isActive)
  }

  async openSession(registerId: string): Promise<RegisterSession> {
    const { data } = await this.#client.mutate<{ openRegisterSession: RegisterSession }>({
      mutation: OPEN_SESSION,
      variables: { registerId },
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
