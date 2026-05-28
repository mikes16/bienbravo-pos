import { formatMoney } from '@/shared/lib/money'
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
  /** True while the CTA action is in-flight — dims + spinner on the bar. */
  ctaBusy?: boolean
}

function pluralizeServicios(n: number): string {
  return n === 1 ? '1 servicio' : `${n} servicios`
}

function commissionCaption(amountCents: number, serviceCount: number): string {
  if (amountCents === 0 && serviceCount === 0) {
    return '0 servicios · empezamos el día'
  }
  return pluralizeServicios(serviceCount)
}

export function HoyView({ vm, onCtaClick, onGateAction, onAddWalkIn, onFinalizeWalkIn, onTakeQueueItem, ctaBusy = false }: HoyViewProps) {
  if (vm.gate) {
    return <HoyGate staffName={vm.staffName} gate={vm.gate} onAction={onGateAction} />
  }

  const firstName = vm.staffName.split(' ')[0] ?? vm.staffName

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-3 pb-2">
        <p className="text-[13px] text-[var(--color-bone-muted)]">
          Hola, <strong className="font-bold text-[var(--color-bone)]">{firstName}</strong>.
        </p>
      </div>

      <div className="flex items-baseline gap-4 border-b border-[var(--color-leather-muted)]/40 px-5 pb-3">
        <span className="font-[var(--font-pos-display)] text-[38px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-[var(--color-bone)]">
          {vm.commission.loading ? '—' : formatMoney(vm.commission.amountCents)}
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
            COMISIONES HOY
          </span>
          <span className="text-[11px] text-[var(--color-bone-muted)]">
            {commissionCaption(vm.commission.amountCents, vm.commission.serviceCount)}
          </span>
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
            return (
              <HoyRow
                key={row.id}
                {...row}
                onClick={takeable ? () => onTakeQueueItem(row) : undefined}
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
