import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { HoyView } from './HoyView'
import type { HoyViewModel } from './deriveHoyViewModel'

/** Nombre accesible de la cifra de comisiones (MoneyValue, [D-006]). */
const COMMISSION_LABEL = 'Comisiones hoy'

function makeVm(overrides: Partial<HoyViewModel> = {}): HoyViewModel {
  return {
    staffName: 'Eli Cruz',
    commission: { amountCents: 84500, serviceCount: 5, status: 'fresh', projectedCents: null },
    rows: [],
    cta: { variant: 'nueva-venta', actionLabel: 'Nueva venta' },
    cajaIsOpen: true,
    gate: null,
    ...overrides,
  }
}

describe('HoyView', () => {
  // R9: la identidad del operador se mudó a la barra superior
  // (IdentityStripV2, 28 px y persistente). Hoy ya no saluda ni repite el
  // nombre: era el dato chico que hacía que se cobrara en sesión ajena.
  it('does not greet the operator nor repeat their name', () => {
    render(
      <MemoryRouter>
        <HoyView vm={makeVm({ staffName: 'Eli Cruz García' })} onCtaClick={() => {}} onGateAction={() => {}} onAddWalkIn={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/hola/i)).toBeNull()
    expect(screen.queryByText(/eli cruz garcía/i)).toBeNull()
  })

  it('renders the commission amount as money with its accessible label', () => {
    render(
      <MemoryRouter>
        <HoyView vm={makeVm()} onCtaClick={() => {}} onGateAction={() => {}} onAddWalkIn={() => {}} />
      </MemoryRouter>,
    )
    // MoneyValue/MoneyDisplay parten "$" y el número en spans distintos: la
    // cifra se consulta por su nombre accesible ([D-006]), no por getByText.
    const figure = screen.getByRole('group', { name: COMMISSION_LABEL })
    expect(figure).toHaveTextContent('$845')
    expect(figure).not.toHaveAttribute('aria-busy')
  })

  it('shows pluralized service count', () => {
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({ commission: { amountCents: 84500, serviceCount: 5, status: 'fresh', projectedCents: null } })}
          onCtaClick={() => {}}
          onGateAction={() => {}} onAddWalkIn={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/5 servicios/i)).toBeInTheDocument()
  })

  it('shows positive copy on commission $0 (no depressing zero)', () => {
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({ commission: { amountCents: 0, serviceCount: 0, status: 'fresh', projectedCents: null } })}
          onCtaClick={() => {}}
          onGateAction={() => {}} onAddWalkIn={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/empezamos el día|empezando|0 servicios/i)).toBeInTheDocument()
  })

  it('renders empty list message when rows is empty', () => {
    render(
      <MemoryRouter>
        <HoyView vm={makeVm({ rows: [] })} onCtaClick={() => {}} onGateAction={() => {}} onAddWalkIn={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/todavía no tienes movimiento|sin actividad/i)).toBeInTheDocument()
  })

  it('renders rows when provided', () => {
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({
            rows: [
              {
                id: 'r1',
                kind: 'pending',
                timeLabel: '12:30',
                customerName: 'Pedro Soto',
                customerId: null,
                customerPhotoUrl: null,
                customerInitials: 'PS',
                serviceLabel: 'Corte + barba',
                meta: null,
                reputationMark: null,
                staffNote: null,
                customerReputationNote: null,
                pillLabel: 'Cita',
                pillTone: 'appt',
                sourceKind: 'appointment',
                sourceId: 'a1',
                isMine: true,
                assignedToName: null,
              },
            ],
          })}
          onCtaClick={() => {}}
          onGateAction={() => {}} onAddWalkIn={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Pedro Soto')).toBeInTheDocument()
  })

  it('renders the CTA button with action label', () => {
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({ cta: { variant: 'cobrar', actionLabel: 'Cobrar a Carlos' } })}
          onCtaClick={() => {}}
          onGateAction={() => {}} onAddWalkIn={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Cobrar a Carlos')).toBeInTheDocument()
  })

  it('CTA tap fires onCtaClick', async () => {
    const onCtaClick = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({ cta: { variant: 'nueva-venta', actionLabel: 'Nueva venta' } })}
          onCtaClick={onCtaClick}
          onGateAction={() => {}} onAddWalkIn={() => {}}
        />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: /nueva venta/i }))
    expect(onCtaClick).toHaveBeenCalledTimes(1)
  })

  it('rows are info-only (not rendered as buttons)', () => {
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({
            rows: [
              {
                id: 'r1',
                kind: 'pending',
                timeLabel: '12:30',
                customerName: 'Pedro', customerId: null,
                customerPhotoUrl: null,
                customerInitials: 'P',
                serviceLabel: 'corte',
                meta: null,
                reputationMark: null,
                staffNote: null,
                customerReputationNote: null,
                pillLabel: 'Cita',
                pillTone: 'appt',
                sourceKind: 'appointment',
                sourceId: 'a1',
                isMine: true,
                assignedToName: null,
              },
            ],
          })}
          onCtaClick={() => {}}
          onGateAction={() => {}} onAddWalkIn={() => {}}
        />
      </MemoryRouter>,
    )
    // Pedro's name is on screen but it's not a clickable button — only the
    // contextual CTA bar at the bottom is the interactive element.
    expect(screen.getByText('Pedro')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pedro/i })).toBeNull()
  })

  it('an unassigned appointment row ("Sin barbero") is tappable and fires onTakeAppointment', async () => {
    const onTakeAppointment = vi.fn()
    const user = userEvent.setup()
    const row = {
      id: 'r1',
      kind: 'pending' as const,
      timeLabel: '12:30',
      customerName: 'Ana Ruiz',
      customerId: null,
      customerPhotoUrl: null,
      customerInitials: 'AR',
      serviceLabel: 'Corte',
      meta: null,
      reputationMark: null,
      staffNote: null,
      customerReputationNote: null,
      pillLabel: 'Sin barbero',
      pillTone: 'walkin' as const,
      sourceKind: 'appointment' as const,
      sourceId: 'a1',
      isMine: false,
      assignedToName: null,
      isUnassignedAppt: true,
    }
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({ rows: [row] })}
          onCtaClick={() => {}}
          onGateAction={() => {}}
          onAddWalkIn={() => {}}
          onTakeAppointment={onTakeAppointment}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/sin barbero/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ana ruiz/i }))
    expect(onTakeAppointment).toHaveBeenCalledTimes(1)
    expect(onTakeAppointment).toHaveBeenCalledWith(row)
  })

  it('an assigned appointment row is NOT tappable even when onTakeAppointment is provided', () => {
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({
            rows: [
              {
                id: 'r1',
                kind: 'pending',
                timeLabel: '12:30',
                customerName: 'Pedro Soto',
                customerId: null,
                customerPhotoUrl: null,
                customerInitials: 'PS',
                serviceLabel: 'Corte',
                meta: null,
                reputationMark: null,
                staffNote: null,
                customerReputationNote: null,
                pillLabel: 'Cita',
                pillTone: 'appt',
                sourceKind: 'appointment',
                sourceId: 'a1',
                isMine: true,
                assignedToName: null,
                isUnassignedAppt: false,
              },
            ],
          })}
          onCtaClick={() => {}}
          onGateAction={() => {}}
          onAddWalkIn={() => {}}
          onTakeAppointment={vi.fn()}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Pedro Soto')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pedro soto/i })).toBeNull()
  })

  it('renders the gate when vm.gate is set, hiding the normal Hoy view', async () => {
    const onGateAction = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({ gate: { kind: 'clock-in' } })}
          onCtaClick={() => {}}
          onGateAction={onGateAction} onAddWalkIn={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(/inicia tu día/i)).toBeInTheDocument()
    expect(screen.queryByText(/comisiones hoy/i)).toBeNull()
    await user.click(screen.getByRole('button', { name: /reloj/i }))
    expect(onGateAction).toHaveBeenCalledTimes(1)
  })

  // Spec 2026-09-18 § 3.1b: una cifra de dinero cargando es esqueleto —
  // nunca "$0", nunca la cifra anterior, nunca un dígito inventado.
  it('commission while loading shows a skeleton without a single digit', () => {
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({ commission: { amountCents: null, serviceCount: null, status: 'loading', projectedCents: null } })}
          onCtaClick={() => {}}
          onGateAction={() => {}} onAddWalkIn={() => {}}
        />
      </MemoryRouter>,
    )
    const figure = screen.getByRole('group', { name: COMMISSION_LABEL })
    expect(figure).toHaveAttribute('aria-busy', 'true')
    expect(figure.textContent ?? '').not.toMatch(/\d/)
    expect(figure.textContent ?? '').not.toContain('$')
    // El pie tampoco puede decir "0 servicios": sería un conteo inventado.
    expect(screen.queryByText(/servicios/i)).toBeNull()
  })

  it('commission in error shows no previous amount and offers Reintentar', async () => {
    const onRetryCommission = vi.fn()
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({ commission: { amountCents: null, serviceCount: null, status: 'error', projectedCents: null } })}
          onCtaClick={() => {}}
          onGateAction={() => {}} onAddWalkIn={() => {}}
          onRetryCommission={onRetryCommission}
        />
      </MemoryRouter>,
    )
    const figure = screen.getByRole('group', { name: COMMISSION_LABEL })
    expect(figure).toHaveTextContent(/no se pudo cargar/i)
    expect(figure.textContent ?? '').not.toMatch(/\d/)
    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(onRetryCommission).toHaveBeenCalledTimes(1)
  })

  it('commission offline says so instead of showing a stale figure', () => {
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({ commission: { amountCents: null, serviceCount: null, status: 'offline', projectedCents: null } })}
          onCtaClick={() => {}}
          onGateAction={() => {}} onAddWalkIn={() => {}}
        />
      </MemoryRouter>,
    )
    const figure = screen.getByRole('group', { name: COMMISSION_LABEL })
    expect(figure).toHaveTextContent(/sin conexión/i)
    expect(figure.textContent ?? '').not.toMatch(/\d/)
  })

  it('a real $0 from the server is still painted as $0', () => {
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({ commission: { amountCents: 0, serviceCount: 0, status: 'fresh', projectedCents: null } })}
          onCtaClick={() => {}}
          onGateAction={() => {}} onAddWalkIn={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('group', { name: COMMISSION_LABEL })).toHaveTextContent('$0')
  })
})
