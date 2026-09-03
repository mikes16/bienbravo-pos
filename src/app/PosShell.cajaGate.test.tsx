import { screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { Routes, Route } from 'react-router-dom'
import { PosShell } from './PosShell'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import {
  createMockRepositories,
  InMemoryAuthRepository,
  InMemoryRegisterRepository,
  MOCK_VIEWER,
} from '@/test/mocks/repositories'
import type { PosViewer } from '@/core/auth/auth.types'
import type { CajaStatus } from '@/features/register/domain/register.types'

const DAY_MS = 24 * 60 * 60 * 1000
const YESTERDAY = new Date(Date.now() - DAY_MS).toISOString()
const TODAY = new Date().toISOString()

function authWith(permissions: string[]) {
  const viewer: PosViewer = { ...MOCK_VIEWER, permissions }
  class Repo extends InMemoryAuthRepository {
    override async getViewer() {
      return viewer
    }
  }
  return new Repo()
}

/** Repo con estado mutable: el test cambia `status` y luego dispara el evento
 *  que debería re-verificar. Así la liberación se atribuye al evento y no a
 *  la re-verificación por cambio de ruta que hace el propio gate. */
class MutableCajaRepo extends InMemoryRegisterRepository {
  status: CajaStatus
  constructor(status: CajaStatus) {
    super()
    this.status = status
  }
  override async getCajaStatus(): Promise<CajaStatus> {
    return this.status
  }
}
function cajaRepo(status: CajaStatus) {
  return new MutableCajaRepo(status)
}

const CAN_CORTE = ['pos.tab.today', 'pos.tab.register', 'pos.register.open', 'pos.register.close']
const NO_CORTE = ['pos.tab.today', 'pos.tab.clock']

function renderShell(permissions: string[], register: InMemoryRegisterRepository, initialRoute = '/hoy') {
  renderWithProviders(
    <Routes>
      <Route element={<PosShell />}>
        <Route path="/hoy" element={<p>PAGE HOY</p>} />
        <Route path="/caja" element={<p>PAGE CAJA</p>} />
        <Route path="/reloj" element={<p>PAGE RELOJ</p>} />
      </Route>
    </Routes>,
    {
      repos: { ...createMockRepositories(), auth: authWith(permissions), register },
      initialRoute,
    },
  )
}

describe('PosShell caja gate (caja abierta de un día anterior)', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc-1')
  })

  it('con permiso de corte: manda a Caja, muestra el aviso y esconde los tabs', async () => {
    renderShell(CAN_CORTE, cajaRepo({ isOpen: true, isStale: true, openedAt: YESTERDAY }))
    expect(await screen.findByText('PAGE CAJA')).toBeInTheDocument()
    expect(screen.queryByText('PAGE HOY')).not.toBeInTheDocument()
    expect(screen.getByText(/corte pendiente/i)).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('sin permiso de corte: bloquea todo y pide buscar a un encargado', async () => {
    renderShell(NO_CORTE, cajaRepo({ isOpen: true, isStale: true, openedAt: YESTERDAY }))
    expect(await screen.findByText(/pide a un encargado/i)).toBeInTheDocument()
    expect(screen.queryByText('PAGE HOY')).not.toBeInTheDocument()
    expect(screen.queryByText('PAGE CAJA')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('caja abierta hoy: no bloquea nada', async () => {
    renderShell(CAN_CORTE, cajaRepo({ isOpen: true, isStale: false, openedAt: TODAY }))
    expect(await screen.findByText('PAGE HOY')).toBeInTheDocument()
    expect(screen.queryByText(/corte pendiente/i)).not.toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('caja cerrada: no bloquea nada (Hoy ya pide abrirla)', async () => {
    renderShell(CAN_CORTE, cajaRepo({ isOpen: false, isStale: false, openedAt: null }))
    expect(await screen.findByText('PAGE HOY')).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('se libera al re-verificar (p. ej. al volver el foco) cuando la caja ya se cerró', async () => {
    const repo = cajaRepo({ isOpen: true, isStale: true, openedAt: YESTERDAY })
    renderShell(CAN_CORTE, repo)
    expect(await screen.findByText(/corte pendiente/i)).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()

    repo.status = { isOpen: false, isStale: false, openedAt: null }
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    expect(await screen.findByRole('navigation')).toBeInTheDocument()
    expect(screen.queryByText(/corte pendiente/i)).not.toBeInTheDocument()
  })

  it('si la verificación falla, no atrapa al operador (fail-open)', async () => {
    class Broken extends InMemoryRegisterRepository {
      override async getCajaStatus(): Promise<CajaStatus> {
        throw new Error('network')
      }
    }
    renderShell(CAN_CORTE, new Broken())
    expect(await screen.findByText('PAGE HOY')).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
