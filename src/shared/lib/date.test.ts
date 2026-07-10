import { describe, it, expect } from 'vitest'
import {
  BRANCH_TZ_DEFAULT,
  formatTimeInTz,
  formatDateTimeInTz,
  minutesOfDayInTz,
  dayOfWeekInTz,
  localDayInTz,
  localDayRangeInTz,
} from './date'

// 2026-07-06T16:30:00Z = lunes 10:30 en America/Monterrey (UTC-6) y 11:30 en America/Cancun (UTC-5)
const MON_1030_MTY = '2026-07-06T16:30:00.000Z'

describe('shared/lib/date (Intl puro, tz explícita)', () => {
  it('BRANCH_TZ_DEFAULT es America/Monterrey', () => {
    expect(BRANCH_TZ_DEFAULT).toBe('America/Monterrey')
  })

  it('formatTimeInTz por default es HH:mm 24h en la tz', () => {
    expect(formatTimeInTz(MON_1030_MTY, 'America/Monterrey')).toBe('10:30')
    expect(formatTimeInTz(MON_1030_MTY, 'America/Cancun')).toBe('11:30')
  })

  it('formatDateTimeInTz por default es DD/MM/YYYY, HH:mm 24h en la tz', () => {
    // es-MX intercala una coma entre fecha y hora
    expect(formatDateTimeInTz(MON_1030_MTY, 'America/Monterrey')).toBe('06/07/2026, 10:30')
  })

  it('minutesOfDayInTz da minutos-desde-medianoche en la tz (NO browser-local)', () => {
    expect(minutesOfDayInTz(MON_1030_MTY, 'America/Monterrey')).toBe(10 * 60 + 30)
    expect(minutesOfDayInTz(MON_1030_MTY, 'America/Cancun')).toBe(11 * 60 + 30)
  })

  it('dayOfWeekInTz da 0..6 estilo Date.getDay() en la tz', () => {
    expect(dayOfWeekInTz(MON_1030_MTY, 'America/Monterrey')).toBe(1) // lunes
  })

  it('localDayInTz da YYYY-MM-DD del día local en la tz', () => {
    // 2026-07-06T04:00:00Z = 22:00 del 05/07 en Monterrey, pero 23:00 del 05/07 en Cancun
    const lateNight = '2026-07-06T04:00:00.000Z'
    expect(localDayInTz(new Date(lateNight), 'America/Monterrey')).toBe('2026-07-05')
  })

  it('localDayRangeInTz da medianoche local y fin del día local como instantes UTC', () => {
    const mty = localDayRangeInTz('2026-07-06', 'America/Monterrey')
    expect(mty.startUtc.toISOString()).toBe('2026-07-06T06:00:00.000Z') // 00:00 MTY = 06:00Z
    expect(mty.endUtc.toISOString()).toBe('2026-07-07T05:59:59.999Z')

    // Cancun (UTC-5) prueba que NO es accidentalmente browser-local ni fijo UTC-6
    const cun = localDayRangeInTz('2026-07-06', 'America/Cancun')
    expect(cun.startUtc.toISOString()).toBe('2026-07-06T05:00:00.000Z') // 00:00 CUN = 05:00Z
    expect(cun.endUtc.toISOString()).toBe('2026-07-07T04:59:59.999Z')
  })
})
