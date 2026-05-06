import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { HoyView } from './HoyView'
import type { HoyViewModel } from './deriveHoyViewModel'

function makeVm(overrides: Partial<HoyViewModel> = {}): HoyViewModel {
  return {
    staffName: 'Eli Cruz',
    commission: { amountCents: 84500, serviceCount: 5, loading: false, projectedCents: null },
    rows: [],
    cta: { variant: 'nueva-venta', actionLabel: 'Nueva venta' },
    cajaIsOpen: true,
    gate: null,
    ...overrides,
  }
}

describe('HoyView', () => {
  it('renders greeting with first name only', () => {
    render(
      <MemoryRouter>
        <HoyView vm={makeVm({ staffName: 'Eli Cruz García' })} onCtaClick={() => {}} onGateAction={() => {}} onAddWalkIn={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText(/eli/i)).toBeInTheDocument()
  })

  it('renders commission amount with formatMoney', () => {
    render(
      <MemoryRouter>
        <HoyView vm={makeVm()} onCtaClick={() => {}} onGateAction={() => {}} onAddWalkIn={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByText('$845')).toBeInTheDocument()
  })

  it('shows pluralized service count', () => {
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({ commission: { amountCents: 84500, serviceCount: 5, loading: false, projectedCents: null } })}
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
          vm={makeVm({ commission: { amountCents: 0, serviceCount: 0, loading: false, projectedCents: null } })}
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
                pillLabel: 'Cita',
                pillTone: 'appt',
                sourceKind: 'appointment',
                sourceId: 'a1',
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
                pillLabel: 'Cita',
                pillTone: 'appt',
                sourceKind: 'appointment',
                sourceId: 'a1',
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

  it('shows loading state in commission when loading=true', () => {
    render(
      <MemoryRouter>
        <HoyView
          vm={makeVm({ commission: { amountCents: 0, serviceCount: 0, loading: true, projectedCents: null } })}
          onCtaClick={() => {}}
          onGateAction={() => {}} onAddWalkIn={() => {}}
        />
      </MemoryRouter>,
    )
    // Loading dash or skeleton — check for "—" or absence of "$0"
    expect(screen.getByText(/—|cargando/i)).toBeInTheDocument()
  })
})
