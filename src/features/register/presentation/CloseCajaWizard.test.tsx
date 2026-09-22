import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CloseCajaWizard } from './CloseCajaWizard'
import { renderWithProviders } from '@/test/helpers/renderWithProviders'
import { createMockRepositories, InMemoryAuthRepository, MOCK_VIEWER } from '@/test/mocks/repositories'

class TestAuthRepo extends InMemoryAuthRepository {
  override async getViewer() {
    return MOCK_VIEWER
  }
}

const SESSION = {
  id: 'sess-1',
  status: 'OPEN' as const,
  openedAt: '2026-05-04T09:15:00.000Z',
  closedAt: null,
  openingCashCents: 50000,
  expectedCashCents: 184000,
  expectedCardCents: 254000,
  expectedTransferCents: 126000,
  countedCashCents: null,
  countedCardCents: null,
  countedTransferCents: null,
}

// Recorre los 3 pasos del wizard hasta dejar el CTA final "Cerrar caja" listo
// para el submit. Reutilizado por los tests de éxito/fallo del cierre.
async function advanceToFinalClose(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText(/cuenta el efectivo/i)
  await user.click(screen.getByRole('button', { name: /siguiente/i }))
  await screen.findByText(/confirma los totales digitales/i)
  await user.click(screen.getByRole('button', { name: /sí, \$2,540/i }))
  await user.click(screen.getByRole('button', { name: /revisar/i }))
  await screen.findByText(/revisa el resumen/i)
  await user.click(screen.getByRole('checkbox'))
}

const OPEN_REGISTERS = [
  { id: 'reg-a', name: 'Caja', isActive: true, locationId: 'loc1', openSession: SESSION },
]

/**
 * Otra lectura de la MISMA caja con montos distintos: lo que devuelve el
 * servidor cuando otra terminal cobró a media captura del corte.
 */
function registersWith(overrides: Partial<typeof SESSION>) {
  return [{ ...OPEN_REGISTERS[0], openSession: { ...SESSION, ...overrides } }]
}

function makeRepos() {
  const repos = createMockRepositories()
  repos.register.getRegisters = vi.fn().mockResolvedValue(OPEN_REGISTERS)
  repos.register.closeSession = vi.fn().mockResolvedValue({ ...SESSION, status: 'CLOSED' })
  return repos
}

