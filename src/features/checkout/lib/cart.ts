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
  | { type: 'add'; item: CartLineItem }
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
        id: uid(),
        kind: action.item.kind,
        itemId: action.item.itemId,
        name: action.item.name,
        qty: 1,
        unitPriceCents: action.item.unitPriceCents,
        staffUserId: state.defaultBarberId,
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
