import { screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { Routes, Route } from 'react-router-dom'
import { PosShell } from './PosShell'
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

function renderShell(permissions: string[], initialRoute = '/hoy') {
  renderWithProviders(
    <Routes>
      <Route element={<PosShell />}>
        <Route path="/hoy" element={<p>PAGE HOY</p>} />
        <Route path="/caja" element={<p>PAGE CAJA</p>} />
        <Route path="/day-sales" element={<p>PAGE VENTAS</p>} />
      </Route>
    </Routes>,
    { repos: { ...createMockRepositories(), auth: authWith(permissions) }, initialRoute },
  )
}

describe('PosShell tab gating', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
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
