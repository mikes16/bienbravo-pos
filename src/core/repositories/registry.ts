import type { ApolloClient } from '@apollo/client'
import { type AuthRepository, ApolloAuthRepository } from '@/core/auth/auth.repository.ts'
import { type CheckoutRepository, ApolloCheckoutRepository } from '@/features/checkout/data/checkout.repository.ts'
import { type RegisterRepository, ApolloRegisterRepository } from '@/features/register/data/register.repository.ts'
import { type ClockRepository, ApolloClockRepository } from '@/features/clock/data/clock.repository.ts'
import { type AgendaRepository, ApolloAgendaRepository } from '@/features/agenda/data/agenda.repository.ts'
import { type WalkInsRepository, ApolloWalkInsRepository } from '@/features/walkins/data/walkins.repository.ts'

export interface Repositories {
  auth: AuthRepository
  checkout: CheckoutRepository
  register: RegisterRepository
  clock: ClockRepository
  agenda: AgendaRepository
  walkins: WalkInsRepository
}

export function createRepositories(client: ApolloClient): Repositories {
  return {
    auth: new ApolloAuthRepository(client),
    checkout: new ApolloCheckoutRepository(client),
    register: new ApolloRegisterRepository(client),
    clock: new ApolloClockRepository(client),
    agenda: new ApolloAgendaRepository(client),
    walkins: new ApolloWalkInsRepository(client),
  }
}
