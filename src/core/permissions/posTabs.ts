import type { ComponentType, SVGProps } from 'react'
import {
  StopwatchIcon,
  GameCalendarIcon,
  TwoCoinsIcon,
  ReceiptIcon,
  StrongboxIcon,
} from '@/shared/pos-ui/icons'

export interface PosTabConfig {
  /** Path del tab (el que navega BottomTabNav). */
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Permiso que habilita ver el tab. Sin él, el tab no existe para el viewer. */
  permission: string
  /** Prefijos de path que "pertenecen" a este tab (para activo + guard). */
  paths: string[]
}

/**
 * Tabs inferiores del POS, en orden de render. Cada tab se muestra solo si el
 * viewer tiene su permiso (ver docs/PERMISSIONS.md, sección POS). Los 4 tabs
 * originales son gate de UI (las operaciones detrás ya están protegidas por
 * `pos.register.*`, `pos.sale.*`…); "Ventas del día" expone ventas ajenas,
 * así que su permiso también lo exige el API en `posDaySales`.
 */
export const POS_TABS: readonly PosTabConfig[] = [
  { to: '/reloj', label: 'Reloj', icon: StopwatchIcon, permission: 'pos.tab.clock', paths: ['/reloj', '/clock'] },
  { to: '/hoy', label: 'Hoy', icon: GameCalendarIcon, permission: 'pos.tab.today', paths: ['/hoy', '/home', '/checkout', '/agenda', '/walkins'] },
  { to: '/mis-ventas', label: 'Mis ventas', icon: TwoCoinsIcon, permission: 'pos.tab.my_sales', paths: ['/mis-ventas', '/my-day'] },
  { to: '/ventas-dia', label: 'Ventas del día', icon: ReceiptIcon, permission: 'pos.sales.day.read', paths: ['/ventas-dia', '/day-sales'] },
  { to: '/caja', label: 'Caja', icon: StrongboxIcon, permission: 'pos.tab.register', paths: ['/caja', '/register'] },
]

export function visibleTabs(permissions: readonly string[]): PosTabConfig[] {
  return POS_TABS.filter((t) => permissions.includes(t.permission))
}

/** Primer tab permitido (destino post-login y del guard). null si no hay ninguno. */
export function firstAllowedRoute(permissions: readonly string[]): string | null {
  return visibleTabs(permissions)[0]?.to ?? null
}

function tabForPath(path: string): PosTabConfig | undefined {
  return POS_TABS.find((t) => t.paths.some((p) => path === p || path.startsWith(`${p}/`)))
}

/** `to` del tab activo para un path, o null si el path no pertenece a ningún tab. */
export function activeTabFor(path: string): string | null {
  return tabForPath(path)?.to ?? null
}

/**
 * Un path se permite si pertenece a un tab que el viewer tiene. Paths que no
 * pertenecen a ningún tab (p.ej. /dev/*) no se gatean aquí.
 */
export function isRouteAllowed(path: string, permissions: readonly string[]): boolean {
  const tab = tabForPath(path)
  if (!tab) return true
  return permissions.includes(tab.permission)
}
