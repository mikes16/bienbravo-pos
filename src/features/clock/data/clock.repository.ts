import { type ApolloClient } from '@apollo/client'
import { graphql } from '@/core/graphql/generated'

const CLOCK_IN = graphql(`
  mutation ClockIn($locationId: ID!) { clockIn(locationId: $locationId) }
`)

const CLOCK_OUT = graphql(`
  mutation ClockOut($locationId: ID!) { clockOut(locationId: $locationId) }
`)

const TIME_CLOCK_EVENTS = graphql(`
  query TimeClockEvents($staffUserId: ID!, $locationId: ID!, $fromDate: String!, $toDate: String!) {
    timeClockEvents(staffUserId: $staffUserId, locationId: $locationId, fromDate: $fromDate, toDate: $toDate) {
      id type at
    }
  }
`)

const SHIFT_TEMPLATES = graphql(`
  query ShiftTemplates($staffUserId: ID!, $locationId: ID!) {
    shiftTemplates(staffUserId: $staffUserId, locationId: $locationId) {
      id staffUserId locationId dayOfWeek startMin endMin
    }
  }
`)

export interface TimeClockEvent {
  id: string
  type: 'CLOCK_IN' | 'CLOCK_OUT'
  at: string
}

export interface ShiftTemplate {
  id: string
  staffUserId: string
  locationId: string
  dayOfWeek: number
  startMin: number
  endMin: number
}

export interface ClockRepository {
  clockIn(locationId: string): Promise<boolean>
  clockOut(locationId: string): Promise<boolean>
  getEvents(staffUserId: string, locationId: string, fromDate: string, toDate: string): Promise<TimeClockEvent[]>
  getShiftTemplates(staffUserId: string, locationId: string): Promise<ShiftTemplate[]>
}

export class ApolloClockRepository implements ClockRepository {
  #client: ApolloClient
  constructor(client: ApolloClient) {
    this.#client = client
  }

  async clockIn(locationId: string): Promise<boolean> {
    const { data } = await this.#client.mutate<{ clockIn: boolean }>({
      mutation: CLOCK_IN,
      variables: { locationId },
    })
    return data!.clockIn
  }

  async clockOut(locationId: string): Promise<boolean> {
    const { data } = await this.#client.mutate<{ clockOut: boolean }>({
      mutation: CLOCK_OUT,
      variables: { locationId },
    })
    return data!.clockOut
  }

  async getEvents(
    staffUserId: string,
    locationId: string,
    fromDate: string,
    toDate: string,
  ): Promise<TimeClockEvent[]> {
    // network-only: the events list changes on every clockIn/clockOut, so
    // cache-first would mask the just-recorded entry until the cache evicts.
    const { data } = await this.#client.query<{ timeClockEvents: TimeClockEvent[] }>({
      query: TIME_CLOCK_EVENTS,
      variables: { staffUserId, locationId, fromDate, toDate },
      fetchPolicy: 'network-only',
    })
    return data!.timeClockEvents
  }

  async getShiftTemplates(
    staffUserId: string,
    locationId: string,
  ): Promise<ShiftTemplate[]> {
    const { data } = await this.#client.query<{ shiftTemplates: ShiftTemplate[] }>({
      query: SHIFT_TEMPLATES,
      variables: { staffUserId, locationId },
      fetchPolicy: 'cache-first',
    })
    return data!.shiftTemplates
  }
}
