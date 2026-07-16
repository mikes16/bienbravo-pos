import { useEffect, useMemo, useState } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { useToast } from '@/core/toast/useToast'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { cn } from '@/shared/lib/cn'
import { CustomerNameTakenException } from '@/shared/lib/customer-errors'
import { sortCatalogItems, onlyCategorized } from '@/features/checkout/lib/sort-catalog'
import type { CustomerResult, BarberResult } from '@/features/checkout/data/checkout.repository'
import type { CatalogService, CatalogCombo, CatalogCategory } from '@/features/checkout/domain/checkout.types'

/**
 * Selección del picker. Dos modos mutuamente exclusivos:
 *  - servicios sueltos (N): el cliente quiere corte + barba sin que sea un
 *    combo formal del catálogo. Persiste el orden de selección.
 *  - combo (1): el cliente quiere un combo pre-armado tipo "Doble" o "Triple".
 *
 * No se permite mezclar — un combo ya define sus servicios internos.
 */
type PickerSelection =
  | { kind: 'services'; ids: string[] }
  | { kind: 'combo'; id: string }
  | { kind: 'empty' }

interface AddWalkInSheetProps {
  open: boolean
  locationId: string
  onClose: () => void
  onCreated: () => void
}

/**
 * Decisión primaria del operador. Una sola intención por walk-in — antes
 * eran dos campos que podían contradecirse (preferred=Javi + asignar=Alan).
 * Ahora:
 *   - 'queue'     → cola; selectedBarberId es preferencia opcional (espera a X)
 *   - 'serve_now' → asignación inmediata; selectedBarberId es OBLIGATORIO
 *                   y se persiste también como preferencia (lo pidió a X o
 *                   tomó al primer libre — en ambos casos coherente).
 */
type FlowMode = 'queue' | 'serve_now'

