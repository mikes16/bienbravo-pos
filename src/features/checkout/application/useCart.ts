import { useState, useCallback } from 'react'
import type { Cart, CatalogItem } from '../domain/checkout.types.ts'
import * as cartService from '../domain/cart.service.ts'

export function useCart() {
  const [cart, setCart] = useState<Cart>(cartService.createEmptyCart())

  const add = useCallback((item: CatalogItem, qty = 1) => {
    setCart((c) => cartService.addLine(c, item, qty))
  }, [])

  const remove = useCallback((lineId: string) => {
    setCart((c) => cartService.removeLine(c, lineId))
  }, [])

  const updateQty = useCallback((lineId: string, qty: number) => {
    setCart((c) => cartService.updateQty(c, lineId, qty))
  }, [])

  const setTip = useCallback((tipCents: number) => {
    setCart((c) => cartService.setTip(c, tipCents))
  }, [])

  const clear = useCallback(() => {
    setCart(cartService.createEmptyCart())
  }, [])

  return {
    cart,
    add,
    remove,
    updateQty,
    setTip,
    clear,
    subtotal: cartService.subtotalCents(cart),
    total: cartService.totalCents(cart),
    lineCount: cartService.lineCount(cart),
    saleItems: cartService.cartToSaleItems(cart),
  }
}
