import type { ComponentProps, ReactElement } from 'react'
import { cn } from '@/shared/lib/cn.ts'

type GoogleIconProps = {
  name: string
} & Omit<ComponentProps<'span'>, 'children'>

const TEXT_SIZE_CLASS_REGEX = /\btext-(?:xs|sm|base|lg|xl|[2-9]xl|\[[^\]]+\])\b/
const HEIGHT_CLASS_REGEX = /\bh-(\d+(?:\.\d+)?)\b/

function deriveFontSizeFromClass(className?: string): string | undefined {
  if (!className || TEXT_SIZE_CLASS_REGEX.test(className)) return undefined
  const match = className.match(HEIGHT_CLASS_REGEX)
  if (!match) return undefined

  const unit = Number(match[1])
  if (!Number.isFinite(unit)) return undefined

  return `${unit / 4}rem`
}

export function GoogleIcon({ name, className, style, ...props }: GoogleIconProps) {
  const autoFontSize = deriveFontSizeFromClass(className)

  return (
    <span
      aria-hidden="true"
      {...props}
      className={cn(
        'material-symbols-outlined not-italic inline-grid select-none place-items-center align-middle leading-none',
        className,
      )}
      style={{
        fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        lineHeight: 1,
        ...(autoFontSize ? { fontSize: autoFontSize } : null),
        ...style,
      }}
    >
      {name}
    </span>
  )
}

export type PosIconComponent = (props: { className?: string }) => ReactElement

function makeIcon(name: string): PosIconComponent {
  return ({ className }) => <GoogleIcon name={name} className={className} />
}

export const ShoppingCartIcon = makeIcon('shopping_cart')
export const CalendarIcon = makeIcon('calendar_month')
export const SeatReclineIcon = makeIcon('airline_seat_recline_extra')
export const WalletIcon = makeIcon('account_balance_wallet')
export const ClockIcon = makeIcon('schedule')
export const AnalyticsIcon = makeIcon('bar_chart')
export const ArrowRightIcon = makeIcon('arrow_forward')
export const LockIcon = makeIcon('lock')
export const DeleteIcon = makeIcon('delete')
export const CashIcon = makeIcon('payments')
export const CardIcon = makeIcon('credit_card')
export const SwapIcon = makeIcon('swap_horiz')
export const ChevronLeftIcon = makeIcon('chevron_left')
export const ScissorsIcon = makeIcon('content_cut')
export const SearchIcon = makeIcon('search')
export const SuccessIcon = makeIcon('check_circle')
export const LoginIcon = makeIcon('login')
export const LogoutIcon = makeIcon('logout')
export const CalendarClockIcon = makeIcon('event_upcoming')
export const PersonAddIcon = makeIcon('person_add')
