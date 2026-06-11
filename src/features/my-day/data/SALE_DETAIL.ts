import { graphql } from '@/core/graphql/generated'

/**
 * Detalle completo de una venta para el bottom sheet de "Mi Día".
 *
 * Gated por el permiso `pos.sale.read` en el API — el resolver `sale(id)`
 * rechaza viewers sin ese permiso. El POS además gatea el tap client-side
 * (MyDayPage no hace la row clickable si el viewer no tiene el permiso),
 * pero la barrera real es server-side.
 *
 * Los nombres de campo se verificaron contra `schema.graphql` tras
 * `sync-schema`:
 *   - `Sale.payments` es `[PaymentTransaction!]` → `{ provider, amountCents }`
 *   - `Sale.couponApplications` es `[SaleCouponApplication!]`
 *     → `{ code, name, discountAmountCents }` (name nullable)
 *   - `SaleItem.name` es el ResolveField nuevo (String nullable)
 */
export const POS_SALE_DETAIL = graphql(`
  query PosSaleDetail($id: ID!) {
    sale(id: $id) {
      id
      createdAt
      subtotalCents
      taxTotalCents
      totalCents
      customer { id fullName }
      payments { provider amountCents }
      items { itemType qty unitPriceCents totalCents name staffUser { id fullName } }
      couponApplications { code name discountAmountCents }
    }
  }
`)
