export interface Register {
  id: string
  name: string
  isActive: boolean
  locationId: string
  openSession: RegisterSession | null
}

export interface RegisterSession {
  id: string
  status: 'OPEN' | 'CLOSED'
  openedAt: string
  closedAt: string | null
  // Sticky fondo inicial. expectedCashCents accumulates sales; this stays
  // put so close-of-register can show "you opened with $X" and compute the
  // withdraw amount = counted - openingCashCents.
  openingCashCents: number
  expectedCashCents: number
  expectedCardCents: number
  expectedTransferCents: number
  countedCashCents: number | null
  countedCardCents: number | null
  countedTransferCents: number | null
}

export interface CloseSessionInput {
  sessionId: string
  countedCashCents: number
  countedCardCents: number
  countedTransferCents: number
}

export interface SaleLedgerEntry {
  id: string
  createdAt: string
  totalCents: number
  paymentStatus: string
  customer: { fullName: string } | null
  appointmentId: string | null
  walkInId: string | null
}
