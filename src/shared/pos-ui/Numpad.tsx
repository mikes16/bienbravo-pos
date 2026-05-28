import { cn } from '@/shared/lib/cn'

export type NumpadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'backspace'

interface NumpadProps {
  onKey: (key: NumpadKey) => void
  /** When false, hides the decimal key (used for PIN-style entry). Default true. */
  allowDecimal?: boolean
  className?: string
}

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
 * 3×4 numeric keypad — "ghost keys" editorial premium. El chrome del botón
 * desaparece en idle (sin border, bg = carbon-elevated apenas distinguible);
 * el número monumental hace todo el peso visual. Hover/tap es el único
 * momento donde el chrome se manifiesta:
 *
 *   - hover: bg cuero-viejo + número cambia a bone vibrante
 *   - active (tap): scale-down 0.96 + bg cuero-viejo-hover + número bravo
 *     por ~120ms para feedback visual instantáneo
 *
 * Patrón inspirado en Square POS / Stripe Terminal / iOS passcode: el peso
 * visual es el número, no el contenedor. Spacing generoso (gap-4) deja que
 * los números respiren — coherente con la voz editorial del resto.
 */
export function Numpad({ onKey, allowDecimal = true, className }: NumpadProps) {
  return (
    <div className={cn('grid grid-cols-3 gap-4', className)}>
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
        <div aria-hidden />
      )}
      <NumpadButton onClick={() => onKey('0')} aria-label="0">
        0
      </NumpadButton>
      <NumpadButton onClick={() => onKey('backspace')} aria-label="Borrar" variant="utility">
        {/* Glyph editorial en vez de SVG cute. Coherente con el resto de
            elementos mono del sistema (› ← ↓ etc.). */}
        ⌫
      </NumpadButton>
    </div>
  )
}

interface NumpadButtonProps {
  onClick: () => void
  children: React.ReactNode
  'aria-label': string
  /** "utility" achica la tipografía para el backspace glyph que es más
      pequeño visualmente que un dígito display. */
  variant?: 'digit' | 'utility'
}

function NumpadButton({ onClick, children, variant = 'digit', ...rest }: NumpadButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Geometría: ghost key — sin border, bg apenas distinguible del
        // carbon de fondo. Sharp corners coherentes con sistema.
        'group relative flex h-[var(--pos-touch-numpad)] w-[var(--pos-touch-numpad)] items-center justify-center',
        'bg-[var(--color-carbon-elevated)]',
        'font-[var(--font-pos-display)] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]',
        // Tamaños distintos para dígito vs utility glyph (backspace).
        variant === 'digit' ? 'text-[44px]' : 'text-[28px] text-[var(--color-bone-muted)]',
        // Transiciones rápidas — el chrome aparece y desaparece sin pesar.
        'cursor-pointer transition-all duration-150',
        // Hover state: bg shift + número se ilumina (utility queda muted).
        variant === 'digit'
          ? 'hover:bg-[var(--color-cuero-viejo)]'
          : 'hover:bg-[var(--color-cuero-viejo)] hover:text-[var(--color-bone)]',
        // Active (tap): scale-down + bg más fuerte + (para dígitos) número bravo.
        'active:scale-[0.96]',
        variant === 'digit'
          ? 'active:bg-[var(--color-cuero-viejo-hover)] active:text-[var(--color-bravo)]'
          : 'active:bg-[var(--color-cuero-viejo-hover)]',
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
