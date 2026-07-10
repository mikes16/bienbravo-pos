// Helpers de fecha/hora en una tz explícita, con Intl puro (sin dependencias).
// Única fuente de verdad de timezone en el POS: la tz siempre sale de
// useLocation().locationTimezone. El device opera en la tz de la sucursal, así
// que hoy esto es byte-identical a lo anterior; el objetivo es correctitud
// por-construcción para un device/manager en otra tz.

export const BRANCH_TZ_DEFAULT = 'America/Monterrey'

/** Hora en la tz. Default: HH:mm 24h (reproduce los formatters de hora del POS). */
export function formatTimeInTz(
  iso: string,
  tz: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...opts,
    timeZone: tz, // no override-able por opts: la tz es explícita
  }).format(new Date(iso))
}

/** Fecha+hora en la tz. Default: DD/MM/YYYY, HH:mm 24h (reproduce los tickets/sheets). */
export function formatDateTimeInTz(
  iso: string,
  tz: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...opts,
    timeZone: tz,
  }).format(new Date(iso))
}

/** Minutos desde medianoche (0..1439) del instante, leídos en la tz. */
export function minutesOfDayInTz(iso: string, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return h * 60 + m
}

/** Día de semana 0..6 (0=domingo), estilo Date.getDay(), leído en la tz. */
export function dayOfWeekInTz(iso: string, tz: string): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(
    new Date(iso),
  )
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[wd] ?? new Date(iso).getDay()
}

/** 'YYYY-MM-DD' del día local en la tz para un instante dado. */
export function localDayInTz(instant: Date | number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant)) // en-CA => 'YYYY-MM-DD'
}

/**
 * Offset del tz (ms) para un instante UTC dado: cuánto hay que sumar al UTC
 * para obtener el wall-clock local. Derivado vía Intl (DST-safe).
 */
function tzOffsetMs(utcDate: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(utcDate)
  const map: Record<string, number> = {}
  for (const p of parts) if (p.type !== 'literal') map[p.type] = Number(p.value)
  const asUtcOfLocal = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour % 24,
    map.minute,
    map.second,
  )
  return asUtcOfLocal - utcDate.getTime()
}

/**
 * Medianoche local y fin del día local (23:59:59.999) de `ymd` en la tz, como
 * instantes UTC. DST-safe: deriva el offset del inicio de ESE día y del inicio
 * del día siguiente por separado.
 */
export function localDayRangeInTz(ymd: string, tz: string): { startUtc: Date; endUtc: Date } {
  const [y, m, d] = ymd.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
  const startUtc = new Date(guess - tzOffsetMs(new Date(guess), tz))
  const guessNext = Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0)
  const startNext = new Date(guessNext - tzOffsetMs(new Date(guessNext), tz))
  const endUtc = new Date(startNext.getTime() - 1)
  return { startUtc, endUtc }
}
