import { useEffect, useState } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { cn } from '@/shared/lib/cn'
import { formatTimeInTz, minutesOfDayInTz } from '@/shared/lib/date'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { useLocation } from '@/core/location/useLocation'
import { useToast } from '@/core/toast/useToast'
import { useClock } from '../application/useClock'
import type { TimeClockEvent } from '../data/clock.repository'

/**
 * "1:36 PM" — el formato natural del horario en 12h. Construye manual en
 * vez de usar `toLocaleTimeString('es-MX', { hour12: true })` porque el
 * locale es-MX devuelve "1:36 p. m." con puntos lowercase, que al embeber
 * en una oración ("Entraste a las 1:36 p. m..") genera puntos duplicados
 * y se ve mal. Mayúsculas sin puntos es más limpio y universalmente
 * legible.
 */
function format12h(hours24: number, minutes: number): string {
  const period = hours24 >= 12 ? 'PM' : 'AM'
  const h12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24
  return `${h12}:${String(minutes).padStart(2, '0')} ${period}`
}

function formatTimeInTz12(iso: string, tz: string): string {
  const min = minutesOfDayInTz(iso, tz)
  return format12h(Math.floor(min / 60), min % 60)
}

/** Hora actual en formato natural — para frases como "Son las 1:36 PM". */
function formatNowInTz12(nowMs: number, tz: string): string {
  return formatTimeInTz12(new Date(nowMs).toISOString(), tz)
}

