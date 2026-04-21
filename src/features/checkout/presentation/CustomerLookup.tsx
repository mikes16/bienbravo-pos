import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/shared/lib/cn.ts'
import type { CustomerResult } from '../data/checkout.repository.ts'

interface CustomerLookupProps {
  selectedCustomer: CustomerResult | null
  onSelect: (customer: CustomerResult | null) => void
  searchFn: (query: string) => Promise<CustomerResult[]>
  onCreateCustomer: (name: string, email: string | null, phone: string | null) => Promise<CustomerResult | null>
  anonymousSelected: boolean
  onSelectAnonymous: () => void
}

export function CustomerLookup({
  selectedCustomer,
  onSelect,
  searchFn,
  onCreateCustomer,
  anonymousSelected,
  onSelectAnonymous,
}: CustomerLookupProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchSeqRef = useRef(0)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const canCreate = createName.trim().length > 1 && (createEmail.trim().length > 0 || createPhone.trim().length > 0)

  async function handleCreateCustomer() {
    if (!canCreate) {
      setCreateError('Agrega nombre y al menos correo o teléfono.')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const customer = await onCreateCustomer(
        createName.trim(),
        createEmail.trim() || null,
        createPhone.trim() || null,
      )
      if (!customer) {
        setCreateError('No se pudo crear el cliente.')
        return
      }
      onSelect(customer)
      setQuery('')
      setShowCreate(false)
      setOpen(false)
    } catch {
      setCreateError('No se pudo crear el cliente.')
    } finally {
      setCreating(false)
    }
  }

  const doSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) { setResults([]); return }
      const seq = ++searchSeqRef.current
      setSearching(true)
      try {
        const res = await searchFn(q)
        // Guard against stale responses arriving out-of-order.
        if (seq !== searchSeqRef.current) return
        setResults(res)
        setOpen(true)
      } finally {
        if (seq === searchSeqRef.current) setSearching(false)
      }
    },
    [searchFn],
  )

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(query), 350)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      // Invalidate any in-flight search on unmount/re-run.
      searchSeqRef.current++
    }
  }, [query, doSearch])

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  if (selectedCustomer) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-bb-surface px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-bb-text">{selectedCustomer.fullName}</p>
          {selectedCustomer.phone && (
            <p className="text-xs text-bb-muted">{selectedCustomer.phone}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { onSelect(null); setQuery('') }}
          className="ml-2 shrink-0 text-xs text-bb-muted hover:text-bb-danger"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Buscar cliente..."
        className={cn(
          'w-full rounded-xl bg-bb-surface px-3 py-2 text-sm text-bb-text placeholder:text-bb-muted',
          'border border-bb-border focus:border-bb-primary focus:outline-none',
        )}
      />
      {searching && (
        <div className="absolute right-3 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-bb-primary border-t-transparent" />
      )}
      {anonymousSelected && (
        <p className="mt-1 text-xs text-bb-muted">Cobro anónimo seleccionado</p>
      )}
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-bb-border bg-bb-bg shadow-lg">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c)
                setQuery('')
                setShowCreate(false)
                setOpen(false)
              }}
              className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-bb-surface"
            >
              <span className="text-sm font-semibold text-bb-text">{c.fullName}</span>
              <span className="text-xs text-bb-muted">
                {[c.phone, c.email].filter(Boolean).join(' · ')}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && !searching && results.length === 0 && (
        <div className="absolute z-50 mt-1 w-full space-y-2 rounded-xl border border-bb-border bg-bb-bg px-3 py-3 text-sm text-bb-muted shadow-lg">
          {!showCreate ? (
            <>
              <p>Sin resultados para "{query}"</p>
              <button
                type="button"
                onClick={() => {
                  setCreateName(query)
                  setShowCreate(true)
                  setCreateError(null)
                }}
                className="w-full rounded-lg border border-bb-primary/40 bg-bb-primary/10 px-3 py-2 text-left text-xs font-semibold text-bb-primary hover:bg-bb-primary/15"
              >
                + Agregar cliente nuevo
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-bb-text">Nuevo cliente</p>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Nombre"
                className="w-full rounded-lg border border-bb-border bg-bb-surface px-2.5 py-2 text-xs text-bb-text placeholder:text-bb-muted focus:border-bb-primary focus:outline-none"
              />
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="Correo (opcional)"
                className="w-full rounded-lg border border-bb-border bg-bb-surface px-2.5 py-2 text-xs text-bb-text placeholder:text-bb-muted focus:border-bb-primary focus:outline-none"
              />
              <input
                type="tel"
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                placeholder="Teléfono (opcional)"
                className="w-full rounded-lg border border-bb-border bg-bb-surface px-2.5 py-2 text-xs text-bb-text placeholder:text-bb-muted focus:border-bb-primary focus:outline-none"
              />
              <p className="text-[11px] text-bb-muted">Necesitas correo o teléfono para evitar duplicados.</p>
              {createError && <p className="text-[11px] text-bb-danger">{createError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-lg border border-bb-border px-2.5 py-2 text-xs text-bb-muted hover:bg-bb-surface"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleCreateCustomer}
                  disabled={creating}
                  className="flex-1 rounded-lg bg-bb-primary px-2.5 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {creating ? 'Guardando...' : 'Guardar cliente'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          onSelect(null)
          onSelectAnonymous()
          setOpen(false)
          setShowCreate(false)
        }}
        className={cn(
          'mt-2 w-full rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
          anonymousSelected
            ? 'border-bb-primary bg-bb-primary/15 text-bb-primary'
            : 'border-bb-border text-bb-muted hover:bg-bb-surface',
        )}
      >
        {anonymousSelected ? '✓ Cobro anónimo seleccionado' : 'Cobrar anónimo'}
      </button>
    </div>
  )
}
