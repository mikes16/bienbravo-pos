import { TouchButton } from '@/shared/pos-ui/TouchButton'
import type { HoyGate as HoyGateState } from './deriveHoyViewModel'

interface HoyGateProps {
  staffName: string
  gate: HoyGateState
  onAction: () => void
}

const COPY: Record<HoyGateState['kind'], { eyebrow: string; title: string; body: string; cta: string }> = {
  'clock-in': {
    eyebrow: 'PASO 1 DE 2',
    title: 'Inicia tu día',
    body: 'Antes de ver tu agenda y cobrar, marca tu entrada en el reloj.',
    cta: 'Ir al Reloj →',
  },
  caja: {
    eyebrow: 'PASO 2 DE 2',
    title: 'Abre la caja',
    body: 'La caja de la sucursal todavía está cerrada. Ábrela para poder cobrar.',
    cta: 'Ir a Caja →',
  },
}

export function HoyGate({ staffName, gate, onAction }: HoyGateProps) {
  const firstName = staffName.split(' ')[0] ?? staffName
  const copy = COPY[gate.kind]

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-3 pb-2">
        <p className="text-[13px] text-[var(--color-bone-muted)]">
          Hola, <strong className="font-bold text-[var(--color-bone)]">{firstName}</strong>.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="flex w-full max-w-md flex-col items-start gap-4 border border-[var(--color-leather-muted)]/40 bg-[var(--color-carbon-elevated)] px-6 py-8">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">
            {copy.eyebrow}
          </span>
          <h1 className="font-[var(--font-pos-display)] text-[32px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--color-bone)]">
            {copy.title}
          </h1>
          <p className="text-[14px] leading-snug text-[var(--color-bone-muted)]">
            {copy.body}
          </p>
          <TouchButton
            variant="primary"
            size="primary"
            onClick={onAction}
            className="w-full rounded-none uppercase tracking-[0.06em]"
          >
            {copy.cta}
          </TouchButton>
        </div>
      </div>
    </div>
  )
}
