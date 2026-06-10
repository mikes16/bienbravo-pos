import { graphql } from '@/core/graphql/generated'

export const POS_HOME_COMMISSION = graphql(`
  query PosHomeCommission($staffUserId: ID!, $locationId: ID!, $date: String!) {
    staffServiceRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)
    staffProductRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)
    staffCommissionToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)
  }
`)

// Mi Día — desglose detallado de ganancias del barbero. A diferencia de
// POS_HOME_COMMISSION (que da 3 ints planos), esta query retorna service
// vs product vs tips por separado, y un array per-sale con la comisión
// derivada para cada venta. Permite que el UI muestre "Tu parte" por row
// sin queries adicionales.
export const POS_MY_DAY_EARNINGS = graphql(`
  query PosMyDayEarnings($staffUserId: ID!, $locationId: ID!, $date: String!) {
    staffDayEarnings(staffUserId: $staffUserId, locationId: $locationId, date: $date) {
      serviceCommissionCents
      productCommissionCents
      tipsCents
      totalCommissionCents
      serviceRevenueCents
      productRevenueCents
      perSale {
        saleId
        commissionCents
        tipCents
        earningsCents
        soldAt
        customerName
        linkedWalkInId
        linkedAppointmentId
        itemLabels
        attributedRevenueCents
      }
    }
  }
`)

export const POS_HOME_CAJA_STATUS = graphql(`
  query PosHomeCajaStatus($locationId: ID!) {
    posCajaStatusHome(locationId: $locationId) {
      isOpen
      accumulatedCents
      openedAt
    }
  }
`)

// Subscription real-time a la cola de walk-ins. El payload del evento es
// minimal a propósito — el componente reacciona disparando refetch() del
// flow normal de Hoy (appointments + walk-ins + earnings + caja). Cada
// evento llega como un "ping de invalidación", no como data autoritativa.
export const POS_HOME_WALK_IN_QUEUE_UPDATED = graphql(`
  subscription PosHomeWalkInQueueUpdated($slug: String!) {
    walkInQueueUpdated(slug: $slug) {
      kind
      walkInId
      locationSlug
      occurredAt
    }
  }
`)

// Subscription a eventos de cita. Cubre: nueva cita, check-in,
// start-service, complete, no-show, cancelación, reschedule. POS Hoy
// refetcha agenda + earnings cuando llega — la cita completada/cancelada
// desaparece de la VM, las nuevas aparecen, los estados actualizan.
export const POS_HOME_APPOINTMENT_UPDATED = graphql(`
  subscription PosHomeAppointmentUpdated($slug: String!) {
    appointmentUpdated(slug: $slug) {
      kind
      appointmentId
      locationSlug
      occurredAt
    }
  }
`)

// Subscription a eventos de venta (create / void / close prepaid). Caso
// clave: barbero A en POS A cobra una venta atribuida a barbero B → POS B
// recibe el evento y refetcha sus comisiones del día. Antes había que
// esperar al window.focus.
export const POS_HOME_SALE_EVENT = graphql(`
  subscription PosHomeSaleEvent($slug: String!) {
    saleEvent(slug: $slug) {
      kind
      saleId
      locationSlug
      occurredAt
    }
  }
`)
