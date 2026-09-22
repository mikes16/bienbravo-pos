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
  /**
   * Cajas de la sucursal con su sesión abierta (fondo y montos esperados).
   *
   * SIEMPRE va a la red (`network-only`). Regla del dueño (18 sep 2026): el
   * dinero nunca se muestra desde la memoria guardada — con varias iPads
   * cobrando a la vez, un monto esperado guardado está mal en cuanto otra
   * cobra, y una apertura/cierre hecha desde otro device o desde el admin no
   * invalida nada en ÉSTE (R8). Por eso no hay parámetro para elegir la
   * política: no existe una lectura legítima de caja que se sirva sin
   * preguntarle al servidor.
   */
  getRegisters(locationId: string): Promise<Register[]>
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

  async getRegisters(locationId: string): Promise<Register[]> {
    const { data } = await this.#client.query<{ registers: Register[] }>({
      query: REGISTERS_QUERY,
      variables: { locationId },
      // `registers` es clase DINERO/SENSIBLE (core/apollo/dataClasses.ts):
      // ni se guarda en el dispositivo ni se sirve de lo ya leído. Las
      // evicciones de abrir/cerrar de abajo siguen ahí para los demás
      // consumidores del mismo cliente Apollo (el gate del shell, Hoy),
      // que ven el field vacío en su próximo montaje.
      fetchPolicy: 'network-only',
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
