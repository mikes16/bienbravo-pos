import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'

interface CatalogListRowProps {
  kind: 'service' | 'product' | 'combo'
  name: string
  priceCents: number
  stockQty?: number
  imageUrl?: string | null
  onAdd: () => void
  // Overlay del nuevo atendiendo en vuelo: atenúa el precio (patrón previousData).
  updating?: boolean
  // ── Modo venta a staff (spec §4.5). Mismas tres props opcionales que
  //    CatalogTile: la fila del móvil y la card de tablet se comportan igual.
  //    Sin ellas la fila es exactamente la de siempre.
  staffMode?: boolean
  // Precio staff resuelto. `null` = no hay ninguno que pintar ([D-042]) y la
  // fila no se puede agregar.
  staffPriceCents?: number | null
  // Motivo del bloqueo; sólo llega al texto accesible (en la fila cabe la
  // etiqueta corta).
  staffUnavailableMessage?: string | null
}

const LOW_STOCK_THRESHOLD = 5

export function CatalogListRow({
  kind,
  name,
  priceCents,
  stockQty,
  imageUrl,
  onAdd,
  updating,
  staffMode,
  staffPriceCents,
  staffUnavailableMessage,
}: CatalogListRowProps) {
  const isOutOfStock = kind === 'product' && stockQty === 0
  const isLowStock = kind === 'product' && typeof stockQty === 'number' && stockQty > 0 && stockQty <= LOW_STOCK_THRESHOLD

  // Misma resolución que CatalogTile: con motivo de bloqueo no hay precio staff
  // que pintar, y sin precio staff la fila no se puede agregar en modo staff.
  const staffPrice =
    staffMode === true && staffUnavailableMessage == null ? (staffPriceCents ?? null) : null
  const staffBlocked = staffMode === true && staffPrice === null
  // Agotado manda cuando también aplica (es lo accionable).
  const showStaffBadge = staffBlocked && !isOutOfStock
  const disabled = isOutOfStock || staffBlocked

  // El número que se ve en modo staff es el precio STAFF: el texto accesible
  // dice cuál es cuál y nombra el público tachado ([D-057]). Sin modo staff no
  // hay aria-label y la fila se anuncia con su contenido, como siempre.
  const staffLabel =
    staffMode === true
      ? [
          name,
          staffPrice !== null
            ? `precio staff ${formatMoney(staffPrice)}, precio público anterior ${formatMoney(priceCents)}`
            : formatMoney(priceCents),
          ...(staffBlocked
            ? [
                staffUnavailableMessage
                  ? `No disponible para staff: ${staffUnavailableMessage}`
                  : 'No disponible para staff',
              ]
            : []),
          ...(isOutOfStock ? ['agotado'] : []),
          ...(isLowStock ? [`quedan ${stockQty}`] : []),
        ].join(', ')
      : undefined

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={staffLabel}
      onClick={onAdd}
      className={cn(
        'flex w-full items-center gap-3 border-b border-[var(--color-leather-muted)]/40 px-4 py-3 text-left transition-colors last:border-b-0',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-pointer hover:bg-[var(--color-cuero-viejo)]',
      )}
    >
      <div
        className="relative h-20 w-20 shrink-0 overflow-hidden bg-[var(--color-carbon)]"
        style={
          imageUrl
            ? {
                backgroundImage: `url(${encodeURI(imageUrl)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {kind === 'combo' && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">
            COMBO
          </span>
        )}
        <span className="truncate text-[15px] font-bold text-[var(--color-bone)]">{name}</span>
        {showStaffBadge && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--color-bravo)]">
            No disponible para staff
          </span>
        )}
        {isOutOfStock && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--color-bravo)]">
            agotado
          </span>
        )}
        {isLowStock && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--color-warning)]">
            {stockQty} left
          </span>
        )}
      </div>

      <span className="flex shrink-0 items-baseline gap-1.5">
        {/* Precio público superado por el staff: `<s>` con role explícito, no
            una clase de line-through ([D-057]). */}
        {staffPrice !== null && (
          <s role="deletion" className="text-[12px] font-bold tabular-nums text-[var(--color-bone-muted)]">
            {formatMoney(priceCents)}
          </s>
        )}
        <span
          aria-busy={updating || undefined}
          className={cn(
            'text-[18px] font-extrabold tabular-nums text-[var(--color-bone)] transition-opacity duration-200',
            updating && 'opacity-40',
          )}
        >
          {formatMoney(staffPrice ?? priceCents)}
        </span>
      </span>
    </button>
  )
}
