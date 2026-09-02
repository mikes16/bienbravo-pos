import { describe, it, expect } from 'vitest'
import { POS_TABS, visibleTabs, firstAllowedRoute, isRouteAllowed, activeTabFor } from './posTabs'

const ALL = POS_TABS.map((t) => t.permission)

describe('posTabs', () => {
  it('shows only the tabs whose permission the viewer has, in render order', () => {
    const tabs = visibleTabs(['pos.tab.register', 'pos.tab.today'])
    expect(tabs.map((t) => t.to)).toEqual(['/hoy', '/caja'])
  })

  it('shows all five tabs with the full permission set', () => {
    expect(visibleTabs(ALL).map((t) => t.label)).toEqual(['Reloj', 'Hoy', 'Mis ventas', 'Ventas del día', 'Caja'])
  })

  it('hides "Ventas del día" without pos.sales.day.read even with every other tab', () => {
    const tabs = visibleTabs(ALL.filter((p) => p !== 'pos.sales.day.read'))
    expect(tabs.find((t) => t.to === '/ventas-dia')).toBeUndefined()
  })

  it('firstAllowedRoute is the first visible tab, null when none', () => {
    expect(firstAllowedRoute(ALL)).toBe('/reloj')
    expect(firstAllowedRoute(['pos.tab.my_sales'])).toBe('/mis-ventas')
    expect(firstAllowedRoute(['pos.sale.create'])).toBeNull()
  })

  it('isRouteAllowed gates the canonical and alias paths of a tab', () => {
    expect(isRouteAllowed('/caja/cerrar', ['pos.tab.register'])).toBe(true)
    expect(isRouteAllowed('/register', ['pos.tab.today'])).toBe(false)
    expect(isRouteAllowed('/day-sales', ['pos.tab.today'])).toBe(false)
    expect(isRouteAllowed('/day-sales', ['pos.sales.day.read'])).toBe(true)
    // Checkout vive bajo Hoy.
    expect(isRouteAllowed('/checkout', ['pos.tab.today'])).toBe(true)
  })

  it('does not gate paths outside every tab', () => {
    expect(isRouteAllowed('/dev/hello-pos', [])).toBe(true)
  })

  it('activeTabFor maps aliases to the tab `to`', () => {
    expect(activeTabFor('/my-day')).toBe('/mis-ventas')
    expect(activeTabFor('/clock')).toBe('/reloj')
    expect(activeTabFor('/day-sales')).toBe('/ventas-dia')
    expect(activeTabFor('/nope')).toBeNull()
  })
})
