import { type ApolloClient } from '@apollo/client'
import { graphql } from '@/core/graphql/generated'
import type { Register, RegisterSession, CloseSessionInput } from '../domain/register.types.ts'

const REGISTERS_QUERY = graphql(`
  query PosRegisters($locationId: ID!) {
    registers(locationId: $locationId) {
      id name isActive locationId
      openSession {
        id status openedAt
        openingCashCents
        expectedCashCents expectedCardCents expectedTransferCents
      }
    }
  }
`)

const OPEN_SESSION = graphql(`
  mutation OpenRegisterSession($registerId: ID!, $openingCashCents: Int) {
    openRegisterSession(registerId: $registerId, openingCashCents: $openingCashCents) {
      id status openedAt
      openingCashCents
      expectedCashCents expectedCardCents expectedTransferCents
    }
  }
`)

const CLOSE_SESSION = graphql(`
  mutation CloseRegisterSession($input: CloseRegisterSessionInput!) {
    closeRegisterSession(input: $input) {
      id status closedAt
      openingCashCents
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
    // network-only: register state mutates from sales, opens, closes — any
    // of which can land while the page is mounted. cache-first kept showing
    // a closed register right after openSession because the previous fetch
    // (pre-open) was still served from Apollo's normalized store.
    const { data } = await this.#client.query<{ registers: Register[] }>({
      query: REGISTERS_QUERY,
      variables: { locationId },
      fetchPolicy: 'network-only',
    })
    return data!.registers.filter((r: Register) => r.isActive)
  }

  async openSession(registerId: string, openingCashCents: number): Promise<RegisterSession> {
    const { data } = await this.#client.mutate<{ openRegisterSession: RegisterSession }>({
      mutation: OPEN_SESSION,
      variables: { registerId, openingCashCents },
      // Evict the registers root field so any other consumer (HoyPage, the
      // POS shell's caja gate) refetches on its next mount instead of
      // serving the pre-open snapshot.
      update: (cache) => {
        cache.evict({ fieldName: 'registers' })
        cache.evict({ fieldName: 'posCajaStatusHome' })
        cache.gc()
      },
    })
    return data!.openRegisterSession
  }

  async closeSession(input: CloseSessionInput): Promise<RegisterSession> {
    const { data } = await this.#client.mutate<{ closeRegisterSession: RegisterSession }>({
      mutation: CLOSE_SESSION,
      variables: { input },
      update: (cache) => {
        cache.evict({ fieldName: 'registers' })
        cache.evict({ fieldName: 'posCajaStatusHome' })
        cache.gc()
      },
    })
    return data!.closeRegisterSession
  }
}
