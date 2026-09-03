import { type ApolloClient } from '@apollo/client'
import { graphql } from '@/core/graphql/generated'
import type { Register, RegisterSession, CloseSessionInput, CajaStatus } from '../domain/register.types.ts'

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

// Gate del shell: ¿hay caja abierta y desde cuándo? Reusa el root field
// `posCajaStatusHome` (mismo que Hoy) con un nombre de operación distinto para
// que codegen no choque. Las mutations de abrir/cerrar ya evictan ese field.
const CAJA_GATE_STATUS_QUERY = graphql(`
  query PosCajaGateStatus($locationId: ID!) {
    posCajaStatusHome(locationId: $locationId) {
      isOpen
      isStale
      openedAt
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
  /** Siempre por red: decide si el shell bloquea al operador. */
  getCajaStatus(locationId: string): Promise<CajaStatus>
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

  async getCajaStatus(locationId: string): Promise<CajaStatus> {
    // network-only: es un gate de correctness (¿la caja abierta es de ayer?),
    // no una lista pintada rápido. Un snapshot viejo aquí es justo el bug que
    // el gate existe para atrapar.
    const { data } = await this.#client.query({
      query: CAJA_GATE_STATUS_QUERY,
      variables: { locationId },
      fetchPolicy: 'network-only',
    })
    const status = data!.posCajaStatusHome
    return { isOpen: status.isOpen, isStale: status.isStale, openedAt: status.openedAt ?? null }
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
