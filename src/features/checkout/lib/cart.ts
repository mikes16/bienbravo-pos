interface CustomerLite {
  id: string
  fullName: string
}

export type CartLineKind = 'service' | 'product' | 'combo'

export interface CartLineItem {
  kind: CartLineKind
  itemId: string
  name: string
  unitPriceCents: number
  // categoryId del servicio / producto. Lo guardamos en cart para que el
  // compute local de cupones (scope CATEGORY) pueda filtrar sin volver al
  // backend en cada cambio del carrito. Null si el item no tiene categoría
  // o es un combo.
  categoryId?: string | null
}

export interface CartLine extends CartLineItem {
  id: string
  qty: number
  staffUserId: string | null
}

export interface CartState {
  customer: CustomerLite | null
  defaultBarberId: string
  lines: CartLine[]
}

export type CartAction =
  // lineId opcional: cuando el caller necesita conocer el id de la línea de
  // antemano (para encadenar una corrección de precio por barbero, ver
  // addCatalogItem en useCheckout). Si no se pasa, el reducer genera uno.
  | { type: 'add'; item: CartLineItem; lineId?: string }
  | { type: 'incQty'; lineId: string }
  | { type: 'decQty'; lineId: string }
  | { type: 'removeLine'; lineId: string }
  | { type: 'setLineBarber'; lineId: string; staffUserId: string }
  | { type: 'setLineBarberAndPrice'; lineId: string; staffUserId: string; unitPriceCents: number }
  | { type: 'setDefaultBarber'; staffUserId: string }
  | { type: 'setCustomer'; customer: CustomerLite | null }
  | { type: 'clear' }

let nextId = 0
function uid(): string {
  return `line-${++nextId}`
}

export function initialCart(defaultBarberId: string): CartState {
  return { customer: null, defaultBarberId, lines: [] }
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const line: CartLine = {
        id: action.lineId ?? uid(),
        kind: action.item.kind,
        itemId: action.item.itemId,
        name: action.item.name,
        qty: 1,
        unitPriceCents: action.item.unitPriceCents,
        staffUserId: state.defaultBarberId,
        categoryId: action.item.categoryId ?? null,
      }
      return { ...state, lines: [...state.lines, line] }
    }
    case 'incQty':
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.id === action.lineId ? { ...l, qty: l.qty + 1 } : l,
        ),
      }
    case 'decQty':
      return {
        ...state,
        lines: state.lines
          .map((l) => (l.id === action.lineId ? { ...l, qty: l.qty - 1 } : l))
          .filter((l) => l.qty > 0),
      }
    case 'removeLine':
      return { ...state, lines: state.lines.filter((l) => l.id !== action.lineId) }
    case 'setLineBarber':
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.id === action.lineId ? { ...l, staffUserId: action.staffUserId } : l,
        ),
      }
    case 'setLineBarberAndPrice':
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.id === action.lineId
            ? { ...l, staffUserId: action.staffUserId, unitPriceCents: action.unitPriceCents }
            : l,
        ),
      }
    case 'setDefaultBarber':
      return { ...state, defaultBarberId: action.staffUserId }
    case 'setCustomer':
      return { ...state, customer: action.customer }
    case 'clear':
      return { ...state, customer: null, lines: [] }
  }
}

export interface CartTotals {
  subtotalCents: number
}

export function computeTotals(lines: CartLine[]): CartTotals {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0)
  return { subtotalCents }
}

/* ── A1: "solo cobrar acreditando a barberos con turno iniciado" ── */

export interface AvailableBarberInfo {
  id: string
  // undefined = sin info (se permite, mismo criterio que el picker de UI en
  // BarberPickerInline/BarberSelectorSheet); false = sin turno iniciado
  // (bloqueado).
  hasClockedIn?: boolean
}

/**
 * Todos los staffUserId que quedarían acreditados si el carrito se cobrara
 * tal cual está: el barbero default (fallback para líneas sin override) +
 * los overrides por línea. Usado por `findUnavailableCreditedBarberId` para
 * re-validar contra el snapshot de barberos disponibles justo antes de
 * cobrar.
 */
export function creditedBarberIds(state: CartState): string[] {
  const defaultId = state.defaultBarberId || null
  const ids = new Set<string>()
  if (defaultId) ids.add(defaultId)
  for (const line of state.lines) {
    const id = line.staffUserId ?? defaultId
    if (id) ids.add(id)
  }
  return [...ids]
}

/**
 * El picker de UI (BarberPickerInline/BarberSelectorSheet) ya bloquea la
 * SELECCIÓN de un barbero sin turno iniciado, pero eso es solo un gate de UX
 * en el momento de elegir — no protege contra un barbero que ficha salida
 * DESPUÉS de haber sido asignado a una línea (o un default pre-llenado desde
 * un walk-in cuyo `assignedStaffUser` ya no tiene turno activo) y ANTES de
 * que el cajero confirme el pago. Esta función re-valida en el momento de
 * cobrar.
 *
 * Devuelve el primer staffUserId acreditado que no aparece en
 * `availableBarbers` con `hasClockedIn !== false`, o `null` si la venta
 * puede cobrarse tal cual. Un barbero que ya no aparece en el roster también
 * cuenta como no disponible — no podemos confirmar que tiene turno activo.
 */
export function findUnavailableCreditedBarberId(
  state: CartState,
  availableBarbers: AvailableBarberInfo[],
): string | null {
  const byId = new Map(availableBarbers.map((b) => [b.id, b]))
  for (const id of creditedBarberIds(state)) {
    const barber = byId.get(id)
    if (!barber || barber.hasClockedIn === false) return id
  }
  return null
}
