import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WalkInsPage } from './WalkInsPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() { return MOCK_VIEWER }
}

const PENDING_WALKIN = {
  id: 'w1',
  status: 'PENDING' as const,
  customerName: 'Carlos Méndez',
  customerPhone: null,
  customerEmail: null,
  createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  assignedStaffUser: null,
  customer: null,
  sortOrder: 0,
}

// Mismo walk-in, con hora de llegada fija: los tests que congelan el reloj
// necesitan un `createdAt` que no dependa del momento del import.
const WALKIN_AT_10 = { ...PENDING_WALKIN, createdAt: '2026-05-04T16:00:00.000Z' }

describe('WalkInsPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders empty state when no walk-ins', async () => {
    const repos = createMockRepositories()
    repos.walkins.getWalkIns = vi.fn().mockResolvedValue([])
    renderWithProviders(<WalkInsPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/aún no hay clientes esperando|sin clientes/i)).toBeInTheDocument()
  })

  it('renders pending walk-in row with name + wait time', async () => {
    const repos = createMockRepositories()
    repos.walkins.getWalkIns = vi.fn().mockResolvedValue([PENDING_WALKIN])
    renderWithProviders(<WalkInsPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/carlos méndez/i)).toBeInTheDocument()
    // V2 surfaces 5min in two places: the queue header avg-wait stat and
    // the row's "<service> · <N>min" line. Just assert at least one match.
    expect(screen.getAllByText(/5\s*min/i).length).toBeGreaterThan(0)
  })

  it('renders Asignar action for pending walk-ins', async () => {
    const repos = createMockRepositories()
    repos.walkins.getWalkIns = vi.fn().mockResolvedValue([PENDING_WALKIN])
    renderWithProviders(<WalkInsPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    // V2 replaces the legacy "Tomar" verb with "Asignar" (opens barber picker).
    expect(await screen.findByRole('button', { name: /asignar/i })).toBeInTheDocument()
  })

  it('loads the queue with force:true so the operator sees live state on entry, not a stale cache-first snapshot from another tablet', async () => {
    const repos = createMockRepositories()
    repos.walkins.getWalkIns = vi.fn().mockResolvedValue([])
    renderWithProviders(<WalkInsPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await screen.findByText(/aún no hay clientes esperando|sin clientes/i)
    expect(repos.walkins.getWalkIns).toHaveBeenCalledWith('loc1', undefined, undefined, { force: true })
  })

  // El canal único de frescura sustituye a los listeners propios: la pantalla
  // registra UNA carga por CLASE de dato ([D-019]), así que un aviso de
  // walk-ins la recarga y uno de citas no la toca.
  it('recarga con el aviso de walk-ins del canal y no con el de citas', async () => {
    const repos = createMockRepositories()
    const getWalkIns = vi.fn().mockResolvedValue([PENDING_WALKIN])
    repos.walkins.getWalkIns = getWalkIns
    const { announce } = renderWithProviders(<WalkInsPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/carlos méndez/i)).toBeInTheDocument()

    const afterMount = getWalkIns.mock.calls.length
    await announce('appointments')
    expect(getWalkIns).toHaveBeenCalledTimes(afterMount)

    await announce('walkins')
    expect(getWalkIns).toHaveBeenCalledTimes(afterMount + 1)
    // Ninguna lectura sin forzar: la cola nunca se sirve del caché.
    expect(getWalkIns.mock.calls.every((c) => c[3]?.force === true)).toBe(true)
  })

  // [D-018] (tirar la lista al fallar) es regla de DINERO. La cola es VIVO sin
  // dinero: se conserva, pero deja de presentarse como actual — con la hora
  // del último dato bueno en la tz de la SUCURSAL, nunca la del device.
  it('conserva la cola con aviso y hora cuando falla el refresco', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-05-04T16:05:00.000Z')) // 10:05 en America/Monterrey

    const repos = createMockRepositories()
    repos.walkins.getWalkIns = vi
      .fn()
      .mockResolvedValueOnce([WALKIN_AT_10])
      .mockRejectedValue(new Error('Failed to fetch'))
    const { announce } = renderWithProviders(<WalkInsPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/carlos méndez/i)).toBeInTheDocument()

    await announce('walkins')

    const aviso = await screen.findByText(/sin conexión · datos de las 10:05/i)
    expect(aviso).toHaveAttribute('role', 'status')
    // La fila sigue en pantalla: un fallo de red no vacía la sala de espera.
    expect(screen.getByText(/carlos méndez/i)).toBeInTheDocument()
  })

  it('retira el aviso cuando el refresco vuelve a funcionar', async () => {
    const repos = createMockRepositories()
    repos.walkins.getWalkIns = vi
      .fn()
      .mockResolvedValueOnce([WALKIN_AT_10])
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValue([WALKIN_AT_10])
    const { announce } = renderWithProviders(<WalkInsPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/carlos méndez/i)).toBeInTheDocument()

    await announce('walkins')
    expect(await screen.findByText(/sin conexión · datos de las/i)).toBeInTheDocument()

    await announce('walkins')
    await waitFor(() =>
      expect(screen.queryByText(/sin conexión · datos de las/i)).not.toBeInTheDocument(),
    )
  })
})
