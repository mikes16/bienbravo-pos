import { screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { MyDayPage, computeWorkedMinutes } from './MyDayPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() { return MOCK_VIEWER }
}

function evt(at: string, type: 'CLOCK_IN' | 'CLOCK_OUT'): TimeClockEvent {
  return { id: at, type, at }
}

describe('MyDayPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('renders heading "Mi Día"', async () => {
    renderWithProviders(<MyDayPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/mi día/i)).toBeInTheDocument()
  })

  it('renders staff name in viewer-aware copy', async () => {
    renderWithProviders(<MyDayPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(MOCK_VIEWER.staff.fullName)).toBeInTheDocument()
  })

  it('renders KPI sections', async () => {
    renderWithProviders(<MyDayPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/ventas/i)).toBeInTheDocument()
  })
})

describe('computeWorkedMinutes', () => {
  const NOW = new Date('2026-05-06T10:00:00Z')

  it('returns 0 for empty events', () => {
    expect(computeWorkedMinutes([], NOW)).toBe(0)
  })

  it('counts a single closed IN/OUT span', () => {
    const events = [evt('2026-05-06T08:00:00Z', 'CLOCK_IN'), evt('2026-05-06T09:30:00Z', 'CLOCK_OUT')]
    expect(computeWorkedMinutes(events, NOW)).toBe(90)
  })

  it('keeps an open span running up to "now"', () => {
    const events = [evt('2026-05-06T09:00:00Z', 'CLOCK_IN')]
    expect(computeWorkedMinutes(events, NOW)).toBe(60)
  })

  it('ignores duplicate CLOCK_IN events (real bug from the field)', () => {
    // 4 ENTRADAs in a row, then SALIDA, then ENTRADA — the historical case
    // that surfaced the original "0h 0m" bug.
    const events = [
      evt('2026-05-06T00:45:00Z', 'CLOCK_IN'),
      evt('2026-05-06T00:45:30Z', 'CLOCK_IN'),
      evt('2026-05-06T00:48:00Z', 'CLOCK_IN'),
      evt('2026-05-06T00:48:30Z', 'CLOCK_IN'),
      evt('2026-05-06T01:17:00Z', 'CLOCK_OUT'),
      evt('2026-05-06T01:17:30Z', 'CLOCK_IN'),
    ]
    // First IN at 00:45 → OUT at 01:17 = 32 minutes. Re-IN at 01:17:30 still
    // open at NOW (10:00) ≈ 522.5 minutes. Total ≈ 554.5.
    const result = computeWorkedMinutes(events, NOW)
    expect(result).toBeGreaterThan(550)
    expect(result).toBeLessThan(560)
  })

  it('drops orphan CLOCK_OUT events', () => {
    const events = [evt('2026-05-06T08:00:00Z', 'CLOCK_OUT'), evt('2026-05-06T09:00:00Z', 'CLOCK_IN')]
    expect(computeWorkedMinutes(events, NOW)).toBe(60)
  })

  it('handles events delivered out of order', () => {
    const events = [
      evt('2026-05-06T09:30:00Z', 'CLOCK_OUT'),
      evt('2026-05-06T08:00:00Z', 'CLOCK_IN'),
    ]
    expect(computeWorkedMinutes(events, NOW)).toBe(90)
  })
})
