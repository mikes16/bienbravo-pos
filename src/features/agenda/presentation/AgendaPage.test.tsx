import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  afterEach(() => {
    vi.useRealTimers()
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

  // Clase VIVO sin dinero (spec § 3.1): la agenda puede pintarse de la memoria
  // de esta sesión, pero SIEMPRE se revalida contra la red. Sin esto, el
  // caché sirve el snapshot del primer mount toda la sesión y las citas
  // creadas desde el admin o desde otra tablet no aparecen nunca.
  it('pide las citas a la red al montar, aunque el caché tenga copia', async () => {
    const repos = createMockRepositories()
    const getAppointments = vi.fn().mockResolvedValue([APPT_10AM])
    repos.agenda.getAppointments = getAppointments
    renderWithProviders(<AgendaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })

    expect(await screen.findByText(/carlos méndez/i)).toBeInTheDocument()
    expect(getAppointments).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), 'loc1', undefined, { force: true },
    )
    // Ninguna lectura sin forzar: la agenda nunca se sirve del caché.
    expect(getAppointments.mock.calls.every((c) => c[4]?.force === true)).toBe(true)
  })

  // El canal único de frescura sustituye a los listeners propios: la pantalla
  // registra UNA carga por clase de dato ([D-019]), así que un aviso de citas
  // la recarga y uno de ventas no la toca.
  it('recarga con el aviso de citas del canal y no con el de ventas', async () => {
    const repos = createMockRepositories()
    const getAppointments = vi.fn().mockResolvedValue([APPT_10AM])
    repos.agenda.getAppointments = getAppointments
    const { announce } = renderWithProviders(<AgendaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/carlos méndez/i)).toBeInTheDocument()

    const afterMount = getAppointments.mock.calls.length
    await announce('sales')
    expect(getAppointments).toHaveBeenCalledTimes(afterMount)

    await announce('appointments')
    expect(getAppointments).toHaveBeenCalledTimes(afterMount + 1)
    expect(getAppointments.mock.calls.every((c) => c[4]?.force === true)).toBe(true)
  })

  // [D-018] (tirar el dato al fallar) es regla de DINERO: lo vivo se conserva,
  // pero deja de presentarse como actual — se canta la hora del último dato
  // bueno en la tz de la sucursal.
  it('conserva las citas con aviso y hora cuando falla el refresco', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-05-04T16:05:00.000Z')) // 10:05 en America/Monterrey

    const repos = createMockRepositories()
    const getAppointments = vi
      .fn()
      .mockResolvedValueOnce([APPT_10AM])
      .mockRejectedValue(new Error('Failed to fetch'))
    repos.agenda.getAppointments = getAppointments
    const { announce } = renderWithProviders(<AgendaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/carlos méndez/i)).toBeInTheDocument()

    await announce('appointments')

    const aviso = await screen.findByText(/sin conexión · datos de las 10:05/i)
    expect(aviso).toHaveAttribute('role', 'status')
    // La lista sigue ahí: no se vacía la pantalla por un fallo de red.
    expect(screen.getByText(/carlos méndez/i)).toBeInTheDocument()
  })

  it('retira el aviso cuando el refresco vuelve a funcionar', async () => {
    const repos = createMockRepositories()
    const getAppointments = vi
      .fn()
      .mockResolvedValueOnce([APPT_10AM])
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValue([APPT_10AM])
    repos.agenda.getAppointments = getAppointments
    const { announce } = renderWithProviders(<AgendaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/carlos méndez/i)).toBeInTheDocument()

    await announce('appointments')
    expect(await screen.findByText(/sin conexión · datos de las/i)).toBeInTheDocument()

    await announce('appointments')
    await waitFor(() =>
      expect(screen.queryByText(/sin conexión · datos de las/i)).not.toBeInTheDocument(),
    )
  })
})
