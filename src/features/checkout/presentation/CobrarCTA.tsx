import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { formatMoney } from '@/shared/lib/money'

/**
 * Primer nombre = primera palabra del nombre completo. El CTA canta el nombre
 * corto (el mockup de R9 dice "Cobrar como Aarón", no el apellido) pero el DOM
 * conserva la capitalización real: las mayúsculas son CSS, igual que en la
 * barra de identidad — un lector de pantalla no debe deletrear el nombre.
 * Cadena vacía cuando todavía no hay sesión resuelta.
 *
 * No se exporta a propósito (react-refresh/only-export-components): PaymentSheet
 * lleva la misma regla de una línea en vez de importar utilidades desde un
 * archivo de componente.
 */
function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}

interface CobrarCTAProps {
  totalCents: number
  disabled: boolean
  onTap: () => void
  /**
   * Nombre completo del barbero de la SESIÓN ACTIVA (`viewer.staff.fullName`),
   * NO el barbero atribuido a las líneas del carrito: el cajero puede cobrar
   * servicios hechos por otro, y lo que este botón declara es quién está
   * operando el POS en este momento. Vacío mientras el viewer carga → el CTA
   * cae a una sola línea en vez de anunciar un "Como" en seco.
   */
  staffName: string
  /**
   * Verbo del CTA. Default "Cobrar" (venta normal). En el cobro de extras de una
   * cita prepagada se pasa "Cobrar extras" — el monto que se muestra es solo el
   * delta de los extras, nunca lo ya prepagado.
   */
  label?: string
}

export function CobrarCTA({ totalCents, disabled, onTap, staffName, label = 'Cobrar' }: CobrarCTAProps) {
  // Texto de la acción tal cual venía (verbo + monto): pasa a ser la línea de
  // arriba del CTA, en mono chico tracked.
  const action = totalCents === 0 ? label : `${label} · ${formatMoney(totalCents)}`
  const who = firstNameOf(staffName)

  return (
    <TouchButton
      variant="primary"
      size="primary"
      disabled={disabled}
      onClick={onTap}
      // El nombre accesible lleva acción + monto + operador ("Cobrar · $280
      // como Aarón"): contiene el texto visible (WCAG 2.5.3) y deja fuera solo
      // la flecha decorativa.
      aria-label={who ? `${action} como ${who}` : action}
      className="flex-col gap-1 rounded-none uppercase tracking-[0.06em]"
    >
      <span className="font-mono text-[11px] font-bold leading-none tracking-[0.18em]">
        {action} →
      </span>
      {who ? (
        <span className="font-[var(--font-pos-display)] text-[20px] font-extrabold leading-none tracking-[0.02em]">
          Como {who}
        </span>
      ) : null}
    </TouchButton>
  )
}
