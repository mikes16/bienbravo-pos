import type { CustomerReputationTag } from '@/shared/lib/reputation'

export type { CustomerReputationTag }

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
  // Marca de reputación (VIP / FLAGGED_BY_STAFF / no-show tags / RELIABLE) y
  // nota persistente "solo staff". Solo lectura en el POS.
  reputationTag: CustomerReputationTag | null
  reputationNote: string | null
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
  // Nota interna de la cita dirigida al barbero (la escribe admin/recepción).
  staffNote: string | null
  customer: AppointmentCustomer | null
  staffUser: AppointmentStaffUser | null
  items: AppointmentItem[]
  locationId: string | null
  locationName: string | null
}
