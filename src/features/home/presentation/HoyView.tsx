import { MoneyValue } from '@/shared/pos-ui'
import { HoyRow } from './HoyRow'
import { ContextualCTABar } from './ContextualCTABar'
import { HoyGate } from './HoyGate'
import type { HoyViewModel, HoyRowData } from './deriveHoyViewModel'

interface HoyViewProps {
  vm: HoyViewModel
  onCtaClick: () => void
  onGateAction: () => void
  onAddWalkIn: () => void
  /**
   * Operator wants to close out a walk-in without going through checkout
   * (e.g. an acompañante that was already paid on someone else's ticket).
   * Surfaced only for active walk-in rows.
   */
  onFinalizeWalkIn?: (walkInId: string, customerName: string) => void
  /**
   * Tap en una fila de cola: el operador quiere atender específicamente a
   * ese walk-in (saltando el FIFO si no es el primero). HoyPage abre el
   * sheet de confirmación con los datos del row.
   */
  onTakeQueueItem?: (row: HoyRowData) => void
  /**
   * Tap en una cita "Sin barbero" (row.isUnassignedAppt): el operador se
   * auto-asigna la cita. Mismo sheet de confirmación que onTakeQueueItem,
   * pero HoyPage lo rama hacia reassignAppointment en vez de assignWalkIn.
   */
  onTakeAppointment?: (row: HoyRowData) => void
  /** True while the CTA action is in-flight — dims + spinner on the bar. */
  ctaBusy?: boolean
  /**
   * Reintentar la carga de comisiones tras un fallo del servidor. Sin él, el
   * estado `error` de la cifra se queda sin salida (spec § 3.1b).
   */
  onRetryCommission?: () => void
}

/** Etiqueta accesible de la cifra ([D-006]: `label` es obligatoria). */
const COMMISSION_LABEL = 'Comisiones hoy'

function pluralizeServicios(n: number): string {
  return n === 1 ? '1 servicio' : `${n} servicios`
}

/**
 * Pie de la cifra. Mientras el servidor no responde NO hay conteo: "no sé"
 * jamás se disfraza de "0 servicios" (sería un dígito falso junto a una cifra
 * que todavía es esqueleto). En offline/error el propio MoneyValue explica
 * qué pasó, así que el pie se calla.
 */
function commissionCaption(commission: HoyViewModel['commission']): string | null {
  const { amountCents, serviceCount, status } = commission
  if (amountCents === null || serviceCount === null) {
    return status === 'loading' ? 'Cargando…' : null
  }
  if (amountCents === 0 && serviceCount === 0) {
    return '0 servicios · empezamos el día'
  }
  return pluralizeServicios(serviceCount)
}

export function HoyView({ vm, onCtaClick, onGateAction, onAddWalkIn, onFinalizeWalkIn, onTakeQueueItem, onTakeAppointment, ctaBusy = false, onRetryCommission }: HoyViewProps) {
  if (vm.gate) {
    return <HoyGate staffName={vm.staffName} gate={vm.gate} onAction={onGateAction} />
  }

  const caption = commissionCaption(vm.commission)

  return (
    <div className="flex h-full flex-col">
      {/* R9: el saludo con el nombre del operador se eliminó de aquí. La
          identidad de la sesión vive en la barra superior (IdentityStripV2),
          que es persistente en todas las pestañas y la canta a 28 px; aquí
          era un dato chico, redundante y sólo visible en "Hoy". El padding
          superior que gastaba ese bloque pasa a las comisiones.

          Comisiones del día: dinero del servidor, así que se pinta con
          MoneyValue ([D-005]) y con el estado que decidió quien lo cargó.
          Antes era un numeral suelto que mostraba "—" en la carga y la cifra
          anterior en cualquier otro caso; ahora cargando es esqueleto (cero
          dígitos) y un fallo nunca deja el número viejo en pantalla. */}
      <div className="flex items-baseline gap-4 border-b border-[var(--color-leather-muted)]/40 px-5 pt-4 pb-3">
        <MoneyValue
          status={vm.commission.status}
          cents={vm.commission.amountCents}
          label={COMMISSION_LABEL}
          size="S"
          onRetry={onRetryCommission}
        />
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
            COMISIONES HOY
          </span>
          {caption && <span className="text-[11px] text-[var(--color-bone-muted)]">{caption}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-leather-muted)]/40 px-5 py-2.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Hoy
        </span>
        <button
          type="button"
          onClick={onAddWalkIn}
          className="cursor-pointer font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-bravo)] hover:text-[var(--color-bone)]"
        >
          + Agregar walk-in
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {vm.rows.length === 0 ? (
          <div className="flex h-full items-center justify-center px-5 py-12 text-center">
            <p className="text-[13px] text-[var(--color-bone-muted)]">
              Hoy todavía no tienes movimiento
            </p>
          </div>
        ) : (
          vm.rows.map((row) => {
            // Finalizar es acción del dueño del walk-in. Si está asignado a
            // otro barbero (no isMine), el viewer no debe verlo — sería
            // simétrico al bug del CTA que cobraba lo de otro.
            const finalizable = row.kind === 'active' && row.sourceKind === 'walk-in' && row.isMine && onFinalizeWalkIn
            // Las filas en cola son tappables si el viewer puede tomarlas:
            // un tap abre el sheet de confirmación que ejecuta el assign.
            // Mutex con onFinalize: la fila tappable y el botón Finalizar son
            // estados distintos (queue vs active), no chocan.
            const takeable = row.kind === 'queue' && row.sourceKind === 'walk-in' && onTakeQueueItem
            // Cita "Sin barbero" (isUnassignedAppt): mismo patrón de tap →
            // sheet de confirmación, pero ejecuta reassignAppointment.
            const takeableAppt = row.sourceKind === 'appointment' && row.isUnassignedAppt && onTakeAppointment
            const onRowClick = takeable
              ? () => onTakeQueueItem(row)
              : takeableAppt
                ? () => onTakeAppointment(row)
                : undefined
            return (
              <HoyRow
                key={row.id}
                {...row}
                onClick={onRowClick}
                onFinalize={finalizable ? () => onFinalizeWalkIn(row.sourceId, row.customerName) : undefined}
              />
            )
          })
        )}
      </div>

      <ContextualCTABar
        metaLabel={vm.cta.metaLabel}
        actionLabel={vm.cta.actionLabel}
        variant={vm.cta.variant}
        onClick={onCtaClick}
        busy={ctaBusy}
      />
    </div>
  )
}
