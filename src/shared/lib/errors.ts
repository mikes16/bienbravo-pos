// Decide si el mensaje de error del servidor es apto para mostrárselo tal cual
// a un operador hispanohablante no técnico. El API devuelve en español los
// errores de cara al usuario (stock, reglas de negocio, "esta caja ya fue
// cerrada (posiblemente desde el admin)"), pero los errores de máquina de
// estados llegan en inglés técnico ("Appointment must be CHECKED_IN to start")
// — esos NO se muestran; el caller cae a un fallback en español.
//
// Compartido entre HoyPage (startService rechazado) y CloseCajaWizard (cierre
// rechazado por caja ya cerrada) — ambos re-sincronizan y avisan al operador.
export function readableSpanishError(raw: string | undefined): string | null {
  const msg = raw?.trim()
  if (!msg) return null
  const looksSpanish =
    /[áéíóúñ¿¡]/i.test(msg) ||
    /\b(no|sí|cita|barbero|caja|turno|stock|insuficiente|sin|ya|cliente|servicio)\b/i.test(msg)
  const looksEnglish =
    /\b(must|be|to|the|already|appointment|invalid|cannot|failed|start|checked|service)\b/i.test(msg)
  return looksSpanish && !looksEnglish ? msg : null
}
