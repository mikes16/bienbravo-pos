import { screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgendaPage } from './AgendaPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() { return MOCK_VIEWER }
}

// Appointment shape matches domain/agenda.types.ts:
// items: AppointmentItem[] with { label, serviceId, qty, unitPriceCents }
// staffUser: AppointmentStaffUser | null with { id, fullName }
const APPT_10AM = {
  id: 'a1',
  startAt: '2026-05-04T16:00:00.000Z', // 10:00 in America/Monterrey (UTC-6)
  endAt: '2026-05-04T16:30:00.000Z',
  status: 'CONFIRMED' as const,
  salePaymentStatus: null as null,
  totalCents: 35000,
  customer: { id: 'c1', fullName: 'Carlos Méndez', phone: null },
  staffUser: { id: 's1', fullName: 'Antonio' },
  items: [{ label: 'Corte', serviceId: 'svc1', qty: 1, unitPriceCents: 35000 }],
  locationId: 'loc1',
  locationName: 'Sucursal Centro',
}

describe('AgendaPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('renders empty state when no appointments', async () => {
    const repos = createMockRepositories()
    repos.agenda.getAppointments = vi.fn().mockResolvedValue([])
    renderWithProviders(<AgendaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    // Either of the two empty-state messages is acceptable
    const matches = await screen.findAllByText(/sin citas|aún no hay/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('renders appointment with customer + service + barber', async () => {
    const repos = createMockRepositories()
    repos.agenda.getAppointments = vi.fn().mockResolvedValue([APPT_10AM])
    renderWithProviders(<AgendaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/carlos méndez/i)).toBeInTheDocument()
    expect(screen.getByText(/corte/i)).toBeInTheDocument()
    expect(screen.getByText(/antonio/i)).toBeInTheDocument()
  })

  it('renders time labels in America/Monterrey timezone', async () => {
    const repos = createMockRepositories()
    repos.agenda.getAppointments = vi.fn().mockResolvedValue([APPT_10AM])
    renderWithProviders(<AgendaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    // 16:00 UTC = 10:00 in CST (America/Monterrey is UTC-6 year-round)
    // The time appears in both the group header and the row, so use getAllByText
    const timeElements = await screen.findAllByText(/10:00/)
    expect(timeElements.length).toBeGreaterThan(0)
  })
})
