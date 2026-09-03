import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { formatShortDateInTz, formatTimeInTz } from '@/shared/lib/date'

function openedLabel(openedAt: string, timezone: string): string {
  return `${formatShortDateInTz(openedAt, timezone)} · ${formatTimeInTz(openedAt, timezone)}`
}

interface StaleCajaBlockerProps {
  openedAt: string
  timezone: string
  /** Candado del header: el operador sin permiso cede el POS a un encargado. */
  onLock: () => void
}

/**
 * Pantalla completa para un operador que NO puede hacer el corte. No hay
 * salida más que cambiar de operador: el POS queda inutilizable hasta que
 * alguien con `pos.register.close` cierre la caja del día anterior.
 */
export function StaleCajaBlocker({ openedAt, timezone, onLock }: StaleCajaBlockerProps) {
  return (
    <div className="flex h-full items-center justify-center px-6" role="alert">
      <div className="flex w-full max-w-md flex-col items-start gap-4 border border-[var(--color-bravo)]/60 bg-[var(--color-carbon-elevated)] px-6 py-8">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-bravo)]">
          Corte pendiente
        </span>
        <h1 className="font-[var(--font-pos-display)] text-[32px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--color-bone)]">
          La caja quedó abierta sin corte
        </h1>
        <p className="text-[14px] leading-snug text-[var(--color-bone-muted)]">
          Se abrió el {openedLabel(openedAt, timezone)} y nadie la cerró. Mientras siga
          abierta, las ventas de hoy caerían en la caja de ese día.
        </p>
        <p className="text-[14px] leading-snug text-[var(--color-bone)]">
          Tu rol no puede cerrar caja. Pide a un encargado con permiso de corte que
          entre con su PIN y cierre la caja desde este POS.
        </p>
        <TouchButton
          variant="secondary"
          size="primary"
          onClick={onLock}
          className="w-full rounded-none uppercase tracking-[0.06em]"
        >
          Cambiar de operador
        </TouchButton>
      </div>
    </div>
  )
}

interface StaleCajaBannerProps {
  openedAt: string
  timezone: string
}

/**
 * Franja persistente sobre las pantallas de Caja mientras el operador (que sí
 * puede cerrar) hace el corte. Los tabs están escondidos; esto explica por qué.
 */
export function StaleCajaBanner({ openedAt, timezone }: StaleCajaBannerProps) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.12] px-5 py-3"
    >
      <span aria-hidden className="h-2 w-2 shrink-0 bg-[var(--color-bravo)]" />
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-bravo)]">
        Corte pendiente
      </span>
      <span className="text-[12px] leading-snug text-[var(--color-bone)]">
        Caja abierta desde el {openedLabel(openedAt, timezone)}. Haz el corte para continuar.
      </span>
    </div>
  )
}