export function AddWalkInSheet({ open, locationId, onClose, onCreated }: AddWalkInSheetProps) {
  const { walkins, checkout } = useRepositories()
  const { addToast } = useToast()
  const { viewer } = usePosAuth()
  // Teléfono es PII gateado por permiso, igual que las columnas de teléfono del
  // admin. Deny-by-default: sin `customers.phone.view` NO renderizamos el campo,
  // no lo capturamos y no lo anunciamos en el placeholder del buscador. El API
  // es la autoridad real (nulifica el teléfono para viewers sin el permiso);
  // esto es la mitad de UI. Durante la carga del viewer (null) también ocultamos
  // — nunca mostramos PII "por si acaso".
  const canViewPhone = viewer?.permissions?.includes('customers.phone.view') ?? false
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null)
  const [searchResults, setSearchResults] = useState<CustomerResult[]>([])
  // Todos los barberos clocked-in en la sucursal. Cada uno trae `isOccupied`
  // para que el renderer decida si es seleccionable en 'serve_now' (debe estar
  // libre) o si solo es preferencia (puede estar ocupado, el cliente espera).
  const [allBarbers, setAllBarbers] = useState<BarberResult[]>([])
  const [mode, setMode] = useState<FlowMode>('queue')
  // En 'queue' es la preferencia (opcional). En 'serve_now' es el asignado
  // (obligatorio para poder submit). Un solo campo, dos significados según
  // el modo — coherente porque el modo lo dicta el operador arriba.
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null)
  const [services, setServices] = useState<CatalogService[]>([])
  const [combos, setCombos] = useState<CatalogCombo[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selection, setSelection] = useState<PickerSelection>({ kind: 'empty' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state every time the sheet opens, so a fresh form greets the operator.
  useEffect(() => {
    if (!open) return
    setName('')
    setPhone('')
    setSelectedCustomer(null)
    setSearchResults([])
    setMode('queue')
    setSelectedBarberId(null)
    setSelectedCategoryId(null)
    setSelection({ kind: 'empty' })
    setSubmitting(false)
    setError(null)
  }, [open])

  // Cambiar de modo revalida la selección de barbero — los criterios cambian
  // según el modo destino.
  function handleModeChange(next: FlowMode) {
    if (next === mode) return
    setMode(next)
    setError(null)
    if (next === 'serve_now') {
      // En 'serve_now' un barbero ocupado NO es elegible (en 'queue' sí, como
      // preferencia mientras el cliente espera). Si veníamos con un ocupado
      // seleccionado, lo soltamos — la selección no puede apuntar a algo
      // no-elegible en este modo.
      const sel = allBarbers.find((b) => b.id === selectedBarberId)
      if (sel?.isOccupied) setSelectedBarberId(null)
      // Ocupación FRESCA al momento de decidir "atiende ya": isOccupied cambia
      // con cada cobro/atender del piso (incluso desde otra tablet), no al abrir
      // el sheet. network-only, ya lo es. NO limpiamos la selección si el
      // refetch revela ocupación tardía — dejamos que el guard del submit lo
      // diga fuerte y claro con el motivo del API, en lugar de silenciarlo.
      if (locationId) {
        void checkout
          .getAvailableBarbers(locationId)
          .then((b) => setAllBarbers(b.filter((bb) => bb.hasClockedIn)))
          .catch(() => {})
      }
    } else {
      // Volver a 'queue': los criterios cambian; pedir elección explícita.
      setSelectedBarberId(null)
    }
  }

  // Load the location's barbers + combos + categories once the sheet opens.
  // Catálogo (combos/categories) es cache-first, así que reabrir pinta al
  // instante; los barberos van network-only porque isOccupied/hasClockedIn
  // son datos vivos (ver getAvailableBarbers). Los servicios se cargan en el
  // efecto de abajo, keyed por barbero seleccionado.
  useEffect(() => {
    if (!open || !locationId) return
    let cancelled = false
    Promise.all([
      // Owner feedback (1.5): show only barbers who clocked in and aren't
      // currently in service. The enriched query also returns hasClockedIn
      // and isOccupied so we can filter here without a second hop.
      checkout.getAvailableBarbers(locationId),
      checkout.getCombos(),
      checkout.getCategories(),
    ])
      .then(([b, c, cats]) => {
        if (cancelled) return
        // Single set para ambos modos. El renderer (BarberRow) decide
        // selectable vs disabled en base a `isOccupied` + modo actual.
        setAllBarbers(b.filter((bb) => bb.hasClockedIn))
        setCombos(c)
        setCategories(cats)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open, locationId, checkout])

  // Servicios re-resueltos con el barbero seleccionado: pricingFor aplica
  // overrides de duración/precio por barbero (barbero > sucursal > base) —
  // un corte de 45 min base puede ser de 35 con el override de Javi. Sin
  // barbero ("Sin preferencia") resuelve a nivel sucursal (staffUserId
  // null). Cards, duración de combos y el resumen "N servicios · X min"
  // derivan todos de `services`, así que se actualizan solos. El cache de
  // Apollo guarda las variantes de pricingFor por barbero, así que cambiar
  // de barbero solo cuesta un round trip la primera vez.
  useEffect(() => {
    if (!open || !locationId) return
    let cancelled = false
    checkout
      .getServices(locationId, selectedBarberId)
      .then((s) => {
        if (cancelled) return
        // Only show non-add-on services in the picker (add-ons are upsells,
        // not standalone visit reasons).
        setServices(s.filter((svc) => !svc.isAddOn))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open, locationId, selectedBarberId, checkout])

  // Mapa itemId → barberos excluidos, derivado del catálogo STATIC (mismo
  // mecanismo que el cobro). Servicios Y combos entran; los ids no colisionan.
  // Alimenta las dos direcciones del filtrado por exclusión: (1) al elegir
  // barbero, ocultar los servicios/combos que NO ofrece; (2) al elegir
  // servicio/combo, ocultar del selector a los barberos que no lo ofrecen.
  const excludedByItemId = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const s of services) m.set(s.id, s.excludedStaffIds ?? [])
    for (const c of combos) m.set(c.id, c.excludedStaffIds ?? [])
    return m
  }, [services, combos])

  // Barberos excluidos de la selección ACTUAL (unión de los excluidos de cada
  // ítem elegido). El selector de barbero los oculta — un barbero preferido debe
  // poder realizar TODO lo seleccionado, igual que el picker por línea del cobro.
  const excludedBarberIds = useMemo(() => {
    const ids =
      selection.kind === 'services' ? selection.ids : selection.kind === 'combo' ? [selection.id] : []
    const set = new Set<string>()
    for (const id of ids) for (const b of excludedByItemId.get(id) ?? []) set.add(b)
    return set
  }, [selection, excludedByItemId])

  // Reconciliación barbero → selección: al elegir un barbero preferido soltamos
  // de la selección los ítems que NO ofrece (catálogo stale, o se eligió el ítem
  // antes que al barbero), para que el resumen "N servicios · X min" y el submit
  // nunca arrastren algo que el preferido no puede hacer. El picker ya oculta
  // esos ítems proactivamente; esto cierra el caso de carrera. `excludedStaffIds`
  // es independiente del barbero consultado (es la lista completa de overrides),
  // así que podar en el momento del tap es suficiente — sin efecto que cause
  // renders en cascada.
  const handleSelectBarber = (barberId: string | null) => {
    setSelectedBarberId(barberId)
    if (!barberId) return
    const isExcluded = (id: string) => (excludedByItemId.get(id) ?? []).includes(barberId)
    setSelection((prev) => {
      if (prev.kind === 'services') {
        const kept = prev.ids.filter((id) => !isExcluded(id))
        if (kept.length === prev.ids.length) return prev
        return kept.length === 0 ? { kind: 'empty' } : { kind: 'services', ids: kept }
      }
      if (prev.kind === 'combo') return isExcluded(prev.id) ? { kind: 'empty' } : prev
      return prev
    })
  }

  // Debounced customer search — dispara desde nombre O teléfono. El operador
  // POS típicamente conoce al cliente por el celular ("el que es el 8440000"),
  // así que esperar a que escriba el nombre completo es un trip-hazard. Watch
  // ambos campos: el primero que cumpla el threshold del API dispara.
  // API: nombre/email ≥ 2 chars; phone ≥ 4 dígitos (customer.resolver.ts:115).
  useEffect(() => {
    if (selectedCustomer) return
    const nameQuery = name.trim()
    const phoneDigits = phone.replace(/\D/g, '')
    // Preferimos el teléfono si tiene 4+ dígitos: es identificador único en
    // la práctica y evita ambigüedad de homónimos.
    const query = phoneDigits.length >= 4 ? phoneDigits : nameQuery.length >= 2 ? nameQuery : ''
    if (!query) {
      setSearchResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      checkout.searchCustomers(query).then((res) => {
        if (!cancelled) setSearchResults(res.slice(0, 5))
      }).catch(() => {})
    }, 220)
    return () => { cancelled = true; clearTimeout(t) }
  }, [name, phone, selectedCustomer, checkout])

  if (!open) return null

  const linkExisting = (c: CustomerResult) => {
    setSelectedCustomer(c)
    setName(c.fullName)
    // Sin permiso de teléfono no capturamos el número del cliente vinculado.
    setPhone(canViewPhone ? (c.phone ?? '') : '')
    setSearchResults([])
  }

  const clearCustomerLink = () => {
    setSelectedCustomer(null)
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
    if (
      selection.kind === 'empty' ||
      (selection.kind === 'services' && selection.ids.length === 0)
    ) {
      setError('Selecciona al menos un servicio o un combo')
      return
    }
    // 'serve_now' exige barbero — la decisión "atender ya" es vacía sin un
    // ejecutor. Si llegamos aquí sin uno, es bug de UI (CTA debería estar
    // deshabilitado), pero validamos por seguridad.
    if (mode === 'serve_now' && !selectedBarberId) {
      setError('Elige un barbero para empezar el servicio')
      return
    }
    // Guard de ocupación con el snapshot fresco (refetch al cambiar de modo):
    // si el barbero elegido se ocupó entre la selección y el submit, prevenimos
    // el assign condenado ANTES de crear nada. Sin esto, el API rechazaba el
    // assign y el sheet cerraba como éxito con el cliente aún en cola.
    const selectedBarber = allBarbers.find((b) => b.id === selectedBarberId)
    if (mode === 'serve_now' && selectedBarber?.isOccupied) {
      setError(`${selectedBarber.fullName.split(' ')[0]} está ocupado — cóbrale a su cliente primero o deja este walk-in en cola`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // En 'serve_now' el barbero es a la vez asignado y preferido: el cliente
      // lo pidió o tomó al primer libre — en ambos casos la preferencia queda
      // registrada coherentemente. En 'queue', el barbero (si hay) es solo
      // preferencia.
      const preferredId = selectedBarberId
      const created = await walkins.create({
        locationId,
        customerId: selectedCustomer?.id ?? null,
        customerName: trimmedName,
        // Deny-by-default: sin permiso no capturamos teléfono aunque el estado
        // por algún camino trajera un valor.
        customerPhone: canViewPhone ? (phone.trim() || null) : null,
        // Multi-servicio: si hay services seleccionados, los mandamos como
        // array. Si hay combo, solo el comboId. El resolver garantiza mutex.
        requestedServiceIds: selection.kind === 'services' ? selection.ids : null,
        requestedServiceId: null,
        requestedCatalogComboId: selection.kind === 'combo' ? selection.id : null,
        preferredStaffUserId: preferredId || null,
      })
      let assignedBarberName: string | null = null
      let assignError: string | null = null
      if (mode === 'serve_now' && selectedBarberId) {
        try {
          await walkins.assign(created.id, selectedBarberId)
          assignedBarberName = allBarbers.find((b) => b.id === selectedBarberId)?.fullName.split(' ')[0] ?? null
        } catch (err) {
          // El walk-in ya aterrizó (correcto: el cliente está formado). Pero el
          // "atiende ya" NO pasó — lo decimos fuerte con el motivo del API,
          // nunca como éxito silencioso. Bug de prod: el operador creía estar
          // atendiendo y el cliente seguía en cola.
          assignError = err instanceof Error ? err.message : 'no se pudo asignar'
        }
      }
      if (assignError) {
        addToast(`${trimmedName} quedó EN COLA — ${assignError}`, 'error')
      } else {
        addToast(
          assignedBarberName
            ? `${trimmedName} agregado · asignado a ${assignedBarberName}`
            : `${trimmedName} agregado · en cola`,
          'success',
        )
      }
      onCreated()
      if (resetForCompanion) {
        // Clear per-person fields. Keep barber + service + category — the
        // agenda needs the service to know cut duration, and families share
        // both the barber and the cut nine times out of ten. El acompañante
        // siempre va a cola (no tendría sentido asignar al mismo barbero dos
        // clientes simultáneamente), así que forzamos mode='queue' aquí.
        setName('')
        setPhone('')
        setSelectedCustomer(null)
        setSearchResults([])
        setMode('queue')
        setSubmitting(false)
        setError(null)
      } else {
        onClose()
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[AddWalkInSheet] create failed', err)
      }
      if (err instanceof CustomerNameTakenException) {
        // Carrera de nombre: el API ya devuelve un mensaje en español listo
        // para mostrar tal cual — no lo pisamos con un genérico.
        setError(err.message)
        if (err.existingCustomerId) {
          // Vincula automáticamente al cliente que ganó la carrera. El
          // operador solo necesita reintentar el submit — esta vez viaja
          // customerId (no el nombre), así que el mismo choque no puede
          // repetirse.
          checkout.getCustomer(err.existingCustomerId).then((c) => {
            if (c) linkExisting(c)
          }).catch(() => {})
        }
      } else {
        setError('No se pudo crear el walk-in. Reintenta.')
      }
      setSubmitting(false)
    }
  }

  // Una sola lista para ambos modos: todos los clocked-in (libres + ocupados).
  // En 'queue' los ocupados son seleccionables (el cliente puede esperar). En
  // 'serve_now' los renderizamos disabled como hint visual del estado del
  // piso, no ocultos — el operador necesita ver quién está ocupado para
  // entender por qué no hay más opciones libres.
  const selectedBarberName = selectedBarberId
    ? allBarbers.find((b) => b.id === selectedBarberId)?.fullName.split(' ')[0] ?? null
    : null
  const canSubmit =
    !submitting &&
    !!name.trim() &&
    !(selection.kind === 'empty' || (selection.kind === 'services' && selection.ids.length === 0)) &&
    (mode === 'queue' || !!selectedBarberId)

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
                  {canViewPhone && selectedCustomer.phone && (
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
                // Sin permiso de teléfono no anunciamos que se puede buscar por
                // número (aunque el server igual matchea si escriben dígitos).
                placeholder={canViewPhone ? 'Nombre o teléfono…' : 'Nombre…'}
                className="border border-[var(--color-leather-muted)] bg-[var(--color-carbon)] px-3 py-2 text-[15px] font-bold text-[var(--color-bone)] outline-none focus:border-[var(--color-bravo)]"
              />
            )}

            {!selectedCustomer && (name.trim().length >= 2 || phone.replace(/\D/g, '').length >= 4) && (
              <div className="flex flex-col border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon)]">
                {searchResults.length > 0 ? (
                  searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => linkExisting(c)}
                      className="flex cursor-pointer flex-col items-start gap-0.5 border-b border-[var(--color-leather-muted)]/30 px-3 py-2 text-left last:border-b-0 hover:bg-[var(--color-cuero-viejo)]"
                    >
                      <span className="text-[13px] font-bold text-[var(--color-bone)]">{c.fullName}</span>
                      {((canViewPhone && c.phone) || c.email) && (
                        <span className="font-mono text-[10px] text-[var(--color-bone-muted)]">
                          {[canViewPhone ? c.phone : null, c.email].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-leather-muted)]">
                    Sin coincidencias · se creará cliente nuevo
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Phone — gateado por permiso `customers.phone.view` (PII). Sin él el
              campo desaparece por completo y el walk-in se manda sin teléfono. */}
          {canViewPhone && (
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
          )}

          <ServicePicker
            services={services}
            combos={combos}
            categories={categories}
            selectedBarberId={selectedBarberId}
            selectedBarberName={selectedBarberName}
            selectedCategoryId={selectedCategoryId}
            onCategoryChange={setSelectedCategoryId}
            selection={selection}
            onSelectionChange={setSelection}
          />

          {/* ─── Decisión primaria ─────────────────────────────────────────
              Antes había dos campos paralelos ("Barbero preferido" + "Asignar
              a") que podían contradecirse: el cliente pedía a Javi pero el
              operador lo asignaba a Alan sin warning. Ahora una sola decisión
              arriba ("¿cola o ya?") gobierna la siguiente sección y el verbo
              del CTA — imposible contradicción por construcción.
              Patrón inspirado en Toast / Booksy: el operador escoge primero
              la intención, después el detalle. */}
          <div className="flex flex-col gap-3 border-t border-[var(--color-leather-muted)]/40 pt-4">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
              ¿Qué hacemos con el cliente?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <ModeOption
                active={mode === 'queue'}
                onClick={() => handleModeChange('queue')}
                title="En cola"
                subtitle="Espera su turno"
              />
              <ModeOption
                active={mode === 'serve_now'}
                onClick={() => handleModeChange('serve_now')}
                title="Atiende ya"
                subtitle="Con un barbero libre"
              />
            </div>
          </div>

          {/* ─── Selector mutante de barbero ───────────────────────────────
              Una sola lista que cambia label, contenido y semántica según el
              modo elegido arriba:
                • 'queue'     → preferencia opcional; "Sin preferencia" por
                                default; muestra TODOS los clocked-in (incluso
                                ocupados, porque el cliente puede esperar).
                • 'serve_now' → asignación obligatoria; "Sin preferencia" no
                                existe; ocupados aparecen disabled como hint
                                visual del estado del piso (mejor que ocultarlos
                                para que el operador entienda por qué no hay
                                más opciones). */}
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
              {mode === 'queue' ? 'Espera a · opcional' : 'Quién lo atiende'}
            </label>
            <div className="flex flex-col">
              {mode === 'queue' && (
                <BarberRow
                  label="Sin preferencia"
                  hint="cualquier barbero libre"
                  active={selectedBarberId === null}
                  onClick={() => handleSelectBarber(null)}
                />
              )}
              {/* Viceversa de la exclusión: si ya hay servicio/combo elegido,
                  ocultamos a los barberos que NO lo ofrecen (mismo criterio que
                  el picker por línea del cobro). Sin selección, se muestran
                  todos los clocked-in. */}
              {allBarbers
                .filter((b) => !excludedBarberIds.has(b.id))
                .map((b) => {
                  const occupied = b.isOccupied
                  const disabled = mode === 'serve_now' && occupied
                  const isActive = selectedBarberId === b.id
                  return (
                    <BarberRow
                      key={`barber-${b.id}`}
                      label={b.fullName.split(' ')[0]}
                      hint={occupied ? 'ocupado' : 'libre'}
                      active={isActive}
                      disabled={disabled}
                      onClick={() => {
                        if (disabled) return
                        handleSelectBarber(b.id)
                      }}
                    />
                  )
                })}
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
              disabled={!canSubmit}
              className="w-full rounded-none uppercase tracking-[0.06em]"
            >
              {submitting
                ? 'Agregando…'
                : mode === 'serve_now'
                  ? selectedBarberName
                    ? `Atiende ya con ${selectedBarberName} →`
                    : 'Elige un barbero para empezar'
                  : selectedBarberName
                    ? `Agregar a cola · espera a ${selectedBarberName} →`
                    : 'Agregar a cola →'}
            </TouchButton>
            {/* Companion CTA — solo aparece en modo 'queue'. En 'serve_now' no
                tiene sentido: el primer cliente ya está ocupando al barbero,
                el acompañante naturalmente va a cola. Si el operador necesita
                registrar al acompañante con asignación inmediata a otro
                barbero, abre un walk-in nuevo manualmente — flujo explícito.
                Tap target 44px+ con divider para evitar fat-finger. */}
            {mode === 'queue' && (
              <div className="mt-6 border-t border-[var(--color-leather-muted)]/40 pt-3">
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={!canSubmit}
                  className="block min-h-[44px] w-full cursor-pointer px-6 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] underline-offset-4 hover:text-[var(--color-bone)] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Agregar y otro acompañante →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * ModeOption — un cuadrante del segmented control "¿qué hacemos?".
 *
 * Sharp corners, sin radius. La barra de cuero a la izquierda del activo da
 * el peso editorial — más legible que un fill plano y reusa el patrón que ya
 * tenemos en otras filas seleccionadas del POS. Min-height 64px para que
 * sobre dedo grueso en tablet sin riesgo de fat-finger entre opciones.
 * ────────────────────────────────────────────────────────────────────────── */
function ModeOption({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean
  onClick: () => void
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group relative flex min-h-[64px] cursor-pointer flex-col items-start justify-center gap-1 border px-4 py-3 text-left transition-colors',
        active
          ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08]'
          : 'border-[var(--color-leather-muted)] hover:bg-[var(--color-cuero-viejo)]',
      )}
    >
      {/* Barra cuero vertical en activo — cita visual al pattern de "fila
          seleccionada" del resto del POS para que el operador lo lea como
          "elegido", no como decoración. */}
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] bg-[var(--color-bravo)]"
        />
      )}
      <span
        className={cn(
          'font-[var(--font-pos-display)] text-[15px] font-extrabold uppercase tracking-[-0.01em]',
          active ? 'text-[var(--color-bone)]' : 'text-[var(--color-bone-muted)] group-hover:text-[var(--color-bone)]',
        )}
      >
        {title}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
        {subtitle}
      </span>
    </button>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * BarberRow — fila del selector mutante.
 *
 * Vertical (no chip wrap) porque acomoda 6-8 barberos sin overflow y deja
 * espacio para el hint (libre/ocupado). Sharp corners + divider hairline.
 * Disabled rendea con opacity y cursor-not-allowed pero NO oculta la fila —
 * el operador necesita ver quién está ocupado para entender el estado del
 * piso, no esconderlo.
 * ────────────────────────────────────────────────────────────────────────── */
function BarberRow({
  label,
  hint,
  active,
  disabled = false,
  onClick,
}: {
  label: string
  hint: string
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'group relative flex min-h-[52px] items-center justify-between gap-3 border-x border-b border-[var(--color-leather-muted)]/60 px-4 py-2.5 text-left transition-colors first:border-t',
        disabled && 'cursor-not-allowed opacity-30',
        !disabled && !active && 'cursor-pointer hover:bg-[var(--color-cuero-viejo)]',
        active && 'cursor-pointer border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08]',
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] bg-[var(--color-bravo)]"
        />
      )}
      <span
        className={cn(
          'text-[14px] font-bold',
          active ? 'text-[var(--color-bone)]' : 'text-[var(--color-bone-muted)] group-hover:text-[var(--color-bone)]',
        )}
      >
        {label}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
        {hint}
      </span>
    </button>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * ServicePicker — category chips + filtered cards.
 *
 * ALINEADO 1:1 con el catálogo del cobro (CatalogGrid + CheckoutPage):
 *  - Misma FUENTE de categorías (getCategories) y mismo ORDEN (sortOrder), sin
 *    tab "Todo" — el modelo de categorías descartó "Todo"/"Otros". Arranca en la
 *    primera categoría real, igual que effectiveCategoryId del checkout.
 *  - Mismo sort de ítems (sortCatalogItems: categoría → sortOrder → nombre) y
 *    onlyCategorized (sin categoría = no existe en POS). Servicios y combos
 *    INTERCALADOS por orden, no en secciones separadas por tipo.
 *  - SOLO servicios y combos (sin productos): un walk-in pide servicios; los
 *    productos se agregan al cobrar.
 *  - Exclusión por barbero preferido: oculta los servicios/combos que ese
 *    barbero no ofrece (excludedStaffIds del catálogo STATIC), igual que el grid
 *    del cobro con el atendiendo.
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

// Ítem unificado servicio|combo para el picker — la forma mínima que necesitan
// el orden (sortCatalogItems), el filtrado por categoría/barbero y las cards.
interface PickerItem {
  id: string
  kind: 'service' | 'combo'
  name: string
  categoryId: string | null
  sortOrder: number
  durationMin: number
  excludedStaffIds: string[]
}

interface ServicePickerProps {
  services: CatalogService[]
  combos: CatalogCombo[]
  categories: CatalogCategory[]
  selectedBarberId: string | null
  selectedBarberName: string | null
  selectedCategoryId: string | null
  onCategoryChange: (id: string | null) => void
  selection: PickerSelection
  onSelectionChange: (s: PickerSelection) => void
}

function ServicePicker({
  services,
  combos,
  categories,
  selectedBarberId,
  selectedBarberName,
  selectedCategoryId,
  onCategoryChange,
  selection,
  onSelectionChange,
}: ServicePickerProps) {
  // Ítems unificados servicio+combo con la MISMA fuente/orden/agrupación que el
  // catálogo del cobro: onlyCategorized (sin categoría = no existe en POS) +
  // sortCatalogItems (categoría → sortOrder → nombre). Sin productos.
  const items = useMemo<PickerItem[]>(() => {
    const svc: PickerItem[] = services.map((s) => ({
      id: s.id,
      kind: 'service',
      name: s.name,
      categoryId: s.categoryId,
      sortOrder: s.sortOrder,
      durationMin: s.durationMin,
      excludedStaffIds: s.excludedStaffIds ?? [],
    }))
    const cmb: PickerItem[] = combos.map((c) => ({
      id: c.id,
      kind: 'combo',
      name: c.name,
      categoryId: c.categoryId,
      sortOrder: c.sortOrder,
      durationMin: comboDurationMin(c, services),
      excludedStaffIds: c.excludedStaffIds ?? [],
    }))
    return sortCatalogItems(onlyCategorized([...svc, ...cmb]), categories)
  }, [services, combos, categories])

  // Tabs = categorías con al menos un servicio/combo, en el orden del cobro
  // (sortOrder). Estables ante el cambio de barbero (la exclusión afecta ítems,
  // no tabs) — igual que en el cobro, donde los chips no desaparecen al cambiar
  // de atendiendo; el grid muestra el vacío. Sin tab "Todo".
  const visibleCategories = useMemo(() => {
    const usedIds = new Set(items.map((i) => i.categoryId).filter((x): x is string => x != null))
    return categories
      .filter((c) => usedIds.has(c.id))
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [items, categories])

  // Sin "Todo": la categoría efectiva es la elegida por el operador o la primera
  // real del orden del cobro (mismo patrón que effectiveCategoryId del checkout).
  const effectiveCategoryId = selectedCategoryId ?? visibleCategories[0]?.id ?? null

  const itemsInCategory = useMemo(
    () => items.filter((i) => i.categoryId === effectiveCategoryId),
    [items, effectiveCategoryId],
  )
  // Oculta los servicios/combos que el barbero preferido NO ofrece, misma regla
  // que el grid del cobro con el atendiendo (excludedStaffIds).
  const shownItems = itemsInCategory.filter(
    (i) => selectedBarberId == null || !i.excludedStaffIds.includes(selectedBarberId),
  )

  const isLoading = services.length === 0 && combos.length === 0

  // Suma de duración total seleccionada. Servicios: suma; combo: su duración.
  const selectedDurationMin = useMemo(() => {
    const ids = selection.kind === 'services' ? selection.ids : selection.kind === 'combo' ? [selection.id] : []
    return ids.reduce((sum, id) => sum + (items.find((it) => it.id === id)?.durationMin ?? 0), 0)
  }, [selection, items])

  const selectedCount =
    selection.kind === 'services' ? selection.ids.length : selection.kind === 'combo' ? 1 : 0

  function toggleService(id: string) {
    if (selection.kind === 'services') {
      const ids = selection.ids.includes(id)
        ? selection.ids.filter((x) => x !== id)
        : [...selection.ids, id]
      onSelectionChange(ids.length === 0 ? { kind: 'empty' } : { kind: 'services', ids })
    } else {
      // Cambiando de combo a servicios sueltos — empezar con este servicio.
      onSelectionChange({ kind: 'services', ids: [id] })
    }
  }

  function toggleCombo(id: string) {
    if (selection.kind === 'combo' && selection.id === id) {
      onSelectionChange({ kind: 'empty' })
    } else {
      onSelectionChange({ kind: 'combo', id })
    }
  }

  function toggleItem(i: PickerItem) {
    if (i.kind === 'combo') toggleCombo(i.id)
    else toggleService(i.id)
  }

  function isItemActive(i: PickerItem): boolean {
    if (i.kind === 'combo') return selection.kind === 'combo' && selection.id === i.id
    return selection.kind === 'services' && selection.ids.includes(i.id)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <label className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Servicio
          {selectedCount > 1 && (
            <span className="ml-2 text-[var(--color-leather)]">· puedes agregar varios</span>
          )}
        </label>
        {selectedCount > 0 && (
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] tabular-nums text-[var(--color-bone)]">
            {selectedCount} {selectedCount === 1 ? 'servicio' : 'servicios'} · {selectedDurationMin} min
          </span>
        )}
      </div>

      {/* Filter tabs — mismas categorías/orden que el catálogo del cobro, sin
          "Todo". Flat text + bottom rule, no boxed. */}
      <div className="flex gap-5 overflow-x-auto border-b border-[var(--color-leather-muted)]/40">
        {visibleCategories.map((c) => (
          <FilterTab
            key={c.id}
            label={c.name}
            active={effectiveCategoryId === c.id}
            onClick={() => onCategoryChange(c.id)}
          />
        ))}
      </div>

      {/* Cards interpoladas servicio/combo en el orden del cobro (sin secciones
          por tipo). El tag "COMBO" distingue los combos, igual que CatalogTile. */}
      {isLoading ? (
        <p className="text-[12px] text-[var(--color-bone-muted)]">Cargando servicios…</p>
      ) : shownItems.length === 0 ? (
        <p className="py-4 text-[12px] text-[var(--color-bone-muted)]">
          {selectedBarberId != null && itemsInCategory.length > 0
            ? `${selectedBarberName ?? 'Ese barbero'} no ofrece servicios en esta categoría. Elige otro barbero.`
            : 'Sin opciones en esta categoría.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {shownItems.map((i) => (
            <PickerCard
              key={`${i.kind}-${i.id}`}
              title={i.name}
              meta={i.kind === 'combo' && i.durationMin === 0 ? 'Combo' : `${i.durationMin} min`}
              isCombo={i.kind === 'combo'}
              active={isItemActive(i)}
              onClick={() => toggleItem(i)}
            />
          ))}
        </div>
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

function PickerCard({
  title,
  meta,
  active,
  isCombo = false,
  onClick,
}: { title: string; meta: string; active: boolean; isCombo?: boolean; onClick: () => void }) {
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
      {/* Tag "COMBO" — mismo distintivo que la card del cobro (CatalogTile), la
          única señal de tipo ahora que servicios y combos van intercalados. */}
      {isCombo && (
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">
          Combo
        </span>
      )}
      <span className="text-[13px] font-bold text-[var(--color-bone)]">{title}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-bone-muted)]">
        {meta}
      </span>
    </button>
  )
}
