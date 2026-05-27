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
  // Service(s) / combo originally requested when the walk-in was registered.
  // La cola usa esto para la línea "qué viene a hacerse".
  //
  // `requestedServices` es el array canónico (ordenado) — puede contener N
  // servicios sueltos. `requestedService` apunta al primero por compat.
  // `requestedCatalogCombo` es mutex con servicios.
  // Optional porque algunas mutations (assign, complete, drop) no los traen.
  requestedService?: { id: string; name: string } | null
  requestedServices?: Array<{ id: string; name: string; baseDurationMin?: number | null }>
  requestedCatalogCombo?: { id: string; name: string } | null
  pausedAt?: string | null
  sortOrder: number
}
