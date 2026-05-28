import { cn } from '@/shared/lib/cn'

export interface HoyRowProps {
  id: string
  kind: 'active' | 'next' | 'queue' | 'pending'
  timeLabel: string
  customerName: string
  customerPhotoUrl: string | null
  customerInitials: string
  serviceLabel: string
  meta: string | null
  pillLabel: string
  pillTone: 'serving' | 'appt' | 'walkin'
  sourceKind: 'appointment' | 'walk-in'
  sourceId: string
  onClick?: () => void
  /**
   * Trailing-edge "Finalizar" button. Surfaced for active walk-ins so the
   * operator can close out a row that was already paid as part of another
   * sale — e.g. a hijo that was billed on the papá's ticket. Calls the
   * `completeWalkIn` mutation, no checkout involved.
   */
  onFinalize?: () => void
  /**
   * True if this row is assigned to the viewing staff. We show the queue to
   * all barbers (so anyone can pick anyone up), but visually emphasize the
   * ones that "belong" to the viewer.
   */
  isMine?: boolean
  /** Name of the barber currently assigned, when it's not the viewer. */
  assignedToName?: string | null
}

export function HoyRow({
  kind,
  timeLabel,
  customerName,
  customerPhotoUrl,
  customerInitials,
  serviceLabel,
  meta,
  pillLabel,
  pillTone,
  onClick,
  onFinalize,
  isMine = true,
  assignedToName,
}: HoyRowProps) {
  const isActive = kind === 'active'
  const isNext = kind === 'next'
  const isQueue = kind === 'queue'
  // Queue item con preferencia para el viewer: lo destacamos como "para ti".
  // No es asignación (cualquiera puede tomarlo), pero el operador detecta de
  // un vistazo los clientes que vinieron específicamente por él.
  const isMineInQueue = isQueue && isMine
  // Active asignado a otro barbero: se ve en la lista para que el operador
  // tenga contexto del piso ("Javi está con Cliente Demo"), pero no debe
  // tener el peso visual de "tu turno". Cae a tono leather/neutral.
  const isActiveMine = isActive && isMine
  const isActiveOther = isActive && !isMine
  const isInteractive = typeof onClick === 'function'

  // Render the row as a div whenever the trailing Finalizar button is shown —
  // a button-inside-button is invalid HTML and the trailing action is the
  // only interactive element in that case anyway.
  const Tag = isInteractive && !onFinalize ? 'button' : 'div'
  const interactiveProps = isInteractive && !onFinalize
    ? ({ type: 'button' as const, onClick })
    : {}

  return (
    <Tag
      {...interactiveProps}
      className={cn(
        'group grid w-full grid-cols-[100px_56px_1fr_auto] items-center gap-4 border-b border-[var(--color-leather-muted)]/40 px-5 py-3 text-left transition-colors',
        // Hover notorio en tappables — antes era muy sutil y no comunicaba
        // affordance. Patrón Notion/Linear: bg shift visible al hover.
        isInteractive && 'cursor-pointer hover:bg-white/[0.04]',
        // Active de OTRO barbero: opacity reducida para empujarlo al fondo
        // visual. Está ahí para contexto del piso, no para competir con las
        // accionables. Patrón OpenTable host view / Booksy.
        isActiveOther && 'opacity-55',
        isActiveMine && 'border-l-[3px] border-l-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.06] pl-[calc(1.25rem-3px)]',
        isActiveOther && 'border-l-[2px] border-l-[var(--color-leather)] bg-[var(--color-cuero-viejo)]/20 pl-[calc(1.25rem-2px)]',
        isNext && 'border-l-[2px] border-l-[var(--color-leather)] bg-[var(--color-cuero-viejo)]/30 pl-[calc(1.25rem-2px)]',
        isMineInQueue && 'border-l-[2px] border-l-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.05] pl-[calc(1.25rem-2px)]',
        isQueue && !isMine && 'bg-[var(--color-cuero-viejo)]/10',
      )}
    >
      <span
        className={cn(
          'tabular-nums',
          isActiveMine
            ? 'font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]'
            : isActiveOther
              ? 'font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-leather)]'
              : isMineInQueue
                ? 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bravo)]'
                : isQueue
                  ? 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-leather)]'
                  : 'font-mono text-[13px] font-bold tracking-[0.04em] text-[var(--color-bone-muted)]',
        )}
      >
        {timeLabel}
      </span>

      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border bg-[var(--color-cuero-viejo)] text-[14px] font-bold text-[var(--color-bone)]',
          isActiveMine
            ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.12] text-[var(--color-bravo)]'
            : isActiveOther
              ? 'border-[var(--color-leather)] bg-[var(--color-cuero-viejo)]/40 text-[var(--color-leather)]'
              : isMineInQueue
                ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bravo)]'
                : isQueue
                  ? 'border border-dashed border-[var(--color-leather)] text-[var(--color-leather)]'
                  : 'border-[var(--color-leather-muted)]',
        )}
      >
        {customerPhotoUrl ? (
          <img
            src={customerPhotoUrl}
            alt={customerName}
            className="h-full w-full object-cover"
          />
        ) : (
          customerInitials
        )}
      </div>

      <div className="min-w-0">
        <p
          className={cn(
            'text-[16px] font-bold leading-tight text-[var(--color-bone)]',
            isActive && 'text-[17px]',
          )}
        >
          {customerName}
        </p>
        <p className="mt-0.5 truncate text-[12px] text-[var(--color-bone-muted)]">
          <strong className="font-semibold text-[var(--color-bone-muted)]">{serviceLabel}</strong>
          {meta && <span> · {meta}</span>}
          {!isMine && assignedToName && (
            <span className="text-[var(--color-leather)]"> · asignado a {assignedToName}</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={cn(
            'border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em]',
            pillTone === 'serving' && 'border-[var(--color-bravo)] text-[var(--color-bravo)]',
            pillTone === 'appt' && 'border-[var(--color-leather-muted)] text-[var(--color-bone-muted)]',
            pillTone === 'walkin' && 'border-[var(--color-leather)] text-[var(--color-leather)]',
          )}
        >
          {pillLabel}
        </span>
        {onFinalize && (
          <button
            type="button"
            onClick={onFinalize}
            className="cursor-pointer border border-[var(--color-leather-muted)] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] hover:border-[var(--color-bone)] hover:text-[var(--color-bone)]"
          >
            Finalizar
          </button>
        )}
        {/* Chevron affordance: aparece solo si la fila es tappable (queue).
            Always-visible (no solo on hover) para que funcione en tablet
            touch. Color cambia al hover usando el group selector del row
            para reforzar "tap me". Patrón Toast POS / OpenTable. */}
        {isInteractive && !onFinalize && (
          <span
            aria-hidden
            className="font-mono text-[16px] leading-none text-[var(--color-leather)] transition-colors group-hover:text-[var(--color-bone)]"
          >
            ›
          </span>
        )}
      </div>
    </Tag>
  )
}
