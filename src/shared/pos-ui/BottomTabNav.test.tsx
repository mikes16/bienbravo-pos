import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { BottomTabNav } from './BottomTabNav'
import { StopwatchIcon, GameCalendarIcon, TwoCoinsIcon, StrongboxIcon } from './icons'

const TABS = [
  { to: '/reloj', icon: StopwatchIcon, label: 'Reloj' },
  { to: '/hoy', icon: GameCalendarIcon, label: 'Hoy' },
  { to: '/mis-ventas', icon: TwoCoinsIcon, label: 'Mis ventas' },
  { to: '/caja', icon: StrongboxIcon, label: 'Caja', meta: '$2,840' },
]

describe('BottomTabNav', () => {
  it('renders all tab labels', () => {
    render(
      <MemoryRouter>
        <BottomTabNav tabs={TABS} activeTo="/hoy" />
      </MemoryRouter>,
    )
    expect(screen.getByText('Reloj')).toBeInTheDocument()
    expect(screen.getByText('Hoy')).toBeInTheDocument()
    expect(screen.getByText('Mis ventas')).toBeInTheDocument()
    expect(screen.getByText('Caja')).toBeInTheDocument()
  })

  it('renders meta line on tabs that have it', () => {
    render(
      <MemoryRouter>
        <BottomTabNav tabs={TABS} activeTo="/hoy" />
      </MemoryRouter>,
    )
    expect(screen.getByText('$2,840')).toBeInTheDocument()
  })

  it('marks the active tab with aria-current="page"', () => {
    render(
      <MemoryRouter>
        <BottomTabNav tabs={TABS} activeTo="/hoy" />
      </MemoryRouter>,
    )
    const hoyButton = screen.getByRole('button', { name: /hoy/i })
    expect(hoyButton).toHaveAttribute('aria-current', 'page')
  })

  it('non-active tabs do not have aria-current', () => {
    render(
      <MemoryRouter>
        <BottomTabNav tabs={TABS} activeTo="/hoy" />
      </MemoryRouter>,
    )
    const relojButton = screen.getByRole('button', { name: /reloj/i })
    expect(relojButton).not.toHaveAttribute('aria-current')
  })

  it('clicking a tab does not throw (smoke check for navigation)', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/hoy']}>
        <BottomTabNav tabs={TABS} activeTo="/hoy" />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: /reloj/i }))
    // Smoke: just verify no error
  })

  it('renders badge when present on a tab', () => {
    const tabsWithBadge = [
      ...TABS.slice(0, 1),
      { ...TABS[1], badge: 3 },
      ...TABS.slice(2),
    ]
    render(
      <MemoryRouter>
        <BottomTabNav tabs={tabsWithBadge} activeTo="/hoy" />
      </MemoryRouter>,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
