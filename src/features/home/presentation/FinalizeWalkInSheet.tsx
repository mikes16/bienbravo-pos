import { TouchButton } from '@/shared/pos-ui/TouchButton'

interface FinalizeWalkInSheetProps {
  target: { id: string; name: string } | null
  submitting: boolean
  onConfirm: () => void
  onClose: () => void
}

/**
 * Confirms a "finalize without charge" on a walk-in. The dominant happy path
 * for closing a walk-in is the bottom Cobrar CTA, so this sheet exists for
 * the narrow companion case (papá paid for hijo's corte on the same ticket).
 * The copy spells that out explicitly so an operator doesn't pick this when
 * they actually meant to charge.
 */
export function FinalizeWalkInSheet({ target, submitting, onConfirm, onClose }: FinalizeWalkInSheetProps) {
  if (!target) return null
  return (
    <div
      role="dialog"
      aria-label="Finalizar walk-in"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={() => { if (!submitting) onClose() }}
    >
      <div
        className="w-full max-w-md border-t border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-6 py-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
          Finalizar sin cobro
        </p>
        <p className="mt-2 font-[var(--font-pos-display)] text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--color-bone)]">
          ¿Cerrar walk-in de {target.name}?
        </p>
        <p className="mt-3 text-[14px] leading-snug text-[var(--color-bone)]">
          Solo úsalo si <strong>ya cobraste este servicio en otra venta</strong> — por ejemplo, un acompañante que pagó el papá.
        </p>
        <p className="mt-2 text-[13px] leading-snug text-[var(--color-bone-muted)]">
          Si todavía no se ha cobrado, regresa y cóbralo desde el botón inferior.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <TouchButton
            variant="primary"
            size="primary"
            onClick={onConfirm}
            disabled={submitting}
            className="rounded-none uppercase tracking-[0.06em]"
          >
            {submitting ? 'Finalizando…' : 'Sí, finalizar'}
          </TouchButton>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="cursor-pointer self-center px-6 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bone-muted)] hover:text-[var(--color-bone)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  )
}
