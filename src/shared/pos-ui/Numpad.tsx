import { cn } from '@/shared/lib/cn'

export type NumpadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'backspace'

interface NumpadProps {
  onKey: (key: NumpadKey) => void
  /** When false, hides the decimal key (used for PIN-style entry). Default true. */
  allowDecimal?: boolean
  className?: string
}

const BackspaceIcon = () => (
  <svg
    aria-hidden
    className="h-6 w-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l4.5-4.5A2 2 0 019 7h11v10H9a2 2 0 01-1.5-.5L3 12z" />
    <line strokeLinecap="round" x1="13" y1="10" x2="17" y2="14" />
    <line strokeLinecap="round" x1="17" y1="10" x2="13" y2="14" />
  </svg>
)

const NUMPAD_KEYS: { value: NumpadKey; label: string; aria: string }[] = [
  { value: '7', label: '7', aria: '7' },
  { value: '8', label: '8', aria: '8' },
  { value: '9', label: '9', aria: '9' },
  { value: '4', label: '4', aria: '4' },
  { value: '5', label: '5', aria: '5' },
  { value: '6', label: '6', aria: '6' },
  { value: '1', label: '1', aria: '1' },
  { value: '2', label: '2', aria: '2' },
  { value: '3', label: '3', aria: '3' },
]

/**
 * 3×4 numeric keypad with 72px keys. Last row: decimal (when allowed),
 * 0, backspace. Used for cash counts, money entry. Stateless — parent
 * receives every key press via onKey.
 */
export function Numpad({ onKey, allowDecimal = true, className }: NumpadProps) {
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {NUMPAD_KEYS.map((k) => (
        <NumpadButton key={k.value} onClick={() => onKey(k.value)} aria-label={k.aria}>
          {k.label}
        </NumpadButton>
      ))}
      {allowDecimal ? (
        <NumpadButton onClick={() => onKey('.')} aria-label=".">
          .
        </NumpadButton>
      ) : (
        <div />
      )}
      <NumpadButton onClick={() => onKey('0')} aria-label="0">
        0
      </NumpadButton>
      <NumpadButton onClick={() => onKey('backspace')} aria-label="Borrar">
        <BackspaceIcon />
      </NumpadButton>
    </div>
  )
}

interface NumpadButtonProps {
  onClick: () => void
  children: React.ReactNode
  'aria-label': string
}

function NumpadButton({ onClick, children, ...rest }: NumpadButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-[var(--pos-touch-numpad)] w-[var(--pos-touch-numpad)] items-center justify-center',
        'border border-[var(--color-leather-muted)] bg-[var(--color-cuero-viejo)]',
        'font-[var(--font-pos-display)] text-[30px] font-extrabold text-[var(--color-bone)]',
        'transition-colors duration-[var(--duration-pos-tap)]',
        'hover:bg-[var(--color-cuero-viejo-hover)]',
        'active:bg-[var(--color-cuero-viejo-hover)]',
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
