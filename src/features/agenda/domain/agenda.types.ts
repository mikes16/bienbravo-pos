export type AppointmentStatus =
  | 'HOLD'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_SERVICE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'

export interface AppointmentItem {
  label: string
  serviceId: string
  qty: number
  unitPriceCents: number
}

export interface AppointmentCustomer {
  id: string
  fullName: string
  phone: string | null
}

export interface AppointmentStaffUser {
  id: string
  fullName: string
}

export interface Appointment {
  id: string
  status: AppointmentStatus
  salePaymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED' | null
  startAt: string
  endAt: string
  totalCents: number
  customer: AppointmentCustomer | null
  staffUser: AppointmentStaffUser | null
  items: AppointmentItem[]
  locationId: string | null
  locationName: string | null
}
