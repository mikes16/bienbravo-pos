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
  // Service / combo originally requested when the walk-in was registered.
  // The queue row uses these for the "what are they here for" line. The
  // base list query fetches the minimal `{ id, name }` shape; the suggested-next
  // query fetches the same. Both are optional because legacy callers (and the
  // assign mutation) don't fetch them.
  requestedService?: { id: string; name: string } | null
  requestedCatalogCombo?: { id: string; name: string } | null
  pausedAt?: string | null
  sortOrder: number
}
