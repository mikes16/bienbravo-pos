import type { Cart, CartLine, CatalogItem, SaleItemInput } from './checkout.types.ts'

let nextId = 0
function uid(): string {
  return `line-${++nextId}`
}

export function createEmptyCart(): Cart {
  return { lines: [], tipCents: 0 }
}

export function addLine(cart: Cart, catalogItem: CatalogItem, qty = 1): Cart {
  const priceCents =
    catalogItem.kind === 'service'
      ? catalogItem.item.priceCents
      : catalogItem.item.priceCents

  const existing = cart.lines.find(
    (l) =>
      l.catalogItem.kind === catalogItem.kind &&
      l.catalogItem.item.id === catalogItem.item.id,
  )

  if (existing) {
    return {
      ...cart,
      lines: cart.lines.map((l) =>
        l.id === existing.id ? { ...l, qty: l.qty + qty } : l,
      ),
    }
  }

  const line: CartLine = {
    id: uid(),
    catalogItem,
    qty,
    unitPriceCents: priceCents,
  }
  return { ...cart, lines: [...cart.lines, line] }
}

export function removeLine(cart: Cart, lineId: string): Cart {
  return { ...cart, lines: cart.lines.filter((l) => l.id !== lineId) }
}

export function updateQty(cart: Cart, lineId: string, qty: number): Cart {
  if (qty <= 0) return removeLine(cart, lineId)
  return {
    ...cart,
    lines: cart.lines.map((l) => (l.id === lineId ? { ...l, qty } : l)),
  }
}

export function setTip(cart: Cart, tipCents: number): Cart {
  return { ...cart, tipCents: Math.max(0, tipCents) }
}

export function subtotalCents(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0)
}

export function totalCents(cart: Cart): number {
  return subtotalCents(cart) + cart.tipCents
}

export function lineCount(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.qty, 0)
}

export function cartToSaleItems(cart: Cart): SaleItemInput[] {
  const items: SaleItemInput[] = []
  for (const l of cart.lines) {
    if (l.catalogItem.kind === 'combo') {
      items.push({
        serviceId: null,
        productId: null,
        catalogComboId: l.catalogItem.item.id,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
      })
    } else {
      items.push({
        serviceId: l.catalogItem.kind === 'service' ? l.catalogItem.item.id : null,
        productId: l.catalogItem.kind === 'product' ? l.catalogItem.item.id : null,
        catalogComboId: null,
        qty: l.qty,
        unitPriceCents: l.unitPriceCents,
      })
    }
  }
  return items
}
