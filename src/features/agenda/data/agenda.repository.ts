import { type ApolloClient } from '@apollo/client'
import { graphql } from '@/core/graphql/generated'
import type { Appointment, AppointmentStatus } from '../domain/agenda.types.ts'

const APPOINTMENTS_QUERY = graphql(`
  query PosAppointments($dateFrom: String!, $dateTo: String!, $locationId: ID, $status: AppointmentStatus) {
    appointments(dateFrom: $dateFrom, dateTo: $dateTo, locationId: $locationId, status: $status) {
      id status salePaymentStatus startAt endAt totalCents
      customer { id fullName phone }
      staffUser { id fullName }
      items { label serviceId qty unitPriceCents }
      locationId locationName
    }
  }
`)

const CHECK_IN = graphql(`mutation CheckIn($id: ID!) { checkIn(appointmentId: $id) { id status } }`)
const START_SERVICE = graphql(`mutation StartService($id: ID!) { startService(appointmentId: $id) { id status } }`)
const COMPLETE = graphql(`mutation Complete($id: ID!) { complete(appointmentId: $id) { id status } }`)
const NO_SHOW = graphql(`mutation NoShow($id: ID!) { noShow(appointmentId: $id) { id status } }`)

export interface AgendaRepository {
  getAppointments(dateFrom: string, dateTo: string, locationId: string | null, status?: AppointmentStatus): Promise<Appointment[]>
  checkIn(appointmentId: string): Promise<void>
  startService(appointmentId: string): Promise<void>
  complete(appointmentId: string): Promise<void>
  noShow(appointmentId: string): Promise<void>
}

export class ApolloAgendaRepository implements AgendaRepository {
  #client: ApolloClient
  constructor(client: ApolloClient) {
    this.#client = client
  }

  async getAppointments(dateFrom: string, dateTo: string, locationId: string | null, status?: AppointmentStatus): Promise<Appointment[]> {
    const { data } = await this.#client.query<{ appointments: Appointment[] }>({
      query: APPOINTMENTS_QUERY,
      variables: { dateFrom, dateTo, locationId, status },
      fetchPolicy: 'cache-first',
    })
    return data!.appointments
  }

  async checkIn(appointmentId: string): Promise<void> {
    await this.#client.mutate({ mutation: CHECK_IN, variables: { id: appointmentId } })
  }

  async startService(appointmentId: string): Promise<void> {
    await this.#client.mutate({ mutation: START_SERVICE, variables: { id: appointmentId } })
  }

  async complete(appointmentId: string): Promise<void> {
    await this.#client.mutate({ mutation: COMPLETE, variables: { id: appointmentId } })
  }

  async noShow(appointmentId: string): Promise<void> {
    await this.#client.mutate({ mutation: NO_SHOW, variables: { id: appointmentId } })
  }
}
