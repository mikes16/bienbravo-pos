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
  getRegisters(locationId: string, opts?: { force?: boolean }): Promise<Register[]>
  openSession(registerId: string, openingCashCents: number): Promise<RegisterSession>
  closeSession(input: CloseSessionInput): Promise<RegisterSession>
}

export class ApolloRegisterRepository implements RegisterRepository {
  #client: ApolloClient
  constructor(client: ApolloClient) {
    this.#client = client
  }

  async getRegisters(locationId: string, opts?: { force?: boolean }): Promise<Register[]> {
    // cache-first por default: pinta el último snapshot al toque. Las
    // mutaciones de abrir/cerrar caja evictan el field `registers` del
    // cache, así que el bug histórico (mostrar "cerrada" tras open por
    // servir el snapshot pre-open) está cubierto para ESTE cliente Apollo.
    // Pero apertura/cierre desde OTRO device o desde el admin no evicta
    // este cache — force:true (network-only) es lo que CajaPage usa en su
    // refetch de window.focus / visibilitychange para que ese caso
    // cross-device de verdad llegue a la red.
    const { data } = await this.#client.query<{ registers: Register[] }>({
      query: REGISTERS_QUERY,
      variables: { locationId },
      fetchPolicy: opts?.force ? 'network-only' : 'cache-first',
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
