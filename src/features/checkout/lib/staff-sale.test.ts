import { describe, it, expect } from 'vitest'
import {
  needsVariant,
  quotaView,
  staffCartSummary,
  staffLineMessage,
  staffLineView,
  unitsQuotaMessage,
  type StaffSummaryLine,
} from './staff-sale'
import type {
  CatalogProduct,
  CatalogProductVariant,
  StaffSaleQuota,
} from '../domain/checkout.types'

/* ── Factories cortas ── */

function variant(
  id: string,
  priceCents: number,
  staffPriceCents: number | null = null,
): CatalogProductVariant {
  return { id, priceCents, staffPriceCents }
}

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: 'p1',
    name: 'Pomada',
    sku: null,
    priceCents: 200_00,
    imageUrl: null,
    categoryId: null,
    sortOrder: 0,
    staffSaleEligible: true,
    staffPriceCents: 120_00,
    variants: [variant('v1', 200_00, 120_00)],
    ...overrides,
  }
}

/** Línea de producto en modo staff (trae precio público congelado). */
function staffLine(
  itemId: string,
  unitPriceCents: number,
  listUnitPriceCents: number,
  qty = 1,
): StaffSummaryLine {
  return { kind: 'product', itemId, qty, unitPriceCents, listUnitPriceCents }
}

function quota(overrides: Partial<StaffSaleQuota> = {}): StaffSaleQuota {
  return {
    enabled: true,
    allowServicesInTicket: true,
    unitsUsed: 0,
    unitsLimit: null,
    unitsRemaining: null,
    listAmountCentsUsed: 0,
    listAmountCentsLimit: null,
    listAmountCentsRemaining: null,
    perProductLimit: null,
    unitsByProduct: [],
    ...overrides,
  }
}

describe('staffLineView', () => {
  it('producto elegible: precio staff del producto y público tachado', () => {
    expect(staffLineView(product())).toEqual({
      eligible: true,
      unitPriceCents: 120_00,
      listUnitPriceCents: 200_00,
    })
  })

  it('producto no elegible: reason NOT_ELIGIBLE y sin precio staff (nunca $0)', () => {
    const view = staffLineView(product({ staffSaleEligible: false }))
    expect(view.eligible).toBe(false)
    expect(view.reason).toBe('NOT_ELIGIBLE')
    expect(view.unitPriceCents).toBeNull()
    // El público se sigue pintando: es el precio al que sí se puede vender.
    expect(view.listUnitPriceCents).toBe(200_00)
  })

  it('elegible pero sin precio staff resuelto: tampoco se puede vender a staff', () => {
    const view = staffLineView(
      product({ staffPriceCents: null, variants: [variant('v1', 200_00, null)] }),
    )
    expect(view).toEqual({
      eligible: false,
      reason: 'NOT_ELIGIBLE',
      unitPriceCents: null,
      listUnitPriceCents: 200_00,
    })
  })

  it('variante obligatoria sin elegir: NEEDS_VARIANT y sin precio', () => {
    const p = product({
      variants: [variant('v1', 200_00, 120_00), variant('v2', 300_00, 180_00)],
    })
    const view = staffLineView(p, null)
    expect(view.eligible).toBe(false)
    expect(view.reason).toBe('NEEDS_VARIANT')
    expect(view.unitPriceCents).toBeNull()
  })

  it('con la variante elegida manda el precio de ESA variante', () => {
    const p = product({
      variants: [variant('v1', 200_00, 120_00), variant('v2', 300_00, 180_00)],
    })
    expect(staffLineView(p, 'v2')).toEqual({
      eligible: true,
      unitPriceCents: 180_00,
      listUnitPriceCents: 300_00,
    })
  })

  it('un variantId desconocido cuenta como ninguna elegida', () => {
    const p = product({
      variants: [variant('v1', 200_00, 120_00), variant('v2', 300_00, 180_00)],
    })
    expect(staffLineView(p, 'no-existe').reason).toBe('NEEDS_VARIANT')
  })

  it('no elegible gana sobre falta de variante', () => {
    const p = product({
      staffSaleEligible: false,
      variants: [variant('v1', 200_00, 120_00), variant('v2', 300_00, 180_00)],
    })
    expect(staffLineView(p, null).reason).toBe('NOT_ELIGIBLE')
  })

  it('variante sin precio staff cae al del producto; si tampoco hay, NOT_ELIGIBLE', () => {
    const conProducto = product({
      staffPriceCents: 90_00,
      variants: [variant('v1', 200_00, null), variant('v2', 300_00, 180_00)],
    })
    expect(staffLineView(conProducto, 'v1')).toEqual({
      eligible: true,
      unitPriceCents: 90_00,
      listUnitPriceCents: 200_00,
    })

    const sinNada = product({
      staffPriceCents: null,
      variants: [variant('v1', 200_00, null), variant('v2', 300_00, 180_00)],
    })
    expect(staffLineView(sinNada, 'v1').reason).toBe('NOT_ELIGIBLE')
  })
})

