import { useEffect, useMemo, useState } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { useToast } from '@/core/toast/useToast'
import { cn } from '@/shared/lib/cn'
import type { CustomerResult, BarberResult, CustomerHistoryEntry } from '@/features/checkout/data/checkout.repository'
import type { CatalogService, CatalogCombo, CatalogCategory } from '@/features/checkout/domain/checkout.types'

type PickerSelection =
  | { kind: 'service'; id: string }
  | { kind: 'combo'; id: string }

interface AddWalkInSheetProps {
  open: boolean
  locationId: string
  onClose: () => void
  onCreated: () => void
}

function formatHistoryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function AddWalkInSheet({ open, locationId, onClose, onCreated }: AddWalkInSheetProps) {
  const { walkins, checkout } = useRepositories()
  const { addToast } = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null)
  const [searchResults, setSearchResults] = useState<CustomerResult[]>([])
  const [history, setHistory] = useState<CustomerHistoryEntry[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [barbers, setBarbers] = useState<BarberResult[]>([])
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null)
  const [services, setServices] = useState<CatalogService[]>([])
  const [combos, setCombos] = useState<CatalogCombo[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selection, setSelection] = useState<PickerSelection | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state every time the sheet opens, so a fresh form greets the operator.
  useEffect(() => {
    if (!open) return
    setName('')
    setPhone('')
    setSelectedCustomer(null)
    setSearchResults([])
    setHistory(null)
    setHistoryLoading(false)
    setSelectedBarberId(null)
    setSelectedCategoryId(null)
    setSelection(null)
    setSubmitting(false)
    setError(null)
  }, [open])

  // Load the location's barbers + services + combos + categories once the sheet
  // opens. cache-first under the hood, so reopening is instant.
  useEffect(() => {
    if (!open || !locationId) return
    let cancelled = false
    Promise.all([
      checkout.getBarbers(locationId),
      checkout.getServices(locationId, null),
      checkout.getCombos(),
      checkout.getCategories(),
    ])
      .then(([b, s, c, cats]) => {
        if (cancelled) return
        setBarbers(b)
        // Only show non-add-on services in the picker (add-ons are upsells, not
        // standalone visit reasons).
        setServices(s.filter((svc) => !svc.isAddOn))
        setCombos(c)
        setCategories(cats)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open, locationId, checkout])

  // Debounced customer search as the operator types — only when not already linked.
  useEffect(() => {
    if (selectedCustomer) return
    const q = name.trim()
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      checkout.searchCustomers(q).then((res) => {
        if (!cancelled) setSearchResults(res.slice(0, 5))
      }).catch(() => {})
    }, 220)
    return () => { cancelled = true; clearTimeout(t) }
  }, [name, selectedCustomer, checkout])

  // When the operator picks an existing customer, pull their last few visits.
  useEffect(() => {
    if (!selectedCustomer) {
      setHistory(null)
      return
    }
    let cancelled = false
    setHistoryLoading(true)
    checkout.getCustomerHistory(selectedCustomer.id, 5)
      .then((h) => { if (!cancelled) setHistory(h) })
      .catch(() => { if (!cancelled) setHistory([]) })
      .finally(() => { if (!cancelled) setHistoryLoading(false) })
    return () => { cancelled = true }
  }, [selectedCustomer, checkout])

  if (!open) return null

  const linkExisting = (c: CustomerResult) => {
    setSelectedCustomer(c)
    setName(c.fullName)
    setPhone(c.phone ?? '')
    setSearchResults([])
  }

  const clearCustomerLink = () => {
    setSelectedCustomer(null)
    setHistory(null)
    // Leave the typed name/phone so the operator can still proceed as a fresh walk-in.
  }

  // resetForCompanion = true keeps the sheet open after a successful create
  // and clears only the per-person fields, so the operator can register the
  // next family member fast (papá → hijo). The barber AND service stay
  // selected: families typically share both, and keeping the service means
  // the agenda still knows how long the next cut takes without a re-pick.
  // Customer link / phone clear so the companion lands as a separate person,
  // not auto-linked to the first.
  const handleSubmit = async (resetForCompanion = false) => {
    if (submitting) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Nombre requerido')
      return
    }
    if (!selection) {
      setError('Selecciona el servicio que viene a hacerse')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await walkins.create({
        locationId,
        customerId: selectedCustomer?.id ?? null,
        customerName: trimmedName,
        customerPhone: phone.trim() || null,
        requestedServiceId: selection.kind === 'service' ? selection.id : null,
        requestedCatalogComboId: selection.kind === 'combo' ? selection.id : null,
      })
      let assignedBarberName: string | null = null
      if (selectedBarberId) {
        try {
          await walkins.assign(created.id, selectedBarberId)
          assignedBarberName = barbers.find((b) => b.id === selectedBarberId)?.fullName.split(' ')[0] ?? null
        } catch {
          // Walk-in landed; assignment failed. Still treat as success and let the
          // operator claim it from the queue manually.
        }
      }
      const toastMsg = assignedBarberName
        ? `${trimmedName} agregado · asignado a ${assignedBarberName}`
        : `${trimmedName} agregado · en cola`
      addToast(toastMsg, 'success')
      onCreated()
      if (resetForCompanion) {
        // Clear per-person fields. Keep barber + service + category — the
        // agenda needs the service to know cut duration, and families share
        // both the barber and the cut nine times out of ten. The operator
        // can still tap a different service if this companion needs one.
        setName('')
        setPhone('')
        setSelectedCustomer(null)
        setSearchResults([])
        setHistory(null)
        setHistoryLoading(false)
        setSubmitting(false)
        setError(null)
      } else {
        onClose()
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[AddWalkInSheet] create failed', err)
      }
      setError('No se pudo crear el walk-in. Reintenta.')
      setSubmitting(false)
    }
  }

  const completedHistoryCount = history?.filter((h) => h.status === 'COMPLETED').length ?? 0
  const recentVisit = history && history.length > 0 ? history[0] : null

  return (
    <div
      role="dialog"
      aria-label="Nuevo walk-in"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto border-t border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-leather-muted)]/40 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]"
          >
            ← Cerrar
          </button>
          <span className="font-[var(--font-pos-display)] text-[18px] font-extrabold tracking-[-0.02em] text-[var(--color-bone)]">
            Nuevo walk-in
          </span>
          <span className="w-12" />
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
              Cliente
            </label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/[0.06] px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-[14px] font-bold text-[var(--color-bone)]">{selectedCustomer.fullName}</span>
                  {selectedCustomer.phone && (
                    <span className="text-[12px] text-[var(--color-bone-muted)]">{selectedCustomer.phone}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={clearCustomerLink}
                  className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bravo)] hover:text-[var(--color-bone)]"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre o búsqueda…"
                className="border border-[var(--color-leather-muted)] bg-[var(--color-carbon)] px-3 py-2 text-[15px] font-bold text-[var(--color-bone)] outline-none focus:border-[var(--color-bravo)]"
              />
            )}

            {!selectedCustomer && searchResults.length > 0 && (
              <div className="flex flex-col border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon)]">
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => linkExisting(c)}
                    className="flex cursor-pointer flex-col items-start gap-0.5 border-b border-[var(--color-leather-muted)]/30 px-3 py-2 text-left last:border-b-0 hover:bg-[var(--color-cuero-viejo)]"
                  >
                    <span className="text-[13px] font-bold text-[var(--color-bone)]">{c.fullName}</span>
                    {(c.phone || c.email) && (
                      <span className="font-mono text-[10px] text-[var(--color-bone-muted)]">
                        {[c.phone, c.email].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* History preview when an existing customer is linked */}
          {selectedCustomer && (
            <div className="flex flex-col gap-2 border border-[var(--color-leather-muted)]/40 px-4 py-3">
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
                Historial
              </span>
              {historyLoading ? (
                <span className="text-[12px] text-[var(--color-bone-muted)]">Cargando…</span>
              ) : history && history.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[var(--color-bone)]">
                    {completedHistoryCount > 0
                      ? `${completedHistoryCount} servicio${completedHistoryCount === 1 ? '' : 's'} en BienBravo`
                      : 'Cliente registrado · sin servicios completados'}
                  </span>
                  {recentVisit && (
                    <span className="text-[12px] text-[var(--color-bone-muted)]">
                      Último: {recentVisit.itemLabels[0] ?? 'Servicio'} · {formatHistoryDate(recentVisit.startAt)}
                    </span>
                  )}
                  {history.length > 1 && (
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {history.slice(0, 5).map((h) => (
                        <li key={h.id} className="font-mono text-[10px] text-[var(--color-bone-muted)]">
                          {formatHistoryDate(h.startAt)} · {h.itemLabels.join(', ') || 'Servicio'}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <span className="text-[12px] text-[var(--color-bone-muted)]">Sin visitas previas</span>
              )}
            </div>
          )}

          {/* Phone */}
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
              Teléfono · opcional
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="55 1234 5678"
              className="border border-[var(--color-leather-muted)] bg-[var(--color-carbon)] px-3 py-2 text-[15px] font-bold text-[var(--color-bone)] outline-none focus:border-[var(--color-bravo)]"
            />
          </div>

          <ServicePicker
            services={services}
            combos={combos}
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onCategoryChange={setSelectedCategoryId}
            selection={selection}
            onSelectionChange={setSelection}
          />

          {/* Barber selector */}
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
              Asignar a · opcional
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedBarberId(null)}
                className={cn(
                  'cursor-pointer border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em]',
                  selectedBarberId === null
                    ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]'
                    : 'border-[var(--color-leather-muted)] text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)]',
                )}
              >
                Cola general
              </button>
              {barbers.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBarberId(b.id)}
                  className={cn(
                    'cursor-pointer border px-3 py-2 text-[12px] font-bold',
                    selectedBarberId === b.id
                      ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]'
                      : 'border-[var(--color-leather-muted)] text-[var(--color-bone-muted)] hover:bg-[var(--color-cuero-viejo)]',
                  )}
                >
                  {b.fullName.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div role="alert" className="border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/[0.06] px-3 py-2">
              <p className="text-[13px] text-[var(--color-bravo)]">{error}</p>
            </div>
          )}

          <div className="flex flex-col">
            <TouchButton
              variant="primary"
              size="primary"
              onClick={() => handleSubmit(false)}
              disabled={submitting || !name.trim() || !selection}
              className="w-full rounded-none uppercase tracking-[0.06em]"
            >
              {submitting ? 'Agregando…' : 'Agregar walk-in →'}
            </TouchButton>
            {/* Companion CTA — kept visually subordinate but pushed clear of the
                primary tap area: 24px breathing room + 44px min touch target
                (Apple/Material). Hairline divider sells the separation visually
                so a tablet finger never lands here by accident. */}
            <div className="mt-6 border-t border-[var(--color-leather-muted)]/40 pt-3">
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                disabled={submitting || !name.trim() || !selection}
                className="block min-h-[44px] w-full cursor-pointer px-6 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] underline-offset-4 hover:text-[var(--color-bone)] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
              >
                Agregar y otro acompañante →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * ServicePicker — category chips + filtered cards.
 *
 * Mirrors the checkout grid pattern operators already use dozens of times a
 * day: a row of sticky-ish chips at the top picks a category; cards below
 * show services + combos that match. "Todo" shows everything; "Combos" is a
 * virtual chip showing only combos.
 * ────────────────────────────────────────────────────────────────────────── */

function comboDurationMin(combo: CatalogCombo, services: CatalogService[]): number {
  let total = 0
  for (const item of combo.items) {
    if (!item.serviceId) continue
    const svc = services.find((s) => s.id === item.serviceId)
    if (svc) total += svc.durationMin * (item.qty ?? 1)
  }
  return total
}

interface ServicePickerProps {
  services: CatalogService[]
  combos: CatalogCombo[]
  categories: CatalogCategory[]
  selectedCategoryId: string | null
  onCategoryChange: (id: string | null) => void
  selection: PickerSelection | null
  onSelectionChange: (s: PickerSelection) => void
}

function ServicePicker({
  services,
  combos,
  categories,
  selectedCategoryId,
  onCategoryChange,
  selection,
  onSelectionChange,
}: ServicePickerProps) {
  const visibleCategories = useMemo(() => {
    // Only show categories that actually have at least one service (or
    // a combo that effectiveCategorizes into them). Avoids empty chips.
    const usedIds = new Set<string>()
    for (const s of services) if (s.categoryId) usedIds.add(s.categoryId)
    for (const c of combos) for (const cid of c.effectiveCategoryIds) usedIds.add(cid)
    return categories
      .filter((c) => usedIds.has(c.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [services, combos, categories])

  const filteredServices = useMemo(() => {
    if (selectedCategoryId === null) return services
    return services.filter((s) => s.categoryId === selectedCategoryId)
  }, [services, selectedCategoryId])

  const filteredCombos = useMemo(() => {
    if (selectedCategoryId === null) return combos
    return combos.filter((c) => c.effectiveCategoryIds.includes(selectedCategoryId))
  }, [combos, selectedCategoryId])

  const isLoading = services.length === 0 && combos.length === 0
  const totalShown = filteredServices.length + filteredCombos.length

  return (
    <div className="flex flex-col gap-3">
      <label className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
        Servicio
      </label>

      {/* Filter tabs — flat text + bottom rule, not boxed. Sits under a hairline
          divider so the eye reads it as a meta-control above the content area. */}
      <div className="flex gap-5 overflow-x-auto border-b border-[var(--color-leather-muted)]/40">
        <FilterTab
          label="Todo"
          active={selectedCategoryId === null}
          onClick={() => onCategoryChange(null)}
        />
        {visibleCategories.map((c) => (
          <FilterTab
            key={c.id}
            label={c.name}
            active={selectedCategoryId === c.id}
            onClick={() => onCategoryChange(c.id)}
          />
        ))}
      </div>

      {/* Cards, grouped by kind so the visual structure tells the operator
          "these are services, those are combos" without adding badges. */}
      {isLoading ? (
        <p className="text-[12px] text-[var(--color-bone-muted)]">Cargando servicios…</p>
      ) : totalShown === 0 ? (
        <p className="py-4 text-[12px] text-[var(--color-bone-muted)]">Sin opciones en esta categoría.</p>
      ) : (
        <>
          {filteredServices.length > 0 && (
            <Section label="Servicios">
              <div className="grid grid-cols-2 gap-2">
                {filteredServices.map((s) => {
                  const active = selection?.kind === 'service' && selection.id === s.id
                  return (
                    <PickerCard
                      key={`svc-${s.id}`}
                      title={s.name}
                      meta={`${s.durationMin} min`}
                      active={active}
                      onClick={() => onSelectionChange({ kind: 'service', id: s.id })}
                    />
                  )
                })}
              </div>
            </Section>
          )}
          {filteredCombos.length > 0 && (
            <Section label="Combos" labelTone="bravo">
              <div className="grid grid-cols-2 gap-2">
                {filteredCombos.map((c) => {
                  const active = selection?.kind === 'combo' && selection.id === c.id
                  const dur = comboDurationMin(c, services)
                  return (
                    <PickerCard
                      key={`combo-${c.id}`}
                      title={c.name}
                      meta={dur > 0 ? `${dur} min` : 'Combo'}
                      active={active}
                      onClick={() => onSelectionChange({ kind: 'combo', id: c.id })}
                    />
                  )
                })}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  )
}

function FilterTab({
  label,
  active,
  onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 cursor-pointer border-b-2 pb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-colors',
        active
          ? '-mb-px border-[var(--color-bravo)] text-[var(--color-bone)]'
          : 'border-transparent text-[var(--color-bone-muted)] hover:text-[var(--color-bone)]',
      )}
    >
      {label}
    </button>
  )
}

function Section({
  label,
  labelTone = 'muted',
  children,
}: {
  label: string
  labelTone?: 'muted' | 'bravo'
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className={cn(
          'font-mono text-[9px] font-bold uppercase tracking-[0.2em]',
          labelTone === 'bravo' ? 'text-[var(--color-bravo)]' : 'text-[var(--color-bone-muted)]',
        )}
      >
        {label}
      </span>
      {children}
    </div>
  )
}

function PickerCard({
  title,
  meta,
  active,
  onClick,
}: { title: string; meta: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex cursor-pointer flex-col items-start gap-0.5 border px-3 py-2 text-left transition-colors',
        active
          ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08]'
          : 'border-[var(--color-leather-muted)]/60 hover:border-[var(--color-leather-muted)] hover:bg-[var(--color-cuero-viejo)]',
      )}
    >
      <span className="text-[13px] font-bold text-[var(--color-bone)]">{title}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-bone-muted)]">
        {meta}
      </span>
    </button>
  )
}
