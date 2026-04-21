import { useState, useMemo, useDeferredValue } from 'react'
import { ScissorsIcon, SearchIcon } from '@/shared/pos-ui/GoogleIcon.tsx'
import { cn } from '@/shared/lib/cn.ts'
import { formatMoney } from '@/shared/lib/money.ts'
import { SkeletonBlock, EmptyState } from '@/shared/pos-ui/index.ts'
import type { CatalogCategory, CatalogService, CatalogProduct, CatalogCombo, StockLevel, CatalogItem } from '../domain/checkout.types.ts'

type Tab = 'services' | 'products' | 'combos'

const LOW_STOCK_THRESHOLD = 5

interface CatalogViewProps {
  categories: CatalogCategory[]
  services: CatalogService[]
  products: CatalogProduct[]
  combos: CatalogCombo[]
  stockLevels: StockLevel[]
  loading: boolean
  error: string | null
  onAdd: (item: CatalogItem) => void
}

/* ── Component ────────────────────────────────────────────────────────── */

export function CatalogView({ categories, services, products, combos, stockLevels, loading, error, onAdd }: CatalogViewProps) {
  const [tab, setTab] = useState<Tab>('services')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const serviceCategories = useMemo(
    () => categories.filter((c) => c.appliesTo === 'SERVICE' || c.appliesTo === 'ANY').sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  )
  const productCategories = useMemo(
    () => categories.filter((c) => c.appliesTo === 'PRODUCT' || c.appliesTo === 'ANY').sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  )
  const comboCategories = useMemo(
    () => categories.filter((c) => c.appliesTo === 'COMBO' || c.appliesTo === 'ANY').sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  )

  const stockMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const sl of stockLevels) m.set(sl.productId, sl.quantity)
    return m
  }, [stockLevels])

  const q = deferredSearch.toLowerCase()

  const filteredServices = useMemo(() => {
    let list = services
    if (categoryId) list = list.filter((s) => s.categoryId === categoryId)
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q))
    return list
  }, [services, categoryId, q])

  const filteredProducts = useMemo(() => {
    let list = products
    if (categoryId) list = list.filter((p) => p.categoryId === categoryId)
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q))
    return list
  }, [products, categoryId, q])

  const filteredCombos = useMemo(() => {
    let list = combos
    if (categoryId) list = list.filter((c) => c.effectiveCategoryIds.includes(categoryId))
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q))
    return list
  }, [combos, categoryId, q])

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex gap-2">
        {(['services', 'products', ...(combos.length > 0 ? ['combos'] : [])] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setCategoryId(null) }}
            className={cn(
              'rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors',
              tab === t
                ? 'bg-bb-primary text-white'
                : 'bg-bb-surface text-bb-muted hover:bg-bb-surface-2',
            )}
          >
            {t === 'services' ? 'Servicios' : t === 'products' ? 'Productos' : 'Combos'}
          </button>
        ))}
      </div>

      {/* Category chips */}
      {(() => {
        const chips = tab === 'services' ? serviceCategories : tab === 'products' ? productCategories : comboCategories
        if (chips.length === 0) return null
        return (
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoryId(null)}
              className={cn(
                'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
                !categoryId ? 'bg-bb-primary text-white' : 'bg-bb-surface text-bb-muted hover:bg-bb-surface-2',
              )}
            >
              Todo
            </button>
            {chips.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
                  categoryId === cat.id ? 'bg-bb-primary text-white' : 'bg-bb-surface text-bb-muted hover:bg-bb-surface-2',
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )
      })()}

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bb-muted" />
        <input
          type="text"
          placeholder="Buscar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-bb-border bg-bb-surface py-3 pl-10 pr-4 text-sm outline-none focus:border-bb-primary"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-bb-danger/10 px-4 py-3 text-sm text-bb-danger">{error}</p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-32" />
          ))}
        </div>
      ) : tab === 'services' ? (
        filteredServices.length === 0 ? (
          <EmptyState icon={<ScissorsIcon className="h-8 w-8 text-bb-muted" />} message="Sin servicios encontrados" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filteredServices.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onAdd({ kind: 'service', item: s })}
                className={cn(
                  'relative flex flex-col items-start gap-2 rounded-2xl bg-bb-surface overflow-hidden',
                  'transition-transform active:scale-[0.97] hover:bg-bb-surface-2',
                  s.isAddOn && 'border border-dashed border-bb-border',
                  !s.imageUrl && 'p-4',
                )}
              >
                {s.imageUrl ? (
                  <>
                    <img src={s.imageUrl} alt={s.name} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
                    <div className="flex w-full flex-col gap-1.5 px-3 pb-3">
                      <span className="text-sm font-bold leading-tight line-clamp-2">{s.name}</span>
                      <div className="flex w-full items-center justify-between">
                        <span className="text-sm font-bold text-bb-primary">{formatMoney(s.priceCents)}</span>
                        <span className="rounded-full bg-bb-primary/15 px-2 py-0.5 text-[10px] font-bold text-bb-primary">
                          {s.durationMin} MIN
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bb-primary/15">
                      <ScissorsIcon className="h-4 w-4 text-bb-primary" />
                    </div>
                    <span className="text-sm font-bold leading-tight line-clamp-2">{s.name}</span>
                    <div className="mt-auto flex w-full items-center justify-between">
                      <span className="text-sm font-bold text-bb-primary">{formatMoney(s.priceCents)}</span>
                      <span className="rounded-full bg-bb-primary/15 px-2 py-0.5 text-[10px] font-bold text-bb-primary">
                        {s.durationMin} MIN
                      </span>
                    </div>
                  </>
                )}
              </button>
            ))}
          </div>
        )
      ) : tab === 'products' ? (
        filteredProducts.length === 0 ? (
          <EmptyState message="Sin productos encontrados" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onAdd({ kind: 'product', item: p })}
                className={cn(
                  'relative flex flex-col items-start gap-2 rounded-2xl bg-bb-surface p-4',
                  'transition-transform active:scale-[0.97] hover:bg-bb-surface-2',
                  stockMap.has(p.id) && stockMap.get(p.id)! <= 0 && 'opacity-50',
                )}
              >
                {(() => {
                  const qty = stockMap.get(p.id)
                  if (qty === undefined) return null
                  if (qty <= 0) return (
                    <span className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">Agotado</span>
                  )
                  if (qty <= LOW_STOCK_THRESHOLD) return (
                    <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">Quedan {qty}</span>
                  )
                  return null
                })()}
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-bb-surface-2 text-xs font-bold text-bb-muted">
                    IMG
                  </div>
                )}
                {p.sku && (
                  <span className="text-[10px] font-mono text-bb-muted">{p.sku}</span>
                )}
                <span className="text-sm font-bold leading-tight line-clamp-2">{p.name}</span>
                <span className="mt-auto text-sm font-bold text-bb-primary">{formatMoney(p.priceCents)}</span>
              </button>
            ))}
          </div>
        )
      ) : (
        filteredCombos.length === 0 ? (
          <EmptyState message="Sin combos encontrados" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filteredCombos.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onAdd({ kind: 'combo', item: c })}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-2xl bg-bb-surface p-4',
                  'transition-transform active:scale-[0.97] hover:bg-bb-surface-2',
                )}
              >
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt={c.name} loading="lazy" decoding="async" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-bb-primary/15">
                    <span className="material-symbols-outlined text-lg text-bb-primary" aria-hidden>deployed_code</span>
                  </div>
                )}
                <span className="text-sm font-bold leading-tight line-clamp-2">{c.name}</span>
                <div className="flex flex-wrap gap-1">
                  {c.items.map((it, idx) => (
                    <span key={idx} className="rounded-full bg-bb-surface-2 px-2 py-0.5 text-[10px] text-bb-muted">
                      {it.serviceName ?? it.productName}{it.qty > 1 ? ` ×${it.qty}` : ''}
                    </span>
                  ))}
                </div>
                <span className="mt-auto text-sm font-bold text-bb-primary">{formatMoney(c.priceCents)}</span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  )
}
