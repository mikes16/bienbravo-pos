export type WalkInStatus = 'PENDING' | 'ASSIGNED' | 'DONE' | 'CANCELLED' | 'NO_SHOW'

export interface WalkIn {
  id: string
  status: WalkInStatus
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  createdAt: string
  assignedStaffUser: { id: string; fullName: string } | null
  customer: { id: string; fullName: string; email: string | null; phone: string | null } | null
  preferredStaffUserId?: string | null
  preferredStaffUser?: { id: string; fullName: string; photoUrl?: string | null } | null
  pausedAt?: string | null
  sortOrder: number
}
