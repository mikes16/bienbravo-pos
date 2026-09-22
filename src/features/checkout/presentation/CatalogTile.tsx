import { cn } from '@/shared/lib/cn'
import { formatMoney } from '@/shared/lib/money'
import { cldThumb } from '@/shared/lib/cloudinary'

interface CatalogTileProps {
  kind: 'service' | 'product' | 'combo'
  name: string
  priceCents: number
  stockQty?: number
  imageUrl?: string | null
  onAdd: () => void
  // El overlay del nuevo atendiendo está en vuelo: atenuamos el precio para no
  // presentar el del barbero anterior como el actual (patrón previousData).
  updating?: boolean
  // ── Modo venta a staff (spec §4.5). Las tres props son ADITIVAS y
  //    opcionales: sin ellas la card es exactamente la de siempre. Quien las
  //    manda es CatalogGrid, que ya resolvió qué card va en modo staff (sólo
  //    productos, y sólo con una vista del hook): el tile no decide nada.
  //
  // ¿Esta card va en modo venta a staff?
  staffMode?: boolean
  // Precio staff resuelto para el producto. `null` = no hay ninguno que pintar
  // ([D-042]: jamás 0 ni el público como aproximación) y la card no se puede
  // agregar.
  staffPriceCents?: number | null
  // Por qué este producto no se puede vender a staff ("Elige la presentación",
  // "…no está disponible para venta a staff"). Sólo llega al texto accesible:
  // en la card cabe la etiqueta corta.
  staffUnavailableMessage?: string | null
}

const LOW_STOCK_THRESHOLD = 5

export function CatalogTile({
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
}: CatalogTileProps) {
  const isOutOfStock = kind === 'product' && stockQty === 0
  const isLowStock = kind === 'product' && typeof stockQty === 'number' && stockQty > 0 && stockQty <= LOW_STOCK_THRESHOLD

  // Precio staff a cobrar por esta card. Con un motivo de bloqueo no hay precio
  // que pintar aunque llegara uno: la card no es vendible a staff.
  const staffPrice =
    staffMode === true && staffUnavailableMessage == null ? (staffPriceCents ?? null) : null
  // En modo staff, sin precio staff la card NO se puede agregar: agregarla la
  // cobraría a precio público en un ticket de staff. `addCatalogItem` también
  // la rechaza; esto evita el tap.
  const staffBlocked = staffMode === true && staffPrice === null
  // Agotado manda cuando también aplica: es lo accionable (reponer), y el
  // producto no se puede agregar por ninguna de las dos razones.
  const showStaffBadge = staffBlocked && !isOutOfStock
  const disabled = isOutOfStock || staffBlocked

  // En modo staff el número que se ve es el precio STAFF, así que el texto
  // accesible tiene que decir cuál es cuál — y nombrar el público tachado, que
  // si no sería información sólo visual ([D-057]). Fuera del modo staff no hay
  // aria-label: la card se sigue anunciando con su contenido, como siempre.
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
    <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
      <button
        type="button"
        disabled={disabled}
        aria-label={staffLabel}
        onClick={onAdd}
        className={cn(
          // No borders — the dark background + image / panel colour gives
          // each tile its own boundary. Hover indicator is a subtle
          // background brightening so the operator still gets feedback
          // without the hairline that read as a "weird margin" on tablet.
          'absolute inset-0 flex flex-col items-start justify-between overflow-hidden bg-[var(--color-carbon-elevated)] p-3 text-left transition-colors focus:outline-none',
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer hover:bg-[var(--color-cuero-viejo)]',
        )}
        style={
          imageUrl
            ? {
                // Tiles render ~200×200 (responsive grid). dpr:auto sirve 1x
                // o 2x según el device; antes serving full-res significaba
                // 1-3MB por tile en algunos productos.
                backgroundImage: `url(${encodeURI(cldThumb(imageUrl, { w: 200, h: 200, dpr: 'auto' }) ?? imageUrl)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="flex flex-col gap-1">
          {kind === 'combo' && (
            <span className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">COMBO</span>
          )}
          <span className="text-[14px] font-bold leading-tight text-[var(--color-bone)] [text-shadow:_0_1px_2px_rgba(0,0,0,0.7)]">{name}</span>
        </div>
        <div className="flex w-full flex-col gap-1">
          {showStaffBadge && (
            <span className="font-mono text-[9px] font-bold uppercase leading-tight tracking-[0.12em] text-[var(--color-bravo)] [text-shadow:_0_1px_2px_rgba(0,0,0,0.7)]">
              No disponible para staff
            </span>
          )}
          <div className="flex w-full items-end justify-between gap-2">
            <span className="flex items-baseline gap-1.5">
              {/* Precio público superado por el staff. `<s>` con role explícito
                  (el implícito no lo mapea el motor de roles de las pruebas),
                  nunca una clase de line-through suelta ([D-057]). */}
              {staffPrice !== null && (
                <s
                  role="deletion"
                  className="text-[12px] font-bold tabular-nums text-[var(--color-bone-muted)] [text-shadow:_0_1px_2px_rgba(0,0,0,0.7)]"
                >
                  {formatMoney(priceCents)}
                </s>
              )}
              <span
                aria-busy={updating || undefined}
                className={cn(
                  'text-[18px] font-extrabold tabular-nums text-[var(--color-bone)] [text-shadow:_0_1px_2px_rgba(0,0,0,0.7)] transition-opacity duration-200',
                  updating && 'opacity-40',
                )}
              >
                {formatMoney(staffPrice ?? priceCents)}
              </span>
            </span>
            {isLowStock && (
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--color-warning)]">
                {stockQty} left
              </span>
            )}
            {isOutOfStock && (
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--color-bravo)]">
                agotado
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  )
}
