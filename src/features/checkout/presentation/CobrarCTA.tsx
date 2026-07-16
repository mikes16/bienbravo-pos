import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { formatMoney } from '@/shared/lib/money'

interface CobrarCTAProps {
  totalCents: number
  disabled: boolean
  onTap: () => void
  /**
   * Verbo del CTA. Default "Cobrar" (venta normal). En el cobro de extras de una
   * cita prepagada se pasa "Cobrar extras" — el monto que se muestra es solo el
   * delta de los extras, nunca lo ya prepagado.
   */
  label?: string
}

export function CobrarCTA({ totalCents, disabled, onTap, label = 'Cobrar' }: CobrarCTAProps) {
  return (
    <TouchButton
      variant="primary"
      size="primary"
      disabled={disabled}
      onClick={onTap}
      className="rounded-none uppercase tracking-[0.06em]"
    >
      {totalCents === 0 ? `${label} →` : `${label} · ${formatMoney(totalCents)} →`}
    </TouchButton>
  )
}
