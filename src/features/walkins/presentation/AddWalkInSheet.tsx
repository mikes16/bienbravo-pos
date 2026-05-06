import { useEffect, useState } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { useToast } from '@/core/toast/useToast'
import { cn } from '@/shared/lib/cn'
import type { CustomerResult, BarberResult, CustomerHistoryEntry } from '@/features/checkout/data/checkout.repository'

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
    setSubmitting(false)
    setError(null)
  }, [open])

  // Load the location's barbers once the sheet opens. cache-first under the hood.
  useEffect(() => {
    if (!open || !locationId) return
    let cancelled = false
    checkout.getBarbers(locationId).then((b) => {
      if (!cancelled) setBarbers(b)
    }).catch(() => {})
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

  const handleSubmit = async () => {
    if (submitting) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Nombre requerido')
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
        ? `Walk-in agregado · asignado a ${assignedBarberName}`
        : `Walk-in agregado · ${trimmedName} en cola`
      addToast(toastMsg, 'success')
      onCreated()
      onClose()
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

          <TouchButton
            variant="primary"
            size="primary"
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="w-full rounded-none uppercase tracking-[0.06em]"
          >
            {submitting ? 'Agregando…' : 'Agregar walk-in →'}
          </TouchButton>
        </div>
      </div>
    </div>
  )
}