describe('needsVariant', () => {
  it('con una sola variante (o ninguna) no hay nada que elegir', () => {
    expect(needsVariant(product())).toBe(false)
    expect(needsVariant(product({ variants: [] }))).toBe(false)
  })

  it('variantes idénticas en ambos precios: intercambiables', () => {
    const p = product({
      variants: [variant('v1', 200_00, 120_00), variant('v2', 200_00, 120_00)],
    })
    expect(needsVariant(p)).toBe(false)
  })

  it('difieren en precio staff', () => {
    const p = product({
      variants: [variant('v1', 200_00, 120_00), variant('v2', 200_00, 150_00)],
    })
    expect(needsVariant(p)).toBe(true)
  })

  it('difieren solo en precio público (el tope de monto se mide ahí)', () => {
    const p = product({
      variants: [variant('v1', 200_00, 120_00), variant('v2', 300_00, 120_00)],
    })
    expect(needsVariant(p)).toBe(true)
  })

  it('una variante sin precio staff y otra con él también obliga a elegir', () => {
    const p = product({
      variants: [variant('v1', 200_00, null), variant('v2', 200_00, 120_00)],
    })
    expect(needsVariant(p)).toBe(true)
  })
})

describe('staffCartSummary', () => {
  it('suma solo las líneas de producto en modo staff y saca el descuento', () => {
    const lines: StaffSummaryLine[] = [
      staffLine('p1', 120_00, 200_00, 2),
      staffLine('p2', 80_00, 100_00),
    ]
    expect(staffCartSummary(lines)).toEqual({
      listTotalCents: 500_00,
      staffTotalCents: 320_00,
      discountCents: 180_00,
    })
  })

  it('servicios y combos del mismo ticket no entran al descuento', () => {
    const lines: StaffSummaryLine[] = [
      staffLine('p1', 120_00, 200_00),
      { kind: 'service', itemId: 's1', qty: 1, unitPriceCents: 250_00 },
      { kind: 'combo', itemId: 'c1', qty: 1, unitPriceCents: 400_00 },
      // Ni siquiera si vinieran marcadas con precio público.
      { kind: 'service', itemId: 's2', qty: 1, unitPriceCents: 250_00, listUnitPriceCents: 300_00 },
    ]
    expect(staffCartSummary(lines)).toEqual({
      listTotalCents: 200_00,
      staffTotalCents: 120_00,
      discountCents: 80_00,
    })
  })

  it('un producto a precio normal (sin precio público congelado) no cuenta', () => {
    const lines: StaffSummaryLine[] = [
      { kind: 'product', itemId: 'p9', qty: 3, unitPriceCents: 200_00 },
      { kind: 'product', itemId: 'p8', qty: 1, unitPriceCents: 200_00, listUnitPriceCents: null },
    ]
    expect(staffCartSummary(lines)).toEqual({
      listTotalCents: 0,
      staffTotalCents: 0,
      discountCents: 0,
    })
  })

  it('la propina no es una línea: no hay manera de que entre al descuento', () => {
    const lines: StaffSummaryLine[] = [staffLine('p1', 120_00, 200_00)]
    // El resumen solo recibe líneas; Cart.tipCents vive aparte y no se toca.
    expect(staffCartSummary(lines).staffTotalCents).toBe(120_00)
    expect(staffCartSummary([])).toEqual({
      listTotalCents: 0,
      staffTotalCents: 0,
      discountCents: 0,
    })
  })

  it('un precio staff por encima del público no genera descuento negativo', () => {
    expect(staffCartSummary([staffLine('p1', 250_00, 200_00)]).discountCents).toBe(0)
  })
})

