import type { WalkIn } from '../domain/walkins.types.ts'

type Props = {
  staffUserId: string
  staffName: string
  suggestion: WalkIn | null
  onAssign: () => void
  onSkip: () => void
}

/**
 * Recommendation card surfaced above the queue when an operator picks
 * a barbero in the "ver siguiente para" selector. Shows either:
 *  - empty state ("Ningún walk-in disponible para X")
 *  - the suggested walk-in with a "Preferido" badge when the customer
 *    asked specifically for this barbero, otherwise "Cualquiera"
 *    (this barber would be taking a customer with no preference)
 *
 * `onSkip` lets the operator advance to the next candidate; the parent
 * re-queries the API and either gets the next match or null.
 */
export function SuggestedNextCard({
  staffUserId,
  staffName,
  suggestion,
  onAssign,
  onSkip,
}: Props) {
  if (!suggestion) {
    return (
      <div className="mb-4 border border-[var(--color-leather-muted)]/40 bg-[var(--color-cuero-viejo)] p-4">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
          Siguiente para {staffName}
        </div>
        <p className="text-sm text-[var(--color-bone-muted)]">
          Ningún walk-in disponible para {staffName} ahora.
        </p>
      </div>
    )
  }

  const customerName =
    suggestion.customer?.fullName ?? suggestion.customerName ?? 'Cliente'
  const serviceLabel =
    suggestion.requestedService?.name ??
    suggestion.requestedCatalogCombo?.name ??
    '—'
  const isPreferredMatch = suggestion.preferredStaffUserId === staffUserId

  return (
    <div className="mb-4 border border-[var(--color-success)]/40 bg-[var(--color-bone)]/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
          Siguiente para {staffName}
        </div>
        <span
          className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${
            isPreferredMatch
              ? 'border-[var(--color-success)] text-[var(--color-success)]'
              : 'border-[var(--color-bone-muted)] text-[var(--color-bone-muted)]'
          }`}
        >
          {isPreferredMatch ? 'Preferido' : 'Cualquiera'}
        </span>
      </div>
      <div className="text-base text-[var(--color-bone)]">{customerName}</div>
      <div className="mb-3 text-xs text-[var(--color-bone-muted)]">{serviceLabel}</div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAssign}
          className="flex-1 cursor-pointer bg-[var(--color-bravo)] py-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-bone)]"
        >
          Asignar a {staffName}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="cursor-pointer bg-[var(--color-leather)] px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--color-bone)]"
        >
          Pasar
        </button>
      </div>
    </div>
  )
}
