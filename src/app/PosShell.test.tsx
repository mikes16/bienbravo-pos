import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Routes, Route, Navigate } from 'react-router-dom'
import { PosShell } from './PosShell'
import { RefreshOnUnlock } from './Providers'
import { FreshnessContext, type FreshnessContextValue } from '@/core/freshness/FreshnessProvider'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'
import type { PosViewer } from '@/core/auth/auth.types'

function authWith(permissions: string[]) {
  const viewer: PosViewer = { ...MOCK_VIEWER, permissions }
  class Repo extends InMemoryAuthRepository {
    override async getViewer() {
      return viewer
    }
  }
  return new Repo()
}

/** Contexto de frescura de mentira: el shell solo necesita que exista (el
 *  control "Actualizar" lo consume) y el test espía `refreshAll`. Con el
 *  provider real se abrirían suscripciones contra el MockedProvider. */
function freshnessValue(refreshAll: () => void): FreshnessContextValue {
  return {
    connection: 'connected',
    lastUpdatedAt: null,
    refreshAll,
    setPaused: () => {},
    register: () => () => {},
  }
}

/** Lock screen de mentira: como el real, sale a Hoy en cuanto la sesión deja
 *  de estar bloqueada. Así el test recorre bloqueado → desbloqueado igual que
 *  el POS (PosShell está DESMONTADO mientras el candado está puesto). */
function LockStub() {
  const { viewer, isLocked } = usePosAuth()
  if (viewer && !isLocked) return <Navigate to="/hoy" replace />
  return <p>PAGE LOCK</p>
}

/**
 * Arnés del desbloqueo: monta el observador (vive en Providers, por fuera del
 * shell) y da dos botones — "Desbloquear" hace las veces del PIN correcto y
 * "Re-render" fuerza re-renders sin tocar la sesión.
 */
function UnlockHarness() {
  const { unlock } = usePosAuth()
  const [renders, setRenders] = useState(0)
  return (
    <>
      <RefreshOnUnlock />
      <button type="button" onClick={unlock}>
        Desbloquear
      </button>
      <button type="button" onClick={() => setRenders((n) => n + 1)}>
        Re-render {renders}
      </button>
    </>
  )
}

function renderShell(permissions: string[], initialRoute = '/hoy', refreshAll: () => void = vi.fn()) {
  renderWithProviders(
    <FreshnessContext.Provider value={freshnessValue(refreshAll)}>
      <UnlockHarness />
      <Routes>
        <Route path="/" element={<LockStub />} />
        <Route element={<PosShell />}>
          <Route path="/hoy" element={<p>PAGE HOY</p>} />
          <Route path="/caja" element={<p>PAGE CAJA</p>} />
          <Route path="/day-sales" element={<p>PAGE VENTAS</p>} />
        </Route>
      </Routes>
    </FreshnessContext.Provider>,
    { repos: { ...createMockRepositories(), auth: authWith(permissions) }, initialRoute },
  )
}

describe('PosShell tab gating', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem('bb-pos-location-id', 'loc-1')
  })

  it('renders only the tabs the viewer has permission for', async () => {
    renderShell(['pos.tab.today', 'pos.tab.register'])
    expect(await screen.findByText('PAGE HOY')).toBeInTheDocument()
    const nav = screen.getByRole('navigation')
    expect(nav).toHaveTextContent('Hoy')
    expect(nav).toHaveTextContent('Caja')
    expect(nav).not.toHaveTextContent('Reloj')
    expect(nav).not.toHaveTextContent('Mis ventas')
    expect(nav).not.toHaveTextContent('Ventas del día')
  })

  it('shows "Ventas del día" with pos.sales.day.read', async () => {
    renderShell(['pos.tab.today', 'pos.sales.day.read'])
    await screen.findByText('PAGE HOY')
    expect(screen.getByRole('navigation')).toHaveTextContent('Ventas del día')
  })

  it('redirects a deep link to a forbidden tab to the first allowed one', async () => {
    renderShell(['pos.tab.register'], '/day-sales')
    expect(await screen.findByText('PAGE CAJA')).toBeInTheDocument()
    expect(screen.queryByText('PAGE VENTAS')).not.toBeInTheDocument()
  })

  it('explains when the role has no tab at all', async () => {
    renderShell(['pos.sale.create'])
    expect(await screen.findByText(/sin módulos habilitados/i)).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})

describe('PosShell frescura', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.localStorage.setItem('bb-pos-location-id', 'loc-1')
  })

  it('con sesión y sucursal, la barra trae el control "Actualizar datos"', async () => {
    renderShell(['pos.tab.today'])
    expect(await screen.findByText('PAGE HOY')).toBeInTheDocument()
    // Dentro de la barra superior (IdentityStripV2), no suelto en la página.
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: 'Actualizar datos' }),
    ).toBeInTheDocument()
  })

  it('desbloquear con PIN refresca todo UNA vez', async () => {
    const user = userEvent.setup()
    const refreshAll = vi.fn()
    window.localStorage.setItem('bb-pos-locked', 'true')
    renderShell(['pos.tab.today'], '/hoy', refreshAll)

    // Bloqueado: el shell se fue al lock screen y nadie refrescó nada.
    expect(await screen.findByText('PAGE LOCK')).toBeInTheDocument()
    expect(refreshAll).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Desbloquear' }))

    expect(await screen.findByText('PAGE HOY')).toBeInTheDocument()
    expect(refreshAll).toHaveBeenCalledTimes(1)

    // Seguir desbloqueado no vuelve a disparar: es por acción, no por render.
    await user.click(screen.getByRole('button', { name: /Re-render/ }))
    expect(refreshAll).toHaveBeenCalledTimes(1)
  })

  it('montar el shell ya desbloqueado no refresca nada', async () => {
    const user = userEvent.setup()
    const refreshAll = vi.fn()
    renderShell(['pos.tab.today'], '/hoy', refreshAll)

    expect(await screen.findByText('PAGE HOY')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Re-render/ }))
    expect(refreshAll).not.toHaveBeenCalled()
  })
})
