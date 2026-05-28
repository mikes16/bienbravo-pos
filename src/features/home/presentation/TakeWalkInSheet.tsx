import { TouchButton } from '@/shared/pos-ui/TouchButton'

export interface TakeWalkInTarget {
  id: string
  name: string
  // Si el cliente lo pidió específicamente al viewer. Cambia el copy y el
  // visual para reforzar "este venía por ti" — refleja el destaque que ya
  // hace HoyRow con border-l bravo.
  isMyPreference: boolean
  // Si hay otro barbero como preferido, lo decimos explícitamente para que
  // el operador sepa que se lo está quitando de su cola (no es un error,
  // pero merece visibilidad).
  preferredOtherName: string | null
  waitMinutes: number
  // True si esta fila no es la primera de la cola — el operador está
  // "saltando" a alguien. No es bloqueante, solo merece nota para evitar
  // taps accidentales en filas inesperadas.
  isJumpingQueue: boolean
}

interface TakeWalkInSheetProps {
  target: TakeWalkInTarget | null
  submitting: boolean
  onConfirm: () => void
  onClose: () => void
}

/**
 * Confirma "tomar de la cola" un walk-in específico — el operador escogió
 * exactamente a este cliente, no necesariamente el primero. Existe para el
 * caso típico: el barbero acaba de quedar libre y ve que el siguiente en
 * cola fue específicamente quien lo pidió a él, o que un cliente lleva
 * mucho rato esperando y quiere atenderlo antes.
 *
 * Copy y visual cambian según contexto:
 *   - isMyPreference → tono "venía por ti" (bravo)
 *   - preferredOtherName → tono "estás tomando lo de Javi" (informativo)
 *   - isJumpingQueue → nota de que hay clientes adelante (no bloqueante)
 */
export function TakeWalkInSheet({ target, submitting, onConfirm, onClose }: TakeWalkInSheetProps) {
  if (!target) return null
  return (
    <div
      role="dialog"
      aria-label="Tomar walk-in"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={() => { if (!submitting) onClose() }}
    >
      <div
        className="w-full max-w-md border-t border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-6 py-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: target.isMyPreference ? 'var(--color-bravo)' : 'var(--color-bone-muted)' }}
        >
          {target.isMyPreference ? 'Te está esperando' : 'Tomar de la cola'}
        </p>
        <p className="mt-2 font-[var(--font-pos-display)] text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--color-bone)]">
          ¿Atender a {target.name} ahora?
        </p>

        {/* Meta block: tiempo de espera + contexto de preferencia. Una sola
            línea para no saturar; el operador necesita decidir rápido. */}
        <p className="mt-3 text-[13px] leading-snug text-[var(--color-bone-muted)]">
          Walk-in · esperando <strong className="text-[var(--color-bone)] tabular-nums">{target.waitMinutes} min</strong>
          {target.preferredOtherName && (
            <> · pidió a <strong className="text-[var(--color-bone)]">{target.preferredOtherName}</strong></>
          )}
        </p>

        {/* Aviso de salto de cola: solo si aplica, en leather (informativo, no
            bloqueante). Si además es preferencia tuya, no tiene caso decir
            "estás saltando" — el cliente vino por ti, es lógico que vaya
            primero. */}
        {target.isJumpingQueue && !target.isMyPreference && (
          <div className="mt-4 border-l-[2px] border-[var(--color-leather)] bg-[var(--color-cuero-viejo)]/30 px-3 py-2">
            <p className="text-[12px] leading-snug text-[var(--color-bone)]">
              Hay clientes adelante en la cola. Asegúrate de que es lo correcto.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <TouchButton
            variant="primary"
            size="primary"
            onClick={onConfirm}
            disabled={submitting}
            className="rounded-none uppercase tracking-[0.06em]"
          >
            {submitting ? 'Tomando…' : `Sí, tomar a ${target.name.split(' ')[0]}`}
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
