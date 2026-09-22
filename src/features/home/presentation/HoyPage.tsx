import { useEffect, useMemo, useState, useCallback } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { useNavigate } from 'react-router-dom'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { useLocation } from '@/core/location/useLocation'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { useToast } from '@/core/toast/useToast'
import { useFreshness, useLiveRefresh } from '@/core/freshness/useLiveRefresh'
import type { FreshnessTopic } from '@/core/freshness/FreshnessProvider'
import { localDayInTz, localDayRangeInTz } from '@/shared/lib/date'
import { readableSpanishError } from '@/shared/lib/errors'
import { POS_MY_DAY_EARNINGS, POS_HOME_CAJA_STATUS } from '../data/home.queries'
import { deriveHoyViewModel, type HoyViewModel, type HoyRowData } from './deriveHoyViewModel'
import { HoyView } from './HoyView'
import { FinalizeWalkInSheet } from './FinalizeWalkInSheet'
import { TakeWalkInSheet, type TakeWalkInTarget } from './TakeWalkInSheet'
import { AddWalkInSheet } from '@/features/walkins/presentation/AddWalkInSheet'
import { SkeletonRow, type MoneyValueStatus } from '@/shared/pos-ui'
import type { Appointment } from '@/features/agenda/domain/agenda.types'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository'
import type { WalkIn } from '@/features/walkins/domain/walkins.types'

/**
 * Lo VIVO sin dinero de Hoy (spec 2026-09-18 § 3.1): fila, agenda, reloj y el
 * estado de caja que decide el gate. Puede pintarse desde la memoria de ESTA
 * sesión, pero cada carga —la de montaje incluida— se revalida contra la red.
 */
interface HoyBoard {
  appointments: Appointment[]
  walkIns: WalkIn[]
  clockEvents: TimeClockEvent[]
  caja: { isOpen: boolean; accumulatedCents: number | null; openedAt: Date | null }
}

/** Lo que Hoy necesita de las comisiones del día (clase DINERO). */
interface HoyEarnings {
  totalCommissionCents: number
  /** Ventas directas (sin walk-in ni cita): también son servicios atendidos. */
  directSaleCount: number
}

interface EarningsQueryData {
  staffDayEarnings: {
    totalCommissionCents: number
    perSale: Array<{
      saleId: string
      linkedWalkInId: string | null
      linkedAppointmentId: string | null
    }>
  } | null
}

interface CajaQueryData {
  posCajaStatusHome: { isOpen: boolean; accumulatedCents: number | null; openedAt: string | null } | null
}

// Temas del canal ÚNICO de avisos (src/core/freshness). Constantes de módulo:
// un literal nuevo en cada render re-registraría el cargador sin parar.
/** La cifra de comisiones sólo se mueve con ventas. */
const MONEY_TOPICS: readonly FreshnessTopic[] = ['sales']
/** La lista se mueve con la fila y la agenda. */
const BOARD_TOPICS: readonly FreshnessTopic[] = ['walkins', 'appointments']