/** Frase en castellano natural: "3 horas 31 minutos" / "45 minutos" / "2 minutos". */
function formatDurationWords(totalMin: number): string {
  const min = Math.max(0, Math.floor(totalMin))
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) {
    if (m === 0) return 'menos de 1 minuto'
    return `${m} ${m === 1 ? 'minuto' : 'minutos'}`
  }
  if (m === 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`
  return `${h} ${h === 1 ? 'hora' : 'horas'} ${m} ${m === 1 ? 'minuto' : 'minutos'}`
}

/** "10:00 AM" desde minutos desde medianoche. */
function formatMinTime12(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return format12h(h, m)
}

/** Tick lento para refrescar "Son las HH:MM" — 30s es suficiente. */
function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

/** Suma de spans IN→OUT, incluye span abierto cuando isClockedIn. */
function computeWorkedMs(events: TimeClockEvent[], nowMs: number): number {
  const sorted = [...events].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  )
  let total = 0
  let inAt: number | null = null
  for (const evt of sorted) {
    const at = new Date(evt.at).getTime()
    if (evt.type === 'CLOCK_IN') {
      if (inAt === null) inAt = at
    } else if (evt.type === 'CLOCK_OUT') {
      if (inAt !== null) {
        total += at - inAt
        inAt = null
      }
    }
  }
  if (inAt !== null) total += nowMs - inAt
  return Math.max(0, total)
}

export function ClockPage() {
  const { viewer } = usePosAuth()
  const { locationId, locationTimezone } = useLocation()
  const {
    events,
    isClockedIn,
    loading,
    submitting,
    error,
    notAssignedHere,
    doClockIn,
    doClockOut,
    shiftStatus,
    refresh,
  } = useClock(viewer?.staff?.id ?? null, locationId)

  // Refetch on focus + visibilitychange — mismo patrón dual que
  // CajaPage/MyDayPage. shiftTemplates/latenessRule son config del admin
  // (plantilla de turno, tolerancia de tardanza) sin eviction local: si el
  // admin las cambia a mitad del día, este cliente Apollo nunca se entera
  // sin este refetch forzado (network-only), y el indicador de "tarde" del
  // reloj se queda con la config vieja hasta un hard reload. Sin spinner
  // (showSpinner: false) para que la revalidación no parpadee la pantalla.
  useEffect(() => {
    const onFocus = () => refresh({ showSpinner: false, force: true })
    const onVisible = () => { if (document.visibilityState === 'visible') refresh({ showSpinner: false, force: true }) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const nowMs = useMinuteTick()

  // Datos derivados para el copy de la status card.
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  )
  const sortedClockIns = sortedEvents.filter((e) => e.type === 'CLOCK_IN')
  const sortedClockOuts = sortedEvents.filter((e) => e.type === 'CLOCK_OUT')
  // La PRIMERA entrada del día es la que define el retardo de tu jornada.
  // Reentradas después de salir no son "llegaste tarde al turno" — son
  // "regresaste". El retardo se fija al momento de la primera entrada.
  const firstClockInToday = sortedClockIns[0]
  const latestClockIn = sortedClockIns.at(-1)
  const latestClockOut = sortedClockOuts.at(-1)
  const totalWorkedMs = computeWorkedMs(events, nowMs)

  // Retardo del día: diferencia entre la primera entrada y el inicio del
  // turno, aplicando el umbral de tolerancia configurado por la sucursal
  // (latenessThresholdMin, default 10). Null si llegó dentro de tolerancia,
  // o si no hay horario asignado, o si no ha llegado todavía.
  const firstArrivalLatenessMin = (() => {
    if (!firstClockInToday || shiftStatus.scheduledStartMin === null) return null
    const arrivalMin = minutesOfDayInTz(firstClockInToday.at, locationTimezone)
    const late = arrivalMin - shiftStatus.scheduledStartMin - shiftStatus.latenessThresholdMin
    return late > 0 ? Math.floor(late) : null
  })()

  const { addToast } = useToast()

  // A9: leyenda de puntualidad al marcar la PRIMERA entrada del día.
  // Tarde → mensaje que motiva a llegar antes; temprano → felicitación;
  // a tiempo → reconocimiento neutro. Las reentradas no la disparan.
  async function handleClockIn() {
    const isFirstToday = !firstClockInToday
    const ok = await doClockIn()
    if (!ok || !isFirstToday) return
    const sched = shiftStatus.scheduledStartMin
    if (sched === null) return
    const arrivalMin = minutesOfDayInTz(new Date().toISOString(), locationTimezone)
    const lateBy = arrivalMin - sched - shiftStatus.latenessThresholdMin
    if (lateBy > 0) {
      addToast('Llegaste tarde. Mañana llega antes — tu puntualidad cuenta 💪', 'info')
    } else if (arrivalMin < sched) {
      addToast('¡Felicidades, llegaste temprano! Así se empieza el día 🎯', 'success')
    } else {
      addToast('¡A tiempo! Buen inicio 👌', 'success')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col gap-6 px-6 py-6">
        <div className="h-12 w-32 animate-pulse bg-[var(--color-cuero-viejo)]" />
        <div className="h-32 animate-pulse bg-[var(--color-cuero-viejo)]" />
        <div className="h-14 animate-pulse bg-[var(--color-cuero-viejo)]" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-6 py-6 pb-10">
      <h1 className="font-[var(--font-pos-display)] text-[32px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
        Reloj
      </h1>

      {error && (
        <div role="alert" className="border-l-[3px] border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] px-5 py-4">
          <p className="text-[14px] font-bold text-[var(--color-bravo)]">{error}</p>
        </div>
      )}

      {notAssignedHere && (
        <div role="status" className="border-l-[3px] border-[var(--color-leather)] bg-[var(--color-cuero-viejo)]/40 px-5 py-4">
          <p className="text-[18px] font-bold leading-snug text-[var(--color-bone)]">
            Tu cuenta no tiene acceso a esta sucursal todavía.
          </p>
          <p className="mt-2 text-[14px] leading-snug text-[var(--color-bone-muted)]">
            Pídele a tu admin que te agregue al equipo de esta sucursal antes de marcar entrada.
          </p>
        </div>
      )}

      <StatusCard
        isClockedIn={isClockedIn}
        shiftStatus={shiftStatus}
        nowMs={nowMs}
        tz={locationTimezone}
        latestClockInIso={latestClockIn?.at ?? null}
        latestClockOutIso={latestClockOut?.at ?? null}
        firstClockInIso={firstClockInToday?.at ?? null}
        firstArrivalLatenessMin={firstArrivalLatenessMin}
        totalWorkedMs={totalWorkedMs}
      />

      <TouchButton
        variant="primary"
        size="primary"
        disabled={notAssignedHere || submitting}
        onClick={isClockedIn ? doClockOut : handleClockIn}
        className="rounded-none uppercase tracking-[0.06em]"
      >
        {submitting
          ? isClockedIn ? 'Registrando salida…' : 'Registrando entrada…'
          : isClockedIn ? 'Salir →' : 'Entrar →'}
      </TouchButton>

      <HistoryList events={events} tz={locationTimezone} />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
 * Status Card — la pieza central de la pantalla.
 *
 * Habla en castellano natural, no en eyebrows de mono uppercase. El barbero
 * lee una oración y entiende qué pasa sin tener que decodificar nada. Tono
 * (bravo / leather / neutral) cambia según urgencia, no decoración. */
function StatusCard({
  isClockedIn,
  shiftStatus,
  nowMs,
  tz,
  latestClockInIso,
  latestClockOutIso,
  firstClockInIso,
  firstArrivalLatenessMin,
  totalWorkedMs,
}: {
  isClockedIn: boolean
  shiftStatus: ReturnType<typeof useClock>['shiftStatus']
  nowMs: number
  tz: string
  latestClockInIso: string | null
  latestClockOutIso: string | null
  firstClockInIso: string | null
  firstArrivalLatenessMin: number | null
  totalWorkedMs: number
}) {
  // Línea contextual del retardo del día — se muestra cuando aplica,
  // independiente del estado actual (clocked-in o out). Si el barbero llegó
  // tarde HOY, eso queda visible toda la jornada para que el sistema sea
  // honesto. Dos líneas: (1) el dato factual del retardo en tono bravo —
  // ya pasó, es contexto histórico; (2) un recordatorio en tono muted que
  // motiva a llegar a tiempo la próxima vez y reusa el concepto ya
  // establecido de que la puntualidad "protege" la comisión (mismo lenguaje
  // que el toast de entrada tarde y la card "sin checar"). La segunda línea
  // se lee como aliento, no como doble castigo, y funciona a cualquier hora
  // porque apunta a "mañana", no al momento de marcar.
  const latenessLine = (firstArrivalLatenessMin !== null && firstClockInIso) ? (
    <>
      <p className="mt-2 text-[14px] leading-snug text-[var(--color-bravo)]">
        Llegaste a las <strong className="font-bold">{formatTimeInTz12(firstClockInIso, tz)}</strong>,{' '}
        con retardo de <strong className="font-bold">{formatDurationWords(firstArrivalLatenessMin)}</strong>.
      </p>
      <p className="mt-1 text-[14px] leading-snug text-[var(--color-bone-muted)]">
        Mañana llega a tiempo — así proteges tu comisión 💪
      </p>
    </>
  ) : null

  // 1. CLOCKED-IN — está trabajando, mostrar cuánto lleva y desde cuándo
  if (isClockedIn && latestClockInIso) {
    const totalMin = Math.floor(totalWorkedMs / 60000)
    return (
      <StatusBox tone="leather">
        <Headline>Estás trabajando.</Headline>
        <Body>
          Entraste a las{' '}
          <DataInline>{formatTimeInTz12(latestClockInIso, tz)}</DataInline>. Llevas{' '}
          <DataInline>{formatDurationWords(totalMin)}</DataInline>.
        </Body>
        {latenessLine}
      </StatusBox>
    )
  }

  // 2. SIN HORARIO ASIGNADO — fallback honesto
  if (shiftStatus.scheduledStartMin === null) {
    return (
      <StatusBox tone="neutral">
        <Headline>Listo para empezar.</Headline>
        <Body>
          Marca tu entrada cuando llegues. Tu admin todavía no te asignó un
          horario fijo en esta sucursal.
        </Body>
      </StatusBox>
    )
  }

  // Si ya hubo entradas hoy (estás out), no asumimos break vs fin de día —
  // el sistema no lo sabe. Solo reportamos lo que pasó: cuándo saliste y
  // cuánto trabajaste. El botón ENTRAR sigue accesible si necesitas volver.
  if (firstClockInIso) {
    const totalMin = Math.floor(totalWorkedMs / 60000)
    return (
      <StatusBox tone="neutral">
        <Headline>
          {latestClockOutIso
            ? <>Saliste a las <DataInline>{formatTimeInTz12(latestClockOutIso, tz)}</DataInline>.</>
            : <>Estás fuera.</>}
        </Headline>
        <Body>
          Llevas <DataInline>{formatDurationWords(totalMin)}</DataInline>{' '}
          trabajados hoy. Marca entrada si vas a regresar.
        </Body>
        {latenessLine}
      </StatusBox>
    )
  }

  const nowMin = minutesOfDayInTz(new Date(nowMs).toISOString(), tz)
  // Usa el umbral configurado por la sucursal (mismo que el del retardo
  // del día) en vez de hardcode 5 min.
  const minsLate = Math.max(0, nowMin - shiftStatus.scheduledStartMin - shiftStatus.latenessThresholdMin)
  const isLate = minsLate > 0

  // 3. SIN TURNO + RETARDO EN VIVO — urgencia, tono bravo. Solo aplica
  //    cuando aún no has marcado entrada hoy y ya venció la tolerancia.
  //    minsLate ya trae descontada la tolerancia, así que el headline lo
  //    nombra "retardo" — decir "tu horario empezó hace X" con ese número
  //    es falso (a las 10:16 con turno de 10:00 diría "hace 6 minutos") y
  //    confunde al barbero. El body explica de dónde sale el número y qué
  //    le cuesta, porque el retardo paga comisión con castigo (payroll).
  if (isLate) {
    return (
      <StatusBox tone="bravo">
        <Headline>
          Llevas <DataInline>{formatDurationWords(minsLate)}</DataInline> de
          retardo.
        </Headline>
        <Body>
          Tu horario empezó a las{' '}
          <DataInline>{formatMinTime12(shiftStatus.scheduledStartMin)}</DataInline>
          {shiftStatus.latenessThresholdMin > 0 && (
            <>
              {' '}y tienes{' '}
              <DataInline>{formatDurationWords(shiftStatus.latenessThresholdMin)}</DataInline>{' '}
              de tolerancia
            </>
          )}
          . Son las <DataInline>{formatNowInTz12(nowMs, tz)}</DataInline>.
        </Body>
        <Body>
          Marca tu entrada ya — el retardo sigue contando hasta que marques.
          Llegar tarde afecta tu comisión del día; llegar a tiempo la protege.
        </Body>
      </StatusBox>
    )
  }

  // 4. SIN TURNO ANTES DE HORA — tranquilo
  const minsUntilStart = shiftStatus.scheduledStartMin - nowMin
  if (minsUntilStart > 0) {
    return (
      <StatusBox tone="neutral">
        <Headline>
          Tu horario empieza a las{' '}
          <DataInline>{formatMinTime12(shiftStatus.scheduledStartMin)}</DataInline>.
        </Headline>
        <Body>
          Faltan{' '}
          <DataInline>{formatDurationWords(minsUntilStart)}</DataInline>.
          Marca entrada cuando estés listo.
        </Body>
      </StatusBox>
    )
  }

  // 5. SIN TURNO JUSTO A TIEMPO — sin retardo todavía (dentro del grace period)
  return (
    <StatusBox tone="neutral">
      <Headline>Listo para empezar.</Headline>
      <Body>
        Tu horario empieza a las{' '}
        <DataInline>{formatMinTime12(shiftStatus.scheduledStartMin)}</DataInline>.
        Marca tu entrada.
      </Body>
    </StatusBox>
  )
}

function StatusBox({
  tone,
  children,
}: {
  tone: 'bravo' | 'leather' | 'neutral'
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'border-l-[3px] px-5 py-5',
        tone === 'bravo' && 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08]',
        tone === 'leather' && 'border-[var(--color-leather)] bg-[var(--color-cuero-viejo)]/40',
        tone === 'neutral' && 'border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)]',
      )}
    >
      {children}
    </div>
  )
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[22px] font-bold leading-tight text-[var(--color-bone)]">
      {children}
    </p>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-[16px] leading-snug text-[var(--color-bone-muted)]">
      {children}
    </p>
  )
}

/** Dato inline destacado dentro de una oración — peso bold y tabular pero
 *  sin romper el flujo de prosa. Mejor que mono uppercase que se siente
 *  como código. */
function DataInline({ children }: { children: React.ReactNode }) {
  return (
    <strong className="font-bold tabular-nums text-[var(--color-bone)]">
      {children}
    </strong>
  )
}

/* ────────────────────────────────────────────────────────────────────────
 * Historial — siempre visible, simple, sin pills semaforo. */
function HistoryList({ events, tz }: { events: TimeClockEvent[]; tz: string }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-[var(--font-pos-display)] text-[20px] font-bold tracking-[-0.01em] text-[var(--color-bone)]">
        Hoy
      </h2>
      {events.length === 0 ? (
        <p className="text-[14px] text-[var(--color-bone-muted)]">
          Sin movimientos.
        </p>
      ) : (
        <ul className="flex flex-col">
          {events.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-[80px_1fr] items-baseline gap-4 border-b border-[var(--color-leather-muted)]/30 py-3 last:border-b-0"
            >
              <span className="font-mono text-[15px] font-bold tabular-nums text-[var(--color-bone)]">
                {formatTimeInTz(e.at, tz)}
              </span>
              <span className="text-[15px] text-[var(--color-bone)]">
                {e.type === 'CLOCK_IN' ? 'Entrada' : 'Salida'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
