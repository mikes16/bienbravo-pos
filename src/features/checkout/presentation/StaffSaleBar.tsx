import { useState } from 'react'
import { MoneyValue, SkeletonText, TouchButton } from '@/shared/pos-ui'
import { cn } from '@/shared/lib/cn'
import { BarberSelectorSheet } from './BarberSelectorSheet'
import type { StaffQuotaView } from '../lib/staff-sale'

/**
 * Barra del modo "venta a staff" en el cobro (spec
 * `docs/superpowers/specs/2026-09-18-venta-a-staff-design.md` §4.5).
 *
 * Interruptor + comprador + cupo del mes. No decide nada: todo el estado llega
 * de `useCheckout().staffSale` y el API vuelve a medir precio, elegibilidad y
 * topes al cobrar (handoff T-031). Sin permiso la barra NO existe: el cobro se
 * ve exactamente como siempre.
 */

interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
}

/**
 * Lo que la barra necesita de `useCheckout().staffSale`. Se declara aquí (y no
 * se importa el tipo del hook) siguiendo la convención de este directorio
 * —BarberSelectorSheet declara su propio `Barber`—: el componente se prueba
 * con objetos mínimos y el call site sigue chequeando por estructura.
 */
interface StaffSaleState {
  /** El viewer tiene `pos.staff_sale.create` o `…create_for_others`. */
  available: boolean
  /** Puede cobrarle la compra a OTRO barbero (recepción). */
  canSellForOthers: boolean
  enabled: boolean
  buyerStaffUserId: string | null
  /** El cupo está viajando: ninguna cifra de este bloque es vigente. */
  loading: boolean
  /** Por qué no se pudo encender el modo (política apagada, cupo ilegible). */
  error: string | null
  /** `null` = no hay cupo leído; con `loading` es "todavía no sé". */
  quotaView: StaffQuotaView | null
  blockMessage: string | null
}

interface StaffSaleBarProps {
  staffSale: StaffSaleState
  /** Roster de la sucursal: de aquí sale el NOMBRE del comprador. */
  barbers: Barber[]
  /** Interruptor. Encender es asíncrono (el cupo primero, [D-055]). */
  onToggle: (next: boolean) => void
  onSelectBuyer: (staffUserId: string) => void
}

/** Etiquetas accesibles de las dos cifras del tope de monto ([D-006]). */
const AMOUNT_USED_LABEL = 'Valor usado este mes'
const AMOUNT_LIMIT_LABEL = 'Tope de valor del mes'

const CAPTION_CLASSES =
  'font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]'
const ROW_CLASSES = 'flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--color-bone)]'

