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

// Ventanas REALES de trabajo del día: el API resuelve la plantilla semanal y
// le aplica encima los overrides del roster (DAY_OFF / CUSTOM_HOURS) con el
// mismo motor que usa payroll. Leer la plantilla cruda dejaba al POS ciego a
// esas excepciones, así que el retardo del reloj discrepaba del de nómina.
const STAFF_WORKING_WINDOWS = graphql(`
  query StaffWorkingWindows($staffUserId: ID!, $locationId: ID!, $date: String!) {
    staffWorkingWindows(staffUserId: $staffUserId, locationId: $locationId, date: $date) {
      startMin endMin
    }
  }
`)

// Tolerancia de retardo de la sucursal. Si no hay regla configurada usamos
// el default del backend (10 min, alineado con payroll.service.ts).
const LATENESS_RULE = graphql(`
  query PosLatenessRule($locationId: ID!) {
    latenessRule(locationId: $locationId) {
      id
      locationId
      defaultMinutesLateThreshold
    }
  }
`)

export interface TimeClockEvent {
  id: string
  type: 'CLOCK_IN' | 'CLOCK_OUT'
  at: string
}

/** Una ventana de trabajo del día, en minutos desde medianoche local de la
 *  sucursal. Un día puede traer varias (turno partido) o ninguna (descanso,
 *  sea por plantilla o por un override DAY_OFF del roster). */
export interface WorkingWindow {
  startMin: number
  endMin: number
}

export interface ClockRepository {
  clockIn(locationId: string): Promise<boolean>
  clockOut(locationId: string): Promise<boolean>
  getEvents(staffUserId: string, locationId: string, fromDate: string, toDate: string): Promise<TimeClockEvent[]>
  /** `date` en 'YYYY-MM-DD' del día local de la sucursal (localDayInTz). */
  getWorkingWindows(staffUserId: string, locationId: string, date: string, opts?: { force?: boolean }): Promise<WorkingWindow[]>
  getLatenessThresholdMin(locationId: string, opts?: { force?: boolean }): Promise<number>
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
    // getAvailableBarbers (checkout.repository.ts) hoy lee network-only,
    // así que este evict ya no es lo que refresca el picker "¿Quién
    // atiende?" — se queda como defensa para cualquier lector cache-first
    // futuro de `posAvailableBarbers` y para que el cache persistido en
    // localStorage no guarde un snapshot pre-fichada.
    this.#client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'posAvailableBarbers' })
    this.#client.cache.gc()
    return data!.clockIn
  }

  async clockOut(locationId: string): Promise<boolean> {
    const { data } = await this.#client.mutate<{ clockOut: boolean }>({
      mutation: CLOCK_OUT,
      variables: { locationId },
    })
    // Mismo motivo que clockIn: un barbero que ficha salida debe dejar de
    // ser seleccionable en el picker del checkout de inmediato, no hasta el
    // próximo hard reload.
    this.#client.cache.evict({ id: 'ROOT_QUERY', fieldName: 'posAvailableBarbers' })
    this.#client.cache.gc()
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

  async getWorkingWindows(
    staffUserId: string,
    locationId: string,
    date: string,
    opts?: { force?: boolean },
  ): Promise<WorkingWindow[]> {
    // cache-first por default pinta rápido en el mount. Pero estos son
    // datos configurados por el admin (plantilla de turno + overrides del
    // roster) — si cambian a mitad del día, este cliente Apollo nunca se
    // entera (no hay mutación local que los evicte, a diferencia de
    // registers/openSession). Sin un path force:true, el indicador de
    // "tarde" del reloj se queda con la config vieja hasta un hard reload.
    // ClockPage usa force:true en su refetch de window.focus /
    // visibilitychange, mismo patrón que CajaPage con getRegisters.
    // `date` va en las variables, así que cada día local tiene su propio
    // bucket de cache y cruzar la medianoche no sirve las ventanas de ayer.
    const { data } = await this.#client.query<{ staffWorkingWindows: WorkingWindow[] }>({
      query: STAFF_WORKING_WINDOWS,
      variables: { staffUserId, locationId, date },
      fetchPolicy: opts?.force ? 'network-only' : 'cache-first',
    })
    return data!.staffWorkingWindows
  }

  async getLatenessThresholdMin(locationId: string, opts?: { force?: boolean }): Promise<number> {
    // Default 10 min — alineado con el fallback de payroll.service.ts
    // (línea 260: `?? rule?.defaultMinutesLateThreshold ?? 10`).
    // Si la sucursal no tiene regla configurada, usamos esto.
    const DEFAULT_THRESHOLD = 10
    try {
      // Mismo motivo que getWorkingWindows: la regla de tardanza la
      // configura el admin y no hay eviction local — force:true (usado en
      // el refetch de focus/visibilitychange de ClockPage) es lo único que
      // hace que un cambio de tolerancia se refleje sin hard reload.
      const { data } = await this.#client.query<{
        latenessRule: { defaultMinutesLateThreshold: number } | null
      }>({
        query: LATENESS_RULE,
        variables: { locationId },
        fetchPolicy: opts?.force ? 'network-only' : 'cache-first',
      })
      return data?.latenessRule?.defaultMinutesLateThreshold ?? DEFAULT_THRESHOLD
    } catch {
      // Si la query falla por permisos o red, no romper el reloj —
      // caer al default sin marcar retardos espurios.
      return DEFAULT_THRESHOLD
    }
  }
}