function todayRangeISO(tz: string): { from: string; to: string } {
  const now = new Date()
  const { startUtc: from, endUtc: to } = localDayRangeInTz(localDayInTz(now, tz), tz)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function HoyPage() {
  const apollo = useApolloClient()
  const { viewer } = usePosAuth()
  const { locationId, locationTimezone } = useLocation()
  const { agenda, clock, walkins } = useRepositories()
  const navigate = useNavigate()
  const { addToast } = useToast()
  // Estado del canal en vivo: distingue "se cayó la red" de "el servidor
  // respondió con error" para la cifra de dinero (spec § 3.1b).
  const { connection } = useFreshness()

  const [board, setBoard] = useState<HoyBoard | null>(null)
  const [earnings, setEarnings] = useState<HoyEarnings | null>(null)
  const [commissionFailed, setCommissionFailed] = useState(false)
  const [commissionRefreshing, setCommissionRefreshing] = useState(false)
  const [addWalkInOpen, setAddWalkInOpen] = useState(false)
  // Companion close-out: papá pays for both, hijo's walk-in stays open. The
  // operator picks "Finalizar" on the hijo row → confirms here → row drops.
  const [finalizeTarget, setFinalizeTarget] = useState<{ id: string; name: string } | null>(null)
  const [finalizing, setFinalizing] = useState(false)
  // Tomar de la cola con salto: el operador tapeó un walk-in específico (no
  // el primero FIFO). Confirmamos en sheet, ejecutamos assignWalkIn(viewer).
  const [takeTarget, setTakeTarget] = useState<TakeWalkInTarget | null>(null)
  const [taking, setTaking] = useState(false)
  const [ctaBusy, setCtaBusy] = useState(false)

  // --- Lecturas puras (sin tocar estado) ------------------------------------
  // Se usan tal cual en el montaje y detrás de los cargadores del canal de
  // frescura; así ningún setState cuelga del cuerpo de un efecto.

  const fetchBoard = useCallback(async (): Promise<{ board: HoyBoard; failed: boolean } | null> => {
    if (!viewer || !locationId) return null
    const date = localDayInTz(new Date(), locationTimezone)
    const { from, to } = todayRangeISO(locationTimezone)

    const settled = await Promise.allSettled([
      // walkIns y appointments SIEMPRE van por red. Si el canal en vivo pierde
      // un evento (pausa por cobro, corte de red, fallo de publish) el
      // operador igual ve el estado correcto al volver a Hoy. Con cache-first
      // el walk-in "EN SERVICIO · 190 MIN" zombie sobrevivía en pantalla.
      agenda.getAppointments(from, to, locationId, undefined, { force: true }),
      clock.getEvents(viewer.staff.id, locationId, date, date),
      walkins.getWalkIns(locationId, undefined, undefined, { force: true }),
      apollo.query<CajaQueryData>({
        query: POS_HOME_CAJA_STATUS,
        variables: { locationId },
        // Caja gating SIEMPRE va por red. Su valor decide si mostramos el
        // gate "abre la caja" — con cache-first había flash: mount → cache
        // devuelve caja cerrada de ayer → render gate → la red corrige a
        // abierta → gate desaparece. Visible 200-400ms, se sentía roto.
        fetchPolicy: 'network-only',
      }),
    ])

    const cajaRes = settled[3].status === 'fulfilled' ? settled[3].value.data?.posCajaStatusHome : null

    return {
      board: {
        appointments: settled[0].status === 'fulfilled' ? settled[0].value : [],
        clockEvents: settled[1].status === 'fulfilled' ? settled[1].value : [],
        walkIns: settled[2].status === 'fulfilled' ? settled[2].value : [],
        caja: {
          isOpen: cajaRes?.isOpen ?? false,
          accumulatedCents: cajaRes?.accumulatedCents ?? null,
          openedAt: cajaRes?.openedAt ? new Date(cajaRes.openedAt) : null,
        },
      },
      failed: settled.some((result) => result.status === 'rejected'),
    }
  }, [agenda, apollo, clock, walkins, viewer, locationId, locationTimezone])

  const fetchEarnings = useCallback(async (): Promise<HoyEarnings | null> => {
    if (!viewer || !locationId) return null
    const date = localDayInTz(new Date(), locationTimezone)
    const res = await apollo.query<EarningsQueryData>({
      query: POS_MY_DAY_EARNINGS,
      variables: { staffUserId: viewer.staff.id, locationId, date },
      // DINERO: siempre de la red, sin política alternativa (spec § 3.1 y
      // [D-017]). Con varias iPads cobrando, una comisión guardada está mal
      // en cuanto otra terminal cobra. El costo es un esqueleto de carga.
      fetchPolicy: 'network-only',
    })
    const data = res.data?.staffDayEarnings
    // Sin dato NO es cero: se trata como fallo para que la cifra caiga a
    // "no se pudo cargar" en vez de anunciar $0 de comisiones.
    if (!data) throw new Error('El servidor no devolvió las comisiones del día.')
    return {
      totalCommissionCents: data.totalCommissionCents,
      directSaleCount: data.perSale.filter((e) => !e.linkedWalkInId && !e.linkedAppointmentId).length,
    }
  }, [apollo, viewer, locationId, locationTimezone])

  // --- Cargas registradas en el canal de frescura ---------------------------

  const loadBoard = useCallback((): Promise<void> => {
    return fetchBoard().then((result) => {
      if (!result) return
      setBoard(result.board)
      // Si algo no llegó, el refresco NO cuenta como exitoso: la hora de
      // "Actualizado HH:MM" del canal no debe moverse con datos incompletos.
      if (result.failed) throw new Error('No se pudo actualizar la lista de Hoy.')
    })
  }, [fetchBoard])

  const loadCommission = useCallback((): Promise<void> => {
    if (!viewer || !locationId) return Promise.resolve()
    setCommissionRefreshing(true)
    return fetchEarnings()
      .then((data) => {
        if (!data) return
        setCommissionFailed(false)
        setEarnings(data)
      })
      .catch((err: unknown) => {
        // [D-018]: al fallar se tira la cifra. Nunca queda la anterior
        // haciéndose pasar por la de ahora.
        setEarnings(null)
        setCommissionFailed(true)
        throw err
      })
      .finally(() => {
        setCommissionRefreshing(false)
      })
  }, [fetchEarnings, viewer, locationId])

  // Un solo canal de avisos para todo el POS: esta pantalla ya no abre sus
  // propias conexiones en vivo ni vigila el foco/visibilidad de la ventana
  // (eso lo hace FreshnessProvider una vez por sucursal). Cada tema mueve lo
  // suyo: una venta de otra iPad recarga el dinero, la fila y la agenda
  // recargan la lista.
  useLiveRefresh(loadCommission, MONEY_TOPICS)
  useLiveRefresh(loadBoard, BOARD_TOPICS)

  // Carga inicial. El efecto sólo lanza las lecturas: no llama a los `load*`
  // ni escribe estado en su cuerpo — todo setState vive en los callbacks de
  // la promesa, con `cancelled` para no pintar sobre un componente desmontado.
  useEffect(() => {
    if (!viewer || !locationId) return
    let cancelled = false
    void fetchBoard()
      .then((result) => {
        if (cancelled || !result) return
        setBoard(result.board)
      })
      .catch(() => {})
    void fetchEarnings()
      .then((data) => {
        if (cancelled || !data) return
        setEarnings(data)
      })
      .catch(() => {
        if (cancelled) return
        setCommissionFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [viewer, locationId, fetchBoard, fetchEarnings])

  // Re-sincronización completa tras una mutación propia (atender, tomar,
  // finalizar, alta de walk-in): lista y dinero. `allSettled` para que un
  // fallo de cualquiera de las dos no deje un rechazo suelto en el handler.
  const reload = useCallback((): Promise<void> => {
    return Promise.allSettled([loadBoard(), loadCommission()]).then(() => undefined)
  }, [loadBoard, loadCommission])

  const retryCommission = useCallback(() => {
    // El fallo ya se pinta en la cifra; acá sólo se evita la promesa suelta.
    void loadCommission().catch(() => {})
  }, [loadCommission])

  // Estados de una cifra de dinero (spec § 3.1b). "No sé" nunca se disfraza
  // de $0: sin respuesta del servidor es esqueleto y, si falló, es aviso.
  // `updating` sólo cuando YA hay una cifra del servidor y se pidió la nueva.
  const commissionStatus: MoneyValueStatus = commissionFailed
    ? connection === 'offline'
      ? 'offline'
      : 'error'
    : earnings === null
      ? 'loading'
      : commissionRefreshing
        ? 'updating'
        : 'fresh'

  const vm = useMemo<HoyViewModel | null>(() => {
    if (!board || !viewer) return null
    // Service count: completed appts + done walk-ins + direct POS sales
    // (sales without walk-in/appt link). Sin la respuesta de comisiones el
    // conteo es desconocido (null) — la vista lo calla en vez de decir
    // "0 servicios" junto a una cifra que todavía es esqueleto.
    const todayStart = localDayRangeInTz(localDayInTz(new Date(), locationTimezone), locationTimezone).startUtc
    const serviceCount =
      earnings === null
        ? null
        : board.appointments.filter(
            (a) => a.status === 'COMPLETED' && a.staffUser?.id === viewer.staff.id && new Date(a.startAt) >= todayStart,
          ).length +
          board.walkIns.filter(
            (w) => w.status === 'DONE' && w.assignedStaffUser?.id === viewer.staff.id && new Date(w.createdAt) >= todayStart,
          ).length +
          earnings.directSaleCount

    return deriveHoyViewModel({
      staffId: viewer.staff.id,
      staffName: viewer.staff.fullName,
      appointments: board.appointments,
      walkIns: board.walkIns,
      clockEvents: board.clockEvents,
      commission: {
        amountCents: earnings === null ? null : earnings.totalCommissionCents,
        serviceCount,
        status: commissionStatus,
      },
      caja: board.caja,
      tz: locationTimezone,
    })
  }, [board, earnings, commissionStatus, viewer, locationTimezone])

  const handleCtaClick = useCallback(async () => {
    if (!vm || ctaBusy) return
    switch (vm.cta.variant) {
      case 'abrir-caja':
        navigate('/caja')
        break
      case 'nueva-venta':
        navigate('/checkout')
        break
      case 'atender': {
        // Atender = take the turn. For appointments, transition to IN_SERVICE;
        // for walk-ins, claim them (PENDING → ASSIGNED). Doesn't go to checkout —
        // the CTA flips to "Cobrar a X" once the row turns active, which the
        // operator taps separately when the service is done.
        const { targetId, targetKind } = vm.cta
        if (!targetId || !targetKind || !viewer?.staff?.id) return
        setCtaBusy(true)
        try {
          if (targetKind === 'appointment') {
            // checkIn transitions CONFIRMED→CHECKED_IN; startService needs CHECKED_IN.
            // Swallow the checkIn error if the appointment already moved past that
            // state (e.g. front-desk checked them in) — startService still works.
            try { await agenda.checkIn(targetId) } catch { /* already past CONFIRMED */ }
            await agenda.startService(targetId)
          } else {
            await walkins.assign(targetId, viewer.staff.id)
          }
          await reload()
        } catch (err) {
          if (import.meta.env.DEV) {
            console.error('[atender] failed', { targetId, targetKind, err })
          }
          // Nunca tragues el fallo. Caso reportado: la cita ya avanzó de estado
          // en el servidor (otro la puso IN_SERVICE) y startService la rechaza
          // — con data stale el operador tapeaba y no pasaba absolutamente nada.
          // Avisamos SIEMPRE y re-sincronizamos la lista para reflejar el estado
          // real. Solo mostramos el mensaje del servidor si es legible en
          // español; los errores técnicos en inglés caen al fallback.
          addToast(
            readableSpanishError((err as { message?: string }).message) ??
              'No se pudo iniciar la cita. Se actualizó la lista.',
            'error',
          )
          await reload()
        } finally {
          setCtaBusy(false)
        }
        break
      }
      case 'cobrar': {
        const { targetId, targetKind, targetCustomerId } = vm.cta
        if (!targetId || !targetKind) {
          navigate('/checkout')
          break
        }
        const params = new URLSearchParams()
        if (targetKind === 'walk-in') {
          params.set('completeWalkInId', targetId)
        } else {
          params.set('completeAppointmentId', targetId)
        }
        if (targetCustomerId) params.set('customerId', targetCustomerId)
        navigate(`/checkout?${params.toString()}`)
        break
      }
    }
  }, [vm, ctaBusy, navigate, viewer, agenda, walkins, reload, addToast])

  const handleGateAction = useCallback(() => {
    if (!vm?.gate) return
    switch (vm.gate.kind) {
      case 'clock-in':
        navigate('/reloj')
        break
      case 'caja':
        navigate('/caja')
        break
    }
  }, [vm, navigate])

  const handleFinalizeWalkIn = useCallback((walkInId: string, customerName: string) => {
    setFinalizeTarget({ id: walkInId, name: customerName })
  }, [])

  // Operador tapeó una fila de cola. Construimos el target a partir de los
  // metadatos que `deriveHoyViewModel` ya expuso en el row (preferred staff,
  // wait minutes) + calculamos `isJumpingQueue` comparando la posición de
  // este row contra el primer queue en `vm.rows`. Si es el primero, no es
  // salto — es FIFO normal por tap directo.
  const handleTakeQueueItem = useCallback((row: HoyRowData) => {
    if (!vm || !viewer) return
    // Guard UX: no se puede tomar un turno nuevo si ya estás atendiendo a
    // alguien. El backend también lo rechaza (walkIns.assign valida un
    // activeWalkIn ASSIGNED del mismo staff), pero bloqueamos aquí para
    // evitar abrir el sheet y luego mostrar un error feo después del confirm.
    const myActiveRow = vm.rows.find((r) => r.kind === 'active' && r.isMine)
    if (myActiveRow) {
      addToast(
        `Termina con ${myActiveRow.customerName.split(' ')[0]} antes de tomar otro turno.`,
        'error',
      )
      return
    }
    const firstQueueIdx = vm.rows.findIndex((r) => r.kind === 'queue')
    const myIdx = vm.rows.findIndex((r) => r.id === row.id)
    const isJumping = firstQueueIdx !== -1 && myIdx !== -1 && myIdx > firstQueueIdx
    const isMyPreference = row.queuePreferredStaffUserId === viewer.staff.id
    const preferredOtherName =
      row.queuePreferredStaffUserId && !isMyPreference ? row.queuePreferredStaffName ?? null : null
    setTakeTarget({
      id: row.sourceId,
      name: row.customerName,
      kind: 'walk-in',
      isMyPreference,
      preferredOtherName,
      waitMinutes: row.queueWaitMinutes ?? 0,
      isJumpingQueue: isJumping,
    })
  }, [vm, viewer, addToast])

  // Tap en una cita "Sin barbero" (isUnassignedAppt). Mismo guard de "ya
  // estás atendiendo a alguien" que el walk-in — un barbero no puede tomar
  // un turno nuevo a medio servicio. Confirma en el mismo TakeWalkInSheet;
  // confirmTake rama por `kind` hacia reassignAppointment en vez de
  // walkins.assign.
  const handleTakeAppointment = useCallback((row: HoyRowData) => {
    if (!vm || !viewer) return
    const myActiveRow = vm.rows.find((r) => r.kind === 'active' && r.isMine)
    if (myActiveRow) {
      addToast(
        `Termina con ${myActiveRow.customerName.split(' ')[0]} antes de tomar otro turno.`,
        'error',
      )
      return
    }
    setTakeTarget({
      id: row.sourceId,
      name: row.customerName,
      kind: 'appointment',
      isMyPreference: false,
      preferredOtherName: null,
      waitMinutes: 0,
      isJumpingQueue: false,
      appointmentTimeLabel: row.timeLabel,
    })
  }, [vm, viewer, addToast])

  const confirmTake = useCallback(async () => {
    if (!takeTarget || taking || !viewer) return
    setTaking(true)
    try {
      if (takeTarget.kind === 'appointment') {
        await agenda.reassignAppointment(takeTarget.id, viewer.staff.id)
      } else {
        await walkins.assign(takeTarget.id, viewer.staff.id)
      }
      addToast(`${takeTarget.name.split(' ')[0]} asignado a ti`, 'success')
      setTakeTarget(null)
      void reload()
    } catch (e) {
      const msg = (e as { message?: string }).message ?? 'No se pudo tomar el turno.'
      addToast(msg, 'error')
    } finally {
      setTaking(false)
    }
  }, [takeTarget, taking, viewer, walkins, agenda, addToast, reload])

  const confirmFinalize = useCallback(async () => {
    if (!finalizeTarget || finalizing) return
    setFinalizing(true)
    try {
      await walkins.complete(finalizeTarget.id)
      addToast(`${finalizeTarget.name} finalizado`, 'success')
      setFinalizeTarget(null)
      void reload()
    } catch (e) {
      const msg = (e as { message?: string }).message ?? 'No se pudo finalizar.'
      addToast(msg, 'error')
    } finally {
      setFinalizing(false)
    }
  }, [finalizeTarget, finalizing, walkins, addToast, reload])

  if (!vm) {
    return (
      <div className="flex h-full flex-col gap-4 px-6 py-5">
        <SkeletonRow heightPx={36} widthPercent={40} />
        <div className="flex flex-col gap-2">
          <SkeletonRow heightPx={56} />
          <SkeletonRow heightPx={56} />
          <SkeletonRow heightPx={56} />
        </div>
      </div>
    )
  }

  return (
    <>
      <HoyView
        vm={vm}
        onCtaClick={handleCtaClick}
        onGateAction={handleGateAction}
        onAddWalkIn={() => setAddWalkInOpen(true)}
        onFinalizeWalkIn={handleFinalizeWalkIn}
        onTakeQueueItem={handleTakeQueueItem}
        onTakeAppointment={handleTakeAppointment}
        onRetryCommission={retryCommission}
        ctaBusy={ctaBusy}
      />
      {locationId && (
        <AddWalkInSheet
          open={addWalkInOpen}
          locationId={locationId}
          onClose={() => setAddWalkInOpen(false)}
          onCreated={() => { void reload() }}
        />
      )}
      <FinalizeWalkInSheet
        target={finalizeTarget}
        submitting={finalizing}
        onConfirm={confirmFinalize}
        onClose={() => { if (!finalizing) setFinalizeTarget(null) }}
      />
      <TakeWalkInSheet
        target={takeTarget}
        submitting={taking}
        onConfirm={confirmTake}
        onClose={() => { if (!taking) setTakeTarget(null) }}
      />
    </>
  )
}
