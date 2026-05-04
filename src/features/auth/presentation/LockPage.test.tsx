import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, MOCK_STAFF, InMemoryAuthRepository } from '@/test/mocks/repositories'
import type { PosStaffUser, PosLocation } from '@/core/auth/auth.types'
import { PinLoginException } from '@/core/auth/auth.types'
import { LockPage } from './LockPage'

// ── Shared fixtures ────────────────────────────────────────────────────────

const BARBER_WITH_PIN: PosStaffUser = {
  ...MOCK_STAFF,
  id: 'b1',
  fullName: 'Juan Pérez',
  email: 'juan@example.com',
  hasPosPin: true,
  pinLockedUntil: null,
}

const LOCATION: PosLocation = { id: 'loc1', name: 'Centro' }

// ── Repo helpers ───────────────────────────────────────────────────────────

class TestAuthRepo extends InMemoryAuthRepository {
  override async getLocations() {
    return [LOCATION]
  }

  override async getBarbers() {
    return [BARBER_WITH_PIN]
  }

  override async verifyLocationAccess() {
    return true
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('LockPage state machine', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('starts in PAIRING when no localStorage', async () => {
    renderWithProviders(<LockPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/selecciona la sucursal/i)).toBeInTheDocument()
  })

  it('starts in BARBER_SELECTOR when localStorage has locationId', async () => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
    renderWithProviders(<LockPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/selecciona tu perfil/i)).toBeInTheDocument()
  })

  it('starts in PIN_ENTRY when localStorage has locationId AND last-barber-id', async () => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
    window.localStorage.setItem('bb-pos-last-barber-id', 'b1')
    renderWithProviders(<LockPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/ingresa tu pin/i)).toBeInTheDocument()
  })

  it('transitions BARBER_SELECTOR → PIN_ENTRY on barber tap', async () => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
    const user = userEvent.setup()
    renderWithProviders(<LockPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    await user.click(await screen.findByRole('button', { name: /juan pérez/i }))
    expect(await screen.findByText(/ingresa tu pin/i)).toBeInTheDocument()
  })

  it('transitions PAIRING → BARBER_SELECTOR on successful pairing', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LockPage />, {
      repos: { ...createMockRepositories(), auth: new TestAuthRepo() },
    })
    // Wait for location tiles to appear, then select Centro
    await user.click(await screen.findByRole('button', { name: 'Centro' }))
    // Password step
    await user.type(screen.getByPlaceholderText('Contraseña de sucursal'), 'right')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    // Should arrive at BARBER_SELECTOR
    expect(await screen.findByText(/selecciona tu perfil/i)).toBeInTheDocument()
    expect(window.localStorage.getItem('bb-pos-location-id')).toBe('loc1')
  })

  it('transitions to LOCKED_OUT on PIN_LOCKED_OUT response', async () => {
    class LockedAuthRepo extends TestAuthRepo {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      override async pinLogin(_email: string, _pin4: string): Promise<never> {
        throw new PinLoginException({
          code: 'PIN_LOCKED_OUT',
          lockedUntil: new Date(Date.now() + 60_000),
        })
      }
    }
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
    window.localStorage.setItem('bb-pos-last-barber-id', 'b1')
    const user = userEvent.setup()
    renderWithProviders(<LockPage />, {
      repos: { ...createMockRepositories(), auth: new LockedAuthRepo() },
    })
    // Wait for PIN_ENTRY to appear
    await screen.findByText(/ingresa tu pin/i)
    // Enter a 4-digit PIN via the keypad
    for (const d of ['1', '2', '3', '4']) {
      await user.click(screen.getByRole('button', { name: d }))
    }
    // Countdown timer should appear (LockoutView)
    expect(await screen.findByText(/0:[0-5]\d|1:00/)).toBeInTheDocument()
  })

  it('transitions to NO_PIN_MESSAGE for barber without PIN', async () => {
    const barberNoPin: PosStaffUser = {
      ...MOCK_STAFF,
      id: 'b2',
      fullName: 'Pedro García',
      email: 'pedro@example.com',
      hasPosPin: false,
      pinLockedUntil: null,
    }
    class NoPinAuthRepo extends TestAuthRepo {
      override async getBarbers() {
        return [barberNoPin]
      }
    }
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
    const user = userEvent.setup()
    renderWithProviders(<LockPage />, {
      repos: { ...createMockRepositories(), auth: new NoPinAuthRepo() },
    })
    await user.click(await screen.findByRole('button', { name: /pedro garcía/i }))
    expect(await screen.findByText(/pin no configurado/i)).toBeInTheDocument()
  })
})
