import { useEffect, useState, useCallback } from 'react'
import { useApolloClient } from '@apollo/client/react'
import { useNavigate } from 'react-router-dom'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { useLocation } from '@/core/location/useLocation'
import { useRepositories } from '@/core/repositories/RepositoryProvider'
import { useToast } from '@/core/toast/useToast'
import {
  POS_MY_DAY_EARNINGS,
  POS_HOME_CAJA_STATUS,
  POS_HOME_WALK_IN_QUEUE_UPDATED,
  POS_HOME_APPOINTMENT_UPDATED,
  POS_HOME_SALE_EVENT,
} from '../data/home.queries'
import { deriveHoyViewModel, type HoyViewModel, type HoyRowData } from './deriveHoyViewModel'
import { HoyView } from './HoyView'
import { FinalizeWalkInSheet } from './FinalizeWalkInSheet'
import { TakeWalkInSheet, type TakeWalkInTarget } from './TakeWalkInSheet'
import { AddWalkInSheet } from '@/features/walkins/presentation/AddWalkInSheet'
import { SkeletonRow } from '@/shared/pos-ui'
import type { Appointment } from '@/features/agenda/domain/agenda.types'
import type { TimeClockEvent } from '@/features/clock/data/clock.repository'
import type { WalkIn } from '@/features/walkins/domain/walkins.types'

function todayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayRangeISO(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now); from.setHours(0, 0, 0, 0)
  const to = new Date(now); to.setHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function HoyPage() {
  const apollo = useApolloClient()
  const { viewer } = usePosAuth()
  const { locationId, locationSlug } = useLocation()
  const { agenda, clock, walkins } = useRepositories()
  const navigate = useNavigate()

  const [vm, setVm] = useState<HoyViewModel | null>(null)
  const [addWalkInOpen, setAddWalkInOpen] = useState(false)
  // Companion close-out: papá pays for both, hijo's walk-in stays open. The
  // operator picks "Finalizar" on the hijo row → confirms here → row drops.
  const [finalizeTarget, setFinalizeTarget] = useState<{ id: string; name: string } | null>(null)
  const [finalizing, setFinalizing] = useState(false)
  // Tomar de la cola con salto: el operador tapeó un walk-in específico (no
  // el primero FIFO). Confirmamos en sheet, ejecutamos assignWalkIn(viewer).
  const [takeTarget, setTakeTarget] = useState<TakeWalkInTarget | null>(null)
  const [taking, setTaking] = useState(false)
  const { addToast } = useToast()

  const refetch = useCallback(async (opts?: { force?: boolean }) => {
    if (!viewer || !locationId) return
    const date = todayISO()
    const { from, to } = todayRangeISO()
    // force=true → network-only (focus refetch, post-mutación). force=false
    // → cache-first (mount inicial — pinta del cache persistido al instante
    // si existe). `client.query()` no admite cache-and-network.
    const earningsPolicy = opts?.force ? 'network-only' : 'cache-first'

    const settled = await Promise.allSettled([
      // walkIns y appointments SIEMPRE van por red en mount. Si subscription
      // WS pierde un evento (ej. tab oculto, race con createPOSSale, fallo
      // de publish) el operador igual ve estado correcto al volver a Hoy.
      // Antes era cache-first → el walk-in "EN SERVICIO 190 MIN" zombie
      // persistía hasta el siguiente window.focus.
      agenda.getAppointments(from, to, locationId, undefined, { force: true }),
      clock.getEvents(viewer.staff.id, locationId, date, date),
      walkins.getWalkIns(locationId, undefined, undefined, { force: true }),
      apollo.query<{
        staffDayEarnings: {
          totalCommissionCents: number
          perSale: Array<{
            saleId: string
            linkedWalkInId: string | null
            linkedAppointmentId: string | null
          }>
        }
      }>({
        query: POS_MY_DAY_EARNINGS,
        variables: { staffUserId: viewer.staff.id, locationId, date },
        fetchPolicy: earningsPolicy,
      }),
      apollo.query<{
        posCajaStatusHome: { isOpen: boolean; accumulatedCents: number | null; openedAt: string | null }
      }>({
        query: POS_HOME_CAJA_STATUS,
        variables: { locationId },
        // Caja gating SIEMPRE va por red. Su valor decide si mostramos el
        // gate "abre la caja" — usar cache-first causaba flash:
        // mount → cache devuelve caja cerrada de ayer → render gate →
        // segunda pasada de red corrige a abierta → gate desaparece.
        // El flicker era visible 200-400ms y se sentía como UI rota.
        fetchPolicy: 'network-only',
      }),
    ])

    const appts: Appointment[] = settled[0].status === 'fulfilled' ? settled[0].value : []
    const events: TimeClockEvent[] = settled[1].status === 'fulfilled' ? settled[1].value : []
    const wkins: WalkIn[] = settled[2].status === 'fulfilled' ? settled[2].value : []
    const earningsRes = settled[3].status === 'fulfilled' ? settled[3].value.data?.staffDayEarnings : null
    const cajaRes = settled[4].status === 'fulfilled' ? settled[4].value.data?.posCajaStatusHome : null

    // Service count: completed appts + done walk-ins + direct POS sales
    // (sales without walk-in/appt link). Antes contábamos solo appts/walk-ins
    // y las ventas directas quedaban invisibles a este contador.
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const directSaleCount = (earningsRes?.perSale ?? []).filter(
      (e) => !e.linkedWalkInId && !e.linkedAppointmentId,
    ).length
    const serviceCount =
      appts.filter((a) => a.status === 'COMPLETED' && a.staffUser?.id === viewer.staff.id && new Date(a.startAt) >= todayStart).length +
      wkins.filter((w) => w.status === 'DONE' && w.assignedStaffUser?.id === viewer.staff.id && new Date(w.createdAt) >= todayStart).length +
      directSaleCount

    setVm(
      deriveHoyViewModel({
        staffId: viewer.staff.id,
        staffName: viewer.staff.fullName,
        appointments: appts,
        walkIns: wkins,
        clockEvents: events,
        commission: {
          amountCents: earningsRes?.totalCommissionCents ?? 0,
          serviceCount,
          loading: false,
        },
        caja: {
          isOpen: cajaRes?.isOpen ?? false,
          accumulatedCents: cajaRes?.accumulatedCents ?? null,
          openedAt: cajaRes?.openedAt ? new Date(cajaRes.openedAt) : null,
        },
      }),
    )
  }, [agenda, apollo, clock, walkins, viewer, locationId])

  useEffect(() => {
    if (!viewer || !locationId) return
    // Single refetch en mount: las queries que afectan el gate (clock +
    // caja) ya van por red dentro de refetch() — el resto pinta del cache
    // persistido para que el shell se sienta instant. Antes hacíamos doble
    // pass (cache-first → network-only) para revalidar todo, pero eso
    // provocaba un flash del gate "abre tu caja" cuando el cache tenía
    // estado viejo. Para casos de stale el cliente cuenta con: window.focus,
    // WS subscription on walk-in events, y refetch post-mutación.
    void refetch()
  }, [viewer, locationId, refetch])

  useEffect(() => {
    const onFocus = () => { void refetch({ force: true }) }
    window.addEventListener('focus', onFocus)
    return () => { window.removeEventListener('focus', onFocus) }
  }, [refetch])

  // Push real-time: subscription a la cola de walk-ins. Cuando llega un
  // evento (cliente creó walk-in en kiosk, otro barbero asignó/terminó),
  // disparamos refetch silencioso para que Hoy refleje el cambio en <1s
  // sin esperar al refetch on focus o al poll. Apollo `subscribe()` no
  // expone subscribeToMore aquí porque la data de Hoy no viene de useQuery
  // sino de Promise.allSettled con repos + apollo.query() one-shot.
  useEffect(() => {
    if (!locationSlug) return
    // Helper local — todas las subscriptions de Hoy comparten el mismo
    // efecto: cuando llega cualquier evento, dispara refetch silencioso.
    // Apollo dedupea queries en flight si tres eventos llegan en <50ms.
    const onEvent = () => { void refetch({ force: true }) }
    const subscribeTo = (query: typeof POS_HOME_WALK_IN_QUEUE_UPDATED, label: string) => {
      const obs = apollo.subscribe({ query, variables: { slug: locationSlug } })
      return obs.subscribe({
        next: onEvent,
        error: (err) => {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn(`[HoyPage] ${label} subscription error`, err)
          }
        },
      })
    }

    // 3 subscriptions paralelas — todas reaccionan disparando el mismo
    // refetch. Una sola conexión WS las multiplexea (graphql-ws lo hace
    // por debajo), no son 3 sockets distintos.
    const walkInSub = subscribeTo(POS_HOME_WALK_IN_QUEUE_UPDATED as never, 'walk-in')
    const apptSub = subscribeTo(POS_HOME_APPOINTMENT_UPDATED as never, 'appointment')
    const saleSub = subscribeTo(POS_HOME_SALE_EVENT as never, 'sale')

    return () => {
      walkInSub.unsubscribe()
      apptSub.unsubscribe()
      saleSub.unsubscribe()
    }
  }, [apollo, locationSlug, refetch])

  const [ctaBusy, setCtaBusy] = useState(false)

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
          await refetch({ force: true })
        } catch (err) {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.error('[atender] failed', { targetId, targetKind, err })
          }
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
  }, [vm, ctaBusy, navigate, viewer, agenda, walkins, refetch])

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
      isMyPreference,
      preferredOtherName,
      waitMinutes: row.queueWaitMinutes ?? 0,
      isJumpingQueue: isJumping,
    })
  }, [vm, viewer, addToast])

  const confirmTake = useCallback(async () => {
    if (!takeTarget || taking || !viewer) return
    setTaking(true)
    try {
      await walkins.assign(takeTarget.id, viewer.staff.id)
      addToast(`${takeTarget.name.split(' ')[0]} asignado a ti`, 'success')
      setTakeTarget(null)
      void refetch({ force: true })
    } catch (e) {
      const msg = (e as { message?: string }).message ?? 'No se pudo tomar el walk-in.'
      addToast(msg, 'error')
    } finally {
      setTaking(false)
    }
  }, [takeTarget, taking, viewer, walkins, addToast, refetch])

  const confirmFinalize = useCallback(async () => {
    if (!finalizeTarget || finalizing) return
    setFinalizing(true)
    try {
      await walkins.complete(finalizeTarget.id)
      addToast(`${finalizeTarget.name} finalizado`, 'success')
      setFinalizeTarget(null)
      void refetch({ force: true })
    } catch (e) {
      const msg = (e as { message?: string }).message ?? 'No se pudo finalizar.'
      addToast(msg, 'error')
    } finally {
      setFinalizing(false)
    }
  }, [finalizeTarget, finalizing, walkins, addToast, refetch])

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
        ctaBusy={ctaBusy}
      />
      {locationId && (
        <AddWalkInSheet
          open={addWalkInOpen}
          locationId={locationId}
          onClose={() => setAddWalkInOpen(false)}
          onCreated={() => { void refetch({ force: true }) }}
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
