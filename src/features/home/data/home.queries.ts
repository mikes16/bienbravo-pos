import { graphql } from '@/core/graphql/generated'

export const POS_HOME_COMMISSION = graphql(`
  query PosHomeCommission($staffUserId: ID!, $locationId: ID!, $date: String!) {
    staffServiceRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)
    staffProductRevenueToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)
    staffCommissionToday(staffUserId: $staffUserId, locationId: $locationId, date: $date)
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
