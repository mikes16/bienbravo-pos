import { formatMoney } from '@/shared/lib/money'
import { HoyRow } from './HoyRow'
import { ContextualCTABar } from './ContextualCTABar'
import type { HoyViewModel } from './deriveHoyViewModel'

interface HoyViewProps {
  vm: HoyViewModel
  onCtaClick: () => void
  onRowClick: (rowId: string) => void
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

export function HoyView({ vm, onCtaClick, onRowClick }: HoyViewProps) {
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

      <div className="flex-1 overflow-y-auto">
        {vm.rows.length === 0 ? (
          <div className="flex h-full items-center justify-center px-5 py-12 text-center">
            <p className="text-[13px] text-[var(--color-bone-muted)]">
              Hoy todavía no tienes movimiento
            </p>
          </div>
        ) : (
          vm.rows.map((row) => (
            <HoyRow
              key={row.id}
              {...row}
              onClick={() => onRowClick(row.id)}
            />
          ))
        )}
      </div>

      <ContextualCTABar
        metaLabel={vm.cta.metaLabel}
        actionLabel={vm.cta.actionLabel}
        variant={vm.cta.variant}
        onClick={onCtaClick}
      />
    </div>
  )
}
