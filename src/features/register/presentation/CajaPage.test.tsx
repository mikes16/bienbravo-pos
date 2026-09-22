import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CajaPage } from './CajaPage'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

const OPEN_REGISTER = {
  id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1',
  openSession: {
    id: 'sess-1', status: 'OPEN',
    openedAt: '2026-05-04T09:15:00.000Z', closedAt: null,
    openingCashCents: 50000,
    expectedCashCents: 50000, expectedCardCents: 0, expectedTransferCents: 0,
    countedCashCents: null, countedCardCents: null, countedTransferCents: null,
  },
}

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

describe('CajaPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  it('renders Sin abrir hero when no open session', async () => {
    const repos = createMockRepositories()
    repos.register.getRegisters = vi.fn().mockResolvedValue([
      { id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1', openSession: null },
    ])
    renderWithProviders(<CajaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/sin abrir/i)).toBeInTheDocument()
  })

  it('renders Caja abierta banner when an open session exists', async () => {
    const repos = createMockRepositories()
    repos.register.getRegisters = vi.fn().mockResolvedValue([
      {
        id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1',
        openSession: {
          id: 'sess-1', status: 'OPEN',
          openedAt: '2026-05-04T09:15:00.000Z', closedAt: null,
          openingCashCents: 50000,
          expectedCashCents: 50000, expectedCardCents: 0, expectedTransferCents: 0,
          countedCashCents: null, countedCardCents: null, countedTransferCents: null,
        },
      },
    ])
    renderWithProviders(<CajaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/caja abierta/i)).toBeInTheDocument()
  })

  it('renders empty state when no registers configured', async () => {
    const repos = createMockRepositories()
    repos.register.getRegisters = vi.fn().mockResolvedValue([])
    renderWithProviders(<CajaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/sin cajas configuradas|no hay cajas/i)).toBeInTheDocument()
  })

  it('Cerrar caja: la revisión de servicios en curso siempre lee de red (force)', async () => {
    const repos = createMockRepositories()
    repos.register.getRegisters = vi.fn().mockResolvedValue([OPEN_REGISTER])
    const getAppointments = vi.fn().mockResolvedValue([])
    const getWalkIns = vi.fn().mockResolvedValue([])
    repos.agenda.getAppointments = getAppointments
    repos.walkins.getWalkIns = getWalkIns
    const user = userEvent.setup()
    renderWithProviders(<CajaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })

    await user.click(await screen.findByText(/cerrar caja/i))

    await waitFor(() => expect(getAppointments).toHaveBeenCalled())
    expect(getAppointments).toHaveBeenCalledWith(
      expect.any(String), expect.any(String), 'loc1', 'IN_SERVICE', { force: true },
    )
    expect(getWalkIns).toHaveBeenCalledWith('loc1', undefined, undefined, { force: true })
  })

  it('mientras el servidor no responde muestra esqueleto, nunca "sin cajas configuradas"', async () => {
    const repos = createMockRepositories()
    // Nunca resuelve: "aún no sé" ([D-020]) — ni lista vacía ni caja abierta.
    repos.register.getRegisters = vi.fn().mockReturnValue(new Promise(() => {}))
    renderWithProviders(<CajaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })

    await waitFor(() => expect(repos.register.getRegisters).toHaveBeenCalled())
    expect(screen.queryByText(/sin cajas configuradas/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sin abrir/i)).not.toBeInTheDocument()
  })

  it('un fallo tira la caja anterior: aviso con Reintentar en vez de los montos viejos', async () => {
    const repos = createMockRepositories()
    repos.register.getRegisters = vi
      .fn()
      .mockResolvedValueOnce([OPEN_REGISTER])
      .mockRejectedValue(new Error('network down'))
    const { announce } = renderWithProviders(<CajaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/caja abierta/i)).toBeInTheDocument()

    await announce('register')

    expect(await screen.findByRole('button', { name: /reintentar/i })).toBeInTheDocument()
    expect(screen.queryByText(/caja abierta/i)).not.toBeInTheDocument()
  })

  it('se refresca por el canal (temas sales y register), no por foco/visibilidad propios', async () => {
    const repos = createMockRepositories()
    const getRegisters = vi.fn().mockResolvedValue([OPEN_REGISTER])
    repos.register.getRegisters = getRegisters
    const { announce } = renderWithProviders(<CajaPage />, {
      repos: { ...repos, auth: new TestAuthRepo() },
    })

    // Ninguna llamada pide política de caché: el repositorio va a la red
    // siempre ([D-017]), así que el cierre remoto desde admin se refleja.
    await waitFor(() => expect(getRegisters).toHaveBeenCalledWith('loc1'))
    const callsAfterMount = getRegisters.mock.calls.length

    // La caja de otra iPad: posDataChanged REGISTER.
    await announce('register')
    expect(getRegisters.mock.calls.length).toBeGreaterThan(callsAfterMount)
    const callsAfterRegister = getRegisters.mock.calls.length

    // Una venta de otra iPad mueve el esperado del corte.
    await announce('sales')
    expect(getRegisters.mock.calls.length).toBeGreaterThan(callsAfterRegister)
    const callsAfterSales = getRegisters.mock.calls.length

    // La pantalla ya NO vigila la ventana por su cuenta: eso lo hace el canal.
    act(() => { window.dispatchEvent(new Event('focus')) })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    await act(async () => { await Promise.resolve() })
    expect(getRegisters.mock.calls.length).toBe(callsAfterSales)

    expect(getRegisters.mock.calls.every((c) => c.length === 1)).toBe(true)
  })
})
