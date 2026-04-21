import { useState, useEffect } from 'react'
import { useRepositories } from '@/core/repositories/RepositoryProvider.tsx'
import type { CatalogCategory, CatalogService, CatalogProduct, CatalogCombo, StockLevel } from '../domain/checkout.types.ts'

export function useCatalog(locationId: string | null, staffUserId?: string | null) {
  const { checkout } = useRepositories()
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [services, setServices] = useState<CatalogService[]>([])
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [combos, setCombos] = useState<CatalogCombo[]>([])
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!locationId) return
    setLoading(true)
    setError(null)

    Promise.all([
      checkout.getCategories(),
      checkout.getServices(locationId, staffUserId ?? null),
      checkout.getProducts(locationId),
      checkout.getCombos(),
      checkout.getStockLevels(locationId),
    ])
      .then(([cats, svcs, prods, cmbs, levels]) => {
        setCategories(cats)
        setServices(svcs)
        setProducts(prods)
        setCombos(cmbs)
        setStockLevels(levels)
      })
      .catch(() => setError('No se pudo cargar el catálogo'))
      .finally(() => setLoading(false))
  }, [checkout, locationId, staffUserId])

  return { categories, services, products, combos, stockLevels, loading, error }
}
