import { useState, useEffect } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'

interface CustomerLite {
  id: string
  fullName: string
  email: string | null
  phone: string | null
}

interface CustomerLookupSheetProps {
  open: boolean
  results: CustomerLite[]
  onSearchChange: (q: string) => void
  onSelect: (customer: CustomerLite) => void
  onCreate: (input: { fullName: string; phone?: string; email?: string }) => void
  onClose: () => void
}

export function CustomerLookupSheet({
  open,
  results,
  onSearchChange,
  onSelect,
  onCreate,
  onClose,
}: CustomerLookupSheetProps) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // ESC cierra el sheet. Resetea el modo creating al cerrar para que la
  // próxima apertura inicie en search step, no en el form a medio llenar.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Cuando el sheet cierra (open va a false), limpia el form para que la
  // próxima apertura no muestre el texto viejo.
  useEffect(() => {
    if (!open) {
      setCreating(false)
      setName('')
      setPhone('')
      setEmail('')
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label="Buscar cliente"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl border-t border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-6 py-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con título + back + close. Siempre visible, da al usuario
            una salida explícita en cualquier paso. */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {creating && (
              <button
                type="button"
                onClick={() => setCreating(false)}
                aria-label="Volver a buscar"
                className="cursor-pointer font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] transition-colors hover:text-[var(--color-bone)]"
              >
                ← Buscar
              </button>
            )}
            <p className="font-[var(--font-pos-display)] text-[16px] font-extrabold uppercase tracking-[0.04em] text-[var(--color-bone)]">
              {creating ? 'Crear cliente' : 'Buscar cliente'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 cursor-pointer items-center justify-center text-[20px] leading-none text-[var(--color-bone-muted)] transition-colors hover:text-[var(--color-bone)]"
          >
            ×
          </button>
        </div>

        {!creating ? (
          <>
            <input
              type="text"
              aria-label="Buscar cliente"
              placeholder="Nombre, teléfono o email"
              onChange={(e) => onSearchChange(e.target.value)}
              className="mb-4 w-full border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2 text-[14px] text-[var(--color-bone)] outline-none placeholder:text-[var(--color-bone-muted)]"
            />
            <div className="max-h-64 overflow-y-auto">
              {results.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <p className="text-[13px] text-[var(--color-bone-muted)]">Sin resultados</p>
                  <TouchButton
                    variant="primary"
                    size="min"
                    onClick={() => setCreating(true)}
                    className="rounded-none"
                  >
                    Crear nuevo
                  </TouchButton>
                </div>
              ) : (
                results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelect(c)}
                    className="flex w-full cursor-pointer flex-col items-start gap-1 border-b border-[var(--color-leather-muted)]/30 px-3 py-2 text-left transition-colors hover:bg-[var(--color-cuero-viejo)]"
                  >
                    <span className="text-[14px] text-[var(--color-bone)]">{c.fullName}</span>
                    {(c.email || c.phone) && (
                      <span className="font-mono text-[10px] text-[var(--color-bone-muted)]">
                        {c.email ?? c.phone}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Nombre completo (requerido)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Nombre"
              className="border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2 text-[14px] text-[var(--color-bone)] outline-none placeholder:text-[var(--color-bone-muted)]"
            />
            <input
              type="tel"
              placeholder="Teléfono (opcional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-label="Teléfono"
              className="border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2 text-[14px] text-[var(--color-bone)] outline-none placeholder:text-[var(--color-bone-muted)]"
            />
            <input
              type="email"
              placeholder="Email (opcional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email"
              className="border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2 text-[14px] text-[var(--color-bone)] outline-none placeholder:text-[var(--color-bone-muted)]"
            />
            <TouchButton
              variant="primary"
              size="primary"
              disabled={!name.trim()}
              onClick={() =>
                onCreate({
                  fullName: name.trim(),
                  phone: phone.trim() || undefined,
                  email: email.trim() || undefined,
                })
              }
              className="rounded-none"
            >
              Crear cliente
            </TouchButton>
          </div>
        )}
      </div>
    </div>
  )
}