describe('quotaView', () => {
  const cart = [staffLine('p1', 120_00, 200_00, 2)]

  it('sin topes: restante null y nunca excede', () => {
    const view = quotaView(quota(), cart)
    expect(view.units).toEqual({ used: 0, inCart: 2, limit: null, remaining: null, exceeded: false })
    expect(view.listAmountCents.remaining).toBeNull()
    expect(view.perProduct[0]).toEqual({
      productId: 'p1',
      used: 0,
      inCart: 2,
      limit: null,
      remaining: null,
      exceeded: false,
    })
    expect(view.exceeded).toBe(false)
  })

  it('tope de unidades en el borde: llegar al límite NO excede', () => {
    const view = quotaView(
      quota({ unitsUsed: 4, unitsLimit: 6, unitsRemaining: 2 }),
      cart,
    )
    expect(view.units).toEqual({ used: 4, inCart: 2, limit: 6, remaining: 0, exceeded: false })
    expect(view.exceeded).toBe(false)
  })

  it('una unidad más sí excede, y el restante muestra el excedente', () => {
    const view = quotaView(
      quota({ unitsUsed: 4, unitsLimit: 6, unitsRemaining: 2 }),
      [staffLine('p1', 120_00, 200_00, 3)],
    )
    expect(view.units.remaining).toBe(-1)
    expect(view.units.exceeded).toBe(true)
    expect(view.exceeded).toBe(true)
  })

  it('el restante del API manda sobre límite menos usado', () => {
    // Un ajuste/devolución puede dejar restante distinto de la resta simple.
    const view = quotaView(
      quota({ unitsUsed: 4, unitsLimit: 6, unitsRemaining: 5 }),
      cart,
    )
    expect(view.units.remaining).toBe(3)
  })

  it('el tope de monto se mide a precio PÚBLICO, no al staff', () => {
    const view = quotaView(
      quota({
        listAmountCentsUsed: 600_00,
        listAmountCentsLimit: 1000_00,
        listAmountCentsRemaining: 400_00,
      }),
      cart,
    )
    expect(view.listAmountCents.inCart).toBe(400_00)
    expect(view.listAmountCents.remaining).toBe(0)
    expect(view.listAmountCents.exceeded).toBe(false)
  })

  it('el tope de monto excedido marca el carrito completo', () => {
    const view = quotaView(
      quota({
        listAmountCentsUsed: 600_00,
        listAmountCentsLimit: 1000_00,
        listAmountCentsRemaining: 400_00,
      }),
      [staffLine('p1', 120_00, 200_00, 3)],
    )
    expect(view.listAmountCents.remaining).toBe(-200_00)
    expect(view.exceeded).toBe(true)
  })

  it('tope por producto: agrega las líneas del mismo producto y usa lo del mes', () => {
    const view = quotaView(
      quota({ perProductLimit: 3, unitsByProduct: [{ productId: 'p1', units: 1 }] }),
      [staffLine('p1', 120_00, 200_00), staffLine('p1', 120_00, 200_00), staffLine('p2', 80_00, 100_00)],
    )
    expect(view.perProduct.map((p) => p.productId)).toEqual(['p1', 'p2'])
    expect(view.perProduct[0]).toEqual({
      productId: 'p1',
      used: 1,
      inCart: 2,
      limit: 3,
      remaining: 0,
      exceeded: false,
    })
    // p2 no aparece en unitsByProduct: cuenta como 0 usado, no como sin dato.
    expect(view.perProduct[1].used).toBe(0)
    expect(view.exceeded).toBe(false)
  })

  it('tope por producto rebasado por uno solo de los productos', () => {
    const view = quotaView(
      quota({ perProductLimit: 2, unitsByProduct: [{ productId: 'p1', units: 2 }] }),
      [staffLine('p1', 120_00, 200_00)],
    )
    expect(view.perProduct[0].remaining).toBe(-1)
    expect(view.perProduct[0].exceeded).toBe(true)
    expect(view.exceeded).toBe(true)
  })

  it('servicios y combos no consumen cupo', () => {
    const view = quotaView(
      quota({ unitsUsed: 0, unitsLimit: 1, unitsRemaining: 1 }),
      [
        staffLine('p1', 120_00, 200_00),
        { kind: 'service', itemId: 's1', qty: 4, unitPriceCents: 250_00 },
        { kind: 'combo', itemId: 'c1', qty: 4, unitPriceCents: 400_00 },
      ],
    )
    expect(view.units.inCart).toBe(1)
    expect(view.units.remaining).toBe(0)
    expect(view.perProduct.map((p) => p.productId)).toEqual(['p1'])
  })

  it('carrito vacío: el cupo se pinta tal como lo reporta el API', () => {
    const view = quotaView(quota({ unitsUsed: 5, unitsLimit: 6, unitsRemaining: 1 }), [])
    expect(view.units).toEqual({ used: 5, inCart: 0, limit: 6, remaining: 1, exceeded: false })
    expect(view.perProduct).toEqual([])
  })
})

describe('textos en español', () => {
  it('staffLineMessage devuelve el aviso de cada motivo y null si es elegible', () => {
    expect(staffLineMessage(staffLineView(product({ staffSaleEligible: false })))).toBe(
      'Este producto no está disponible para venta a staff',
    )
    const conVariantes = product({
      variants: [variant('v1', 200_00, 120_00), variant('v2', 300_00, 180_00)],
    })
    // INTERINO (T-050): sin selector de presentación en la UI, el aviso manda
    // a cobrar fuera del modo staff. Vuelve a "Elige la presentación" con T-033.
    expect(staffLineMessage(staffLineView(conVariantes))).toBe(
      'Aún no hay selector de presentación — cóbralo fuera del modo staff',
    )
    // El motivo (y con él el bloqueo del cobro) sigue siendo NEEDS_VARIANT.
    expect(staffLineView(conVariantes).reason).toBe('NEEDS_VARIANT')
    expect(staffLineMessage(staffLineView(product()))).toBeNull()
  })

  it('unitsQuotaMessage cuenta el mes más el carrito, y calla sin tope', () => {
    const conCarrito = quotaView(
      quota({ unitsUsed: 4, unitsLimit: 6, unitsRemaining: 2 }),
      [staffLine('p1', 120_00, 200_00)],
    )
    expect(unitsQuotaMessage(conCarrito.units)).toBe('Llevas 5 de 6 productos este mes')

    const sinCarrito = quotaView(quota({ unitsUsed: 5, unitsLimit: 6, unitsRemaining: 1 }), [])
    expect(unitsQuotaMessage(sinCarrito.units)).toBe('Llevas 5 de 6 productos este mes')

    expect(unitsQuotaMessage(quotaView(quota(), []).units)).toBeNull()
  })
})
