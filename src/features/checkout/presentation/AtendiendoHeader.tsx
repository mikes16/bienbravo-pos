import { cldThumb } from '@/shared/lib/cloudinary'

interface Barber {
  id: string
  fullName: string
  photoUrl: string | null
  // A1: undefined = sin info (no se muestra el badge); false = sin turno
  // iniciado — el barbero mostrado no puede acreditarse en el cobro hasta
  // que el cajero elija a otro con turno activo.
  hasClockedIn?: boolean
}

interface AtendiendoHeaderProps {
  barber: Barber
  onTap: () => void
}

export function AtendiendoHeader({ barber, onTap }: AtendiendoHeaderProps) {
  const noShift = barber.hasClockedIn === false
  // Strip de contexto — leather neutral, NO bravo. El único elemento bravo
  // de la pantalla debe ser el CTA COBRAR. Antes este strip tenía la misma
  // paleta que el CTA y competían por atención visual. Patrón corregido:
  // contexto/staff = leather (info), acción primaria = bravo (action).
  return (
    <button
      type="button"
      aria-label={`Cambiar barbero: ${barber.fullName}`}
      onClick={onTap}
      className="flex w-full cursor-pointer items-center justify-between border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 py-3 transition-colors hover:bg-[var(--color-cuero-viejo)]"
    >
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
          Atendiendo
        </span>
        <span className="text-[16px] font-extrabold leading-none text-[var(--color-bone)]">
          {barber.fullName}
        </span>
        {noShift && (
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--color-bravo)]">
            Sin checar — toca para reasignar
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {barber.photoUrl ? (
          <img src={cldThumb(barber.photoUrl, { w: 40, h: 40, dpr: 'auto' }) ?? barber.photoUrl} alt="" loading="lazy" decoding="async" className="h-10 w-10 border border-[var(--color-leather-muted)] object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] text-[18px] font-extrabold text-[var(--color-bone)]">
            {barber.fullName[0]}
          </div>
        )}
        <span aria-hidden className="font-mono text-[12px] text-[var(--color-bone-muted)]">↓</span>
      </div>
    </button>
  )
}
