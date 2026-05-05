import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { formatMoney } from '@/shared/lib/money'

interface CobrarCTAProps {
  totalCents: number
  disabled: boolean
  onTap: () => void
}

export function CobrarCTA({ totalCents, disabled, onTap }: CobrarCTAProps) {
  return (
    <TouchButton
      variant="primary"
      size="primary"
      disabled={disabled}
      onClick={onTap}
      className="rounded-none uppercase tracking-[0.06em]"
    >
      {totalCents === 0 ? 'Cobrar →' : `Cobrar · ${formatMoney(totalCents)} →`}
    </TouchButton>
  )
}
