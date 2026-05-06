import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useContext, type ReactNode } from 'react'
import { PosAuthProvider, PosAuthContext } from './PosAuthProvider'
import { RepositoryProvider } from '@/core/repositories/RepositoryProvider'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

const STORAGE_KEY_LOCKED = 'bb-pos-locked'

class AlreadySignedInAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

class NoSessionAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return null
  }
}

function Wrapper({ children, auth }: { children: ReactNode; auth: InMemoryAuthRepository }) {
  const repos = { ...createMockRepositories(), auth }
  return (
    <RepositoryProvider value={repos}>
      <PosAuthProvider>{children}</PosAuthProvider>
    </RepositoryProvider>
  )
}

function Probe() {
  const ctx = useContext(PosAuthContext)
  if (!ctx) return null
  return (
    <div>
      <span data-testid="locked">{ctx.isLocked ? 'locked' : 'unlocked'}</span>
      <span data-testid="auth">{ctx.isAuthenticated ? 'auth' : 'anon'}</span>
      <button type="button" onClick={ctx.lock}>do-lock</button>
      <button type="button" onClick={ctx.unlock}>do-unlock</button>
      <button type="button" onClick={() => void ctx.logout()}>do-logout</button>
    </div>
  )
}

describe('PosAuthProvider lock persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('initial isLocked reads from localStorage so a soft-lock survives reload', async () => {
    window.localStorage.setItem(STORAGE_KEY_LOCKED, 'true')
    await act(async () => {
      render(
        <Wrapper auth={new AlreadySignedInAuthRepo()}>
          <Probe />
        </Wrapper>,
      )
    })
    expect(screen.getByTestId('locked').textContent).toBe('locked')
    expect(screen.getByTestId('auth').textContent).toBe('auth')
  })

  it('clears the persisted lock when getViewer returns null (cookie expired)', async () => {
    window.localStorage.setItem(STORAGE_KEY_LOCKED, 'true')
    await act(async () => {
      render(
        <Wrapper auth={new NoSessionAuthRepo()}>
          <Probe />
        </Wrapper>,
      )
    })
    expect(screen.getByTestId('locked').textContent).toBe('unlocked')
    expect(window.localStorage.getItem(STORAGE_KEY_LOCKED)).toBeNull()
  })

  it('lock() writes the persisted flag; unlock() removes it', async () => {
    let result!: { unmount: () => void }
    await act(async () => {
      result = render(
        <Wrapper auth={new AlreadySignedInAuthRepo()}>
          <Probe />
        </Wrapper>,
      )
    })

    expect(window.localStorage.getItem(STORAGE_KEY_LOCKED)).toBeNull()

    await act(async () => {
      screen.getByText('do-lock').click()
    })
    expect(window.localStorage.getItem(STORAGE_KEY_LOCKED)).toBe('true')
    expect(screen.getByTestId('locked').textContent).toBe('locked')

    await act(async () => {
      screen.getByText('do-unlock').click()
    })
    expect(window.localStorage.getItem(STORAGE_KEY_LOCKED)).toBeNull()
    expect(screen.getByTestId('locked').textContent).toBe('unlocked')

    result.unmount()
  })

  it('logout() clears the persisted lock and the last-barber memory', async () => {
    window.localStorage.setItem(STORAGE_KEY_LOCKED, 'true')
    window.localStorage.setItem('bb-pos-last-barber-id', 'barber-1')
    await act(async () => {
      render(
        <Wrapper auth={new AlreadySignedInAuthRepo()}>
          <Probe />
        </Wrapper>,
      )
    })

    await act(async () => {
      screen.getByText('do-logout').click()
    })

    expect(window.localStorage.getItem(STORAGE_KEY_LOCKED)).toBeNull()
    expect(window.localStorage.getItem('bb-pos-last-barber-id')).toBeNull()
    expect(screen.getByTestId('auth').textContent).toBe('anon')
    expect(screen.getByTestId('locked').textContent).toBe('unlocked')
  })
})
