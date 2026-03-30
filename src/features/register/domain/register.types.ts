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