export function StaffSaleBar({ staffSale, barbers, onToggle, onSelectBuyer }: StaffSaleBarProps) {
  const [buyerSheetOpen, setBuyerSheetOpen] = useState(false)

  // Sin ninguno de los dos permisos el interruptor ni se ofrece (spec §5): el
  // cobro queda idéntico a como estaba antes de esta pantalla.
  if (!staffSale.available) return null

  const { enabled, loading, quotaView } = staffSale
  const buyer = barbers.find((b) => b.id === staffSale.buyerStaffUserId) ?? null
  const units = quotaView?.units ?? null
  const amount = quotaView?.listAmountCents ?? null
  // Sin tope de ningún lado no hay nada que contar: un solo renglón lo dice.
  const noLimits = units?.limit === null && amount?.limit === null

  return (
    <div
      className={cn(
        'flex flex-col gap-2 border px-3 py-2.5',
        // Franja: encendido el bloque se enmarca en rojo Bravo para que nadie
        // cobre a precio staff creyendo que es una venta normal.
        enabled
          ? 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.06]'
          : 'border-[var(--color-leather-muted)]/40',
      )}
    >
      {enabled && (
        // Encabezado de la franja. Es el rótulo del modo, no un saludo: [D-010]
        // prohíbe repetir identidad decorativa, no rotular el modo de cobro.
        <h2 className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--color-bravo)]">
          Venta a staff
        </h2>
      )}

      {/* `size="row"` (48 px) y no `min` (40 px): el área táctil del interruptor
          no puede bajar de 44 px en la iPad. Mientras el cupo viaja el botón se
          deshabilita — encender es asíncrono y un segundo toque encimaría dos
          lecturas del cupo. */}
      <TouchButton
        role="switch"
        aria-checked={enabled}
        variant="ghost"
        size="row"
        disabled={loading}
        onClick={() => onToggle(!enabled)}
        className="w-full justify-between gap-3 px-0"
      >
        <span className="text-[14px] font-medium text-[var(--color-bone)]">Venta a staff</span>
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex h-6 w-12 shrink-0 items-center border p-[2px] transition-colors',
            enabled
              ? 'justify-end border-[var(--color-bravo)] bg-[var(--color-bravo)]/25'
              : 'justify-start border-[var(--color-leather-muted)]',
          )}
        >
          <span
            className={cn(
              'h-[18px] w-[18px]',
              enabled ? 'bg-[var(--color-bravo)]' : 'bg-[var(--color-bone-muted)]',
            )}
          />
        </span>
      </TouchButton>

      {/* El modo no se activó (política apagada o cupo ilegible, [D-055]): el
          interruptor se quedó apagado y esto dice por qué. */}
      {staffSale.error && (
        <p role="alert" className="text-[12px] leading-snug text-[var(--color-bravo)]">
          {staffSale.error}
        </p>
      )}

      {enabled && (
        <div className="flex items-center justify-between gap-2">
          {/* Mayúsculas por CSS: el DOM conserva la capitalización real del
              nombre para que un lector de pantalla no lo deletree. */}
          <p className="min-w-0 truncate font-[var(--font-pos-display)] text-[18px] font-extrabold uppercase leading-none tracking-[-0.01em] text-[var(--color-bone)]">
            Compra: {buyer?.fullName ?? 'Sin identificar'}
          </p>
          {staffSale.canSellForOthers && (
            <TouchButton
              variant="secondary"
              size="min"
              style={{ minHeight: '44px' }}
              onClick={() => setBuyerSheetOpen(true)}
              className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
            >
              Cambiar
            </TouchButton>
          )}
        </div>
      )}

      {/* Cupo del mes. Mientras viaja, NINGÚN número: el que hay en memoria es
          el del comprador anterior ([D-020] llevado al cupo). */}
      {enabled && (loading || quotaView !== null) && (
        <div role="group" aria-label="Cupo del mes" className="flex flex-col gap-1">
          <p className={CAPTION_CLASSES}>Cupo del mes</p>
          {loading ? (
            <>
              <p className={ROW_CLASSES}>
                Productos:
                <span className="inline-block w-[6ch]">
                  <SkeletonText className="motion-reduce:animate-none" />
                </span>
              </p>
              <p className={ROW_CLASSES}>
                Valor:
                <MoneyValue status="loading" cents={null} label={AMOUNT_USED_LABEL} size="S" />
                de
                <MoneyValue status="loading" cents={null} label={AMOUNT_LIMIT_LABEL} size="S" />
              </p>
            </>
          ) : (
            <>
              {units && units.limit !== null && (
                <p className={ROW_CLASSES}>
                  Productos: {units.used + units.inCart} de {units.limit}
                </p>
              )}
              {amount && amount.limit !== null && (
                <p className={ROW_CLASSES}>
                  Valor:
                  <MoneyValue
                    status="fresh"
                    cents={amount.used + amount.inCart}
                    label={AMOUNT_USED_LABEL}
                    size="S"
                  />
                  de
                  <MoneyValue
                    status="fresh"
                    cents={amount.limit}
                    label={AMOUNT_LIMIT_LABEL}
                    size="S"
                  />
                </p>
              )}
              {noLimits && <p className={ROW_CLASSES}>Sin tope este mes</p>}
            </>
          )}
        </div>
      )}

      {/* Qué impide cobrar, en rojo Bravo: tope rebasado, línea sin precio
          staff, servicio no admitido o cupo ilegible. Es el mismo texto que
          deja `canCharge` en false, así que el CTA deshabilitado nunca queda
          sin explicación. El del API gana cuando el rechazo llega. */}
      {enabled && staffSale.blockMessage && (
        <p className="text-[12px] leading-snug text-[var(--color-bravo)]">
          {staffSale.blockMessage}
        </p>
      )}

      <BarberSelectorSheet
        open={buyerSheetOpen}
        // Comprar no exige turno iniciado (eso es regla de ATENDER): se omite
        // `hasClockedIn` para que el sheet no bloquee a un barbero sin checar.
        barbers={barbers.map((b) => ({ id: b.id, fullName: b.fullName, photoUrl: b.photoUrl }))}
        currentBarberId={staffSale.buyerStaffUserId ?? ''}
        onSelect={onSelectBuyer}
        onClose={() => setBuyerSheetOpen(false)}
      />
    </div>
  )
}