describe('CloseCajaWizard', () => {
  beforeEach(() => {
    window.localStorage.setItem('bb-pos-location-id', 'loc1')
  })

  // El corte es el momento más caro del día: cerrar contra un esperado viejo
  // descuadra la caja de la sucursal. Mientras la lectura no vuelva de la red
  // (o si vuelve mal) el asistente NO arranca.
  it('carga sin responder: esqueleto, sin pasos ni CTA', async () => {
    const repos = makeRepos()
    let resolveLoad!: (value: typeof OPEN_REGISTERS) => void
    repos.register.getRegisters = vi
      .fn()
      .mockReturnValue(new Promise<typeof OPEN_REGISTERS>((res) => { resolveLoad = res }))

    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...repos, auth: new TestAuthRepo() },
    })

    expect(await screen.findByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText(/cuenta el efectivo/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /siguiente/i })).not.toBeInTheDocument()

    await act(async () => {
      resolveLoad(OPEN_REGISTERS)
    })
    expect(await screen.findByText(/cuenta el efectivo/i)).toBeInTheDocument()
  })

  it('carga fallida: aviso explicado y el corte NO arranca', async () => {
    const repos = makeRepos()
    repos.register.getRegisters = vi.fn().mockRejectedValue(new Error('network down'))

    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...repos, auth: new TestAuthRepo() },
    })

    // (a) Se explica por qué no se puede cortar (antes: pantalla en blanco).
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se pudo confirmar el estado de la caja. Revisa la conexión.')
    // (b) Ningún paso ni CTA: no hay forma de avanzar ni de enviar el cierre.
    expect(screen.queryByText(/cuenta el efectivo/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /siguiente/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /cerrar caja/i })).not.toBeInTheDocument()
    // (c) Las dos salidas: reintentar la carga o volver a Caja.
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /volver a caja/i })).toBeInTheDocument()
  })

  it('Reintentar con la carga ya exitosa: el wizard arranca normal', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    repos.register.getRegisters = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue(OPEN_REGISTERS)

    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...repos, auth: new TestAuthRepo() },
    })

    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: /reintentar/i }))

    expect(await screen.findByText(/cuenta el efectivo/i)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // Y el corte ya se puede recorrer de verdad.
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(await screen.findByText(/confirma los totales digitales/i)).toBeInTheDocument()
  })

  it('starts at step 1 (count cash)', async () => {
    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...makeRepos(), auth: new TestAuthRepo() },
    })
    expect(await screen.findByText(/cuenta el efectivo/i)).toBeInTheDocument()
  })

  it('next button advances to step 2', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...makeRepos(), auth: new TestAuthRepo() },
    })
    // Wait for step 1 to be visible, then click the wizard CTA
    await screen.findByText(/cuenta el efectivo/i)
    const next = screen.getByRole('button', { name: /siguiente/i })
    await user.click(next)
    expect(await screen.findByText(/confirma los totales digitales/i)).toBeInTheDocument()
  })

  it('completing all steps invokes closeSession', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...repos, auth: new TestAuthRepo() },
    })

    // Step 1 → Step 2
    await screen.findByText(/cuenta el efectivo/i)
    await user.click(screen.getByRole('button', { name: /siguiente/i }))

    // Step 2: confirm tarjeta (Stripe transfer se auto-confirma sin
    // intervención del cajero, así que solo hay un botón de confirmación).
    await screen.findByText(/confirma los totales digitales/i)
    await user.click(screen.getByRole('button', { name: /sí, \$2,540/i }))
    // Advance to step 3
    await user.click(screen.getByRole('button', { name: /revisar/i }))

    // Step 3: ack large diff (cash counted = 0, expected = 184000 → big faltante)
    await screen.findByText(/revisa el resumen/i)
    await user.click(screen.getByRole('checkbox'))

    // Click final close
    await user.click(screen.getByRole('button', { name: /cerrar caja/i }))

    await waitFor(() => {
      expect(repos.register.closeSession).toHaveBeenCalled()
    })
  })

  it('éxito real: la mutation resuelve → muestra la pantalla de éxito', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await advanceToFinalClose(user)
    await user.click(screen.getByRole('button', { name: /cerrar caja/i }))
    // "regresando a Hoy" solo aparece en la pantalla de éxito.
    expect(await screen.findByText(/regresando a hoy/i)).toBeInTheDocument()
  })

  it('fallo del servidor: muestra el mensaje en español y NUNCA el éxito falso', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    // El server rechaza (caja ya cerrada desde admin). getRegisters sigue
    // devolviendo la sesión abierta → el wizard permanece y muestra el error
    // (no navega). Antes: el hook tragaba el error y el wizard mostraba
    // "✓ Caja cerrada" (éxito falso) y regresaba en loop.
    repos.register.closeSession = vi
      .fn()
      .mockRejectedValue(
        new Error('Esta caja ya fue cerrada (posiblemente desde el admin). Se actualizará la vista.'),
      )
    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...repos, auth: new TestAuthRepo() },
    })
    await advanceToFinalClose(user)
    await user.click(screen.getByRole('button', { name: /cerrar caja/i }))

    // (a) El mensaje del servidor en español es visible.
    expect(await screen.findByText(/ya fue cerrada/i)).toBeInTheDocument()
    // (b) NUNCA la pantalla de éxito falso.
    expect(screen.queryByText(/regresando a hoy/i)).not.toBeInTheDocument()
  })

  it('step 1 has no back button (nowhere to go)', async () => {
    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...makeRepos(), auth: new TestAuthRepo() },
    })
    await screen.findByText(/cuenta el efectivo/i)
    expect(screen.queryByRole('button', { name: /regresar/i })).not.toBeInTheDocument()
  })

  it('back button on step 2 returns to step 1 preserving cash counts', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...makeRepos(), auth: new TestAuthRepo() },
    })
    await screen.findByText(/cuenta el efectivo/i)
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    await screen.findByText(/confirma los totales digitales/i)
    await user.click(screen.getByRole('button', { name: /regresar/i }))
    expect(await screen.findByText(/cuenta el efectivo/i)).toBeInTheDocument()
  })

  it('back button on step 3 returns to step 2 preserving digital confirmations', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...makeRepos(), auth: new TestAuthRepo() },
    })
    await screen.findByText(/cuenta el efectivo/i)
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    await screen.findByText(/confirma los totales digitales/i)
    await user.click(screen.getByRole('button', { name: /sí, \$2,540/i }))
    await user.click(screen.getByRole('button', { name: /revisar/i }))
    await screen.findByText(/revisa el resumen/i)
    await user.click(screen.getByRole('button', { name: /regresar/i }))
    expect(await screen.findByText(/confirma los totales digitales/i)).toBeInTheDocument()
  })

  // La caja está VIVA dentro del asistente (useRegister escucha `sales` +
  // `register`, T-044/T-045). Stripe no tiene input: si el contado se congela
  // en el primer auto-relleno, un cobro de otra terminal deja una diferencia
  // fantasma que el cajero no puede corregir.
  it('Stripe cobrado en otra terminal a media captura: el contado sigue al esperado vivo', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    let current = OPEN_REGISTERS
    repos.register.getRegisters = vi.fn(async () => current)

    const { announce } = renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...repos, auth: new TestAuthRepo() },
    })

    await screen.findByText(/cuenta el efectivo/i)
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    await screen.findByText(/confirma los totales digitales/i)
    await user.click(screen.getByRole('button', { name: /sí, \$2,540/i }))

    // Otra terminal cobra $240 por Stripe: el esperado sube de $1,260 a $1,500.
    current = registersWith({ expectedTransferCents: 150000 })
    await announce('sales')

    // (a) Stripe sigue auto-confirmado con el esperado NUEVO: el paso no se
    // traba (no hay control que lo reconfirme) y el CTA sigue vivo.
    expect(screen.getByRole('button', { name: /revisar/i })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /revisar/i }))
    await screen.findByText(/revisa el resumen/i)
    // (b) Cero diferencia fantasma: el faltante es sólo el efectivo sin contar
    // ($1,840). Con el contado congelado en $1,260 sería $2,080.
    expect(screen.getByRole('alert')).toHaveTextContent('Faltante de $1,840')

    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /cerrar caja/i }))

    // (c) El cierre manda el contado VIGENTE, no el de cuando abrió el paso.
    await waitFor(() => {
      expect(repos.register.closeSession).toHaveBeenCalledWith(
        expect.objectContaining({ countedTransferCents: 150000 }),
      )
    })
  })

  it('la tarjeta ajustada a mano NO se pisa cuando llega una lectura nueva', async () => {
    const user = userEvent.setup()
    const repos = makeRepos()
    let current = OPEN_REGISTERS
    repos.register.getRegisters = vi.fn(async () => current)

    const { announce } = renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...repos, auth: new TestAuthRepo() },
    })

    await screen.findByText(/cuenta el efectivo/i)
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    await screen.findByText(/confirma los totales digitales/i)

    // El cajero cuenta la terminal física y captura $2,000 (hubo un reverso).
    await user.click(screen.getByRole('button', { name: /ajustar/i }))
    const input = screen.getByLabelText(/monto contado de tarjeta/i)
    await user.clear(input)
    await user.type(input, '2000')
    await user.click(screen.getByRole('button', { name: /guardar/i }))
    expect(screen.getByText(/confirmado: \$2,000/i)).toBeInTheDocument()

    // Llega una lectura nueva que mueve los dos esperados.
    current = registersWith({ expectedCardCents: 300000, expectedTransferCents: 150000 })
    await announce('sales')

    // La captura manual manda: ni el esperado nuevo ni el viejo la pisan.
    expect(screen.getByText(/confirmado: \$2,000/i)).toBeInTheDocument()
    expect(screen.queryByText(/confirmado: \$3,000/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /revisar/i }))
    await screen.findByText(/revisa el resumen/i)
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /cerrar caja/i }))

    await waitFor(() => {
      expect(repos.register.closeSession).toHaveBeenCalledWith(
        expect.objectContaining({ countedCardCents: 200000, countedTransferCents: 150000 }),
      )
    })
  })

  it('SIGUIENTE is disabled on step 1 when neither digital channel is confirmed', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CloseCajaWizard />, {
      initialRoute: '/caja/cerrar',
      repos: { ...makeRepos(), auth: new TestAuthRepo() },
    })
    // Advance from step 0 to step 1
    await screen.findByText(/cuenta el efectivo/i)
    await user.click(screen.getByRole('button', { name: /siguiente/i }))
    // We're now on step 1 (confirma totales digitales)
    await screen.findByText(/confirma los totales digitales/i)
    // The wizard CTA should now be disabled because both digitals are unconfirmed
    const cta = screen.getByRole('button', { name: /revisar/i })
    expect(cta).toBeDisabled()
  })
})
