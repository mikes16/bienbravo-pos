import { useNavigate } from 'react-router-dom'
import {
  ShoppingCartIcon,
  CalendarIcon,
  SeatReclineIcon,
  ClockIcon,
  AnalyticsIcon,
  ArrowRightIcon,
  type PosIconComponent,
} from '@/shared/pos-ui/GoogleIcon.tsx'
import { cn } from '@/shared/lib/cn.ts'
import { formatMoney } from '@/shared/lib/money.ts'
import { PosCard, TapButton, StatusPill, SkeletonBlock, SectionHeader } from '@/shared/pos-ui/index.ts'
import type { Appointment } from '@/features/agenda/domain/agenda.types.ts'
import type { WalkIn } from '@/features/walkins/domain/walkins.types.ts'

/* ── Types ────────────────────────────────────────────────────────────── */

export interface DashboardData {
  completedCount: number
  totalAppointments: number
  revenueCents: number
  serviceRevenueCents: number
  productRevenueCents: number
  commissionCents: number
  hoursWorked: string
  isClockedIn: boolean
  clockInTime: string | null
  pendingApptCount: number
  nextAppointment: Appointment | null
  pendingWalkIns: number
  nextPendingWalkIn: WalkIn | null
  activeWalkIn: WalkIn | null
  activeAppointment: Appointment | null
  recentActivity: RecentActivityEntry[]
}

export interface RecentActivityEntry {
  id: string
  at: string
  customerName: string
  movementLabel: string
  movementColor: 'amber' | 'blue' | 'green' | 'red' | 'gray'
  detail: string
  statusLabel: string
  statusColor: 'amber' | 'blue' | 'green' | 'red' | 'gray'
  totalCents: number | null
}

export interface DashboardSectionLoading {
  performance: boolean
  activity: boolean
}

interface HomeViewProps {
  staffName: string
  data: DashboardData
  loading: DashboardSectionLoading
}

/* ── Nav tile (large, image-ready) ────────────────────────────────────── */

function NavTile({
  icon: Icon,
  title,
  subtitle,
  badge,
  imageUrl,
  onClick,
}: {
  icon: PosIconComponent
  title: string
  subtitle: string
  badge?: number
  imageUrl?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-bb-surface text-left transition-transform active:scale-[0.97] hover:bg-bb-surface-2"
    >
      <div aria-hidden className="pointer-events-none absolute -right-15 -top-5 opacity-20">
        <Icon className="h-50 w-50 -rotate-12 text-bb-muted/30 transition-colors group-hover:text-bb-muted/40" />
      </div>

      {/* Icon / image area */}
      <div className="relative z-10 flex h-28 items-center gap-3 px-5 pt-4">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-16 w-16 object-contain" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bb-primary/15">
            <Icon className="h-8 w-8 text-bb-primary" />
          </div>
        )}
        {badge !== undefined && badge > 0 && (
          <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-bb-primary px-2 text-xs font-bold text-white">
            {badge}
          </span>
        )}
      </div>

      {/* Label area */}
      <div className="relative z-10 px-5 pb-5 pt-2">
        <p className="font-bb-display text-xl font-bold uppercase tracking-wide leading-tight">{title}</p>
        <p className="mt-1 text-xs leading-tight text-bb-muted line-clamp-2">{subtitle}</p>
      </div>
    </button>
  )
}

/* ── Performance mini-row ─────────────────────────────────────────────── */

function PerfRow({
  label,
  value,
  barPct,
  barColor,
  trackColor = 'bg-bb-border/70',
}: {
  label: string
  value: string
  barPct: number
  barColor: string
  trackColor?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-bb-muted">{label}</span>
        <span className="font-bold tabular-nums">{value}</span>
      </div>
      <div className={cn('h-1.5 rounded-full', trackColor)}>
        <div
          className={cn('h-1.5 rounded-full transition-all', barColor)}
          style={{ width: `${Math.min(barPct, 100)}%` }}
        />
      </div>
    </div>
  )
}

/* ── Main view ────────────────────────────────────────────────────────── */

export function HomeView({ staffName, data, loading }: HomeViewProps) {
  const navigate = useNavigate()
  const firstName = staffName.split(' ')[0] ?? staffName
  const hasActiveService = Boolean(data.activeWalkIn || data.activeAppointment)
  const activeServiceName = data.activeWalkIn?.customerName ?? data.activeAppointment?.customer?.fullName ?? 'Servicio activo'
  const activeWalkInMinutes = data.activeWalkIn
    ? Math.max(0, Math.round((Date.now() - new Date(data.activeWalkIn.createdAt).getTime()) / 60_000))
    : 0
  const queueLeadName = data.nextPendingWalkIn?.customerName ?? 'Walk-in'
  const activeWalkInName = data.activeWalkIn?.customerName ?? 'Walk-in'

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-6 py-6">
      {/* ── Row 1: Greeting ────────────────────────────────────── */}
      <div>
        <h1 className="font-bb-display text-2xl font-bold">HOLA, {firstName.toUpperCase()}.</h1>
        <p className="text-sm text-bb-muted">Listo para otro día de estilo y tradición.</p>
      </div>

      {/* ── Row 2: 4-column nav tiles (instant, no API dep) ───── */}
      <div className="grid grid-cols-4 gap-4">
        <NavTile
          icon={ShoppingCartIcon}
          title="Nueva Venta"
          subtitle={
            hasActiveService
              ? 'Finaliza o cancela el servicio en curso antes de cobrar.'
              : 'Iniciar cobro de servicio o producto.'
          }
          onClick={() => navigate('/checkout')}
        />
        <NavTile
          icon={CalendarIcon}
          title="Mi Agenda"
          subtitle={
            loading.performance
              ? 'Cargando...'
              : data.pendingApptCount > 0
              ? `${data.pendingApptCount} citas pendientes hoy.`
              : 'Sin citas pendientes.'
          }
          badge={data.pendingApptCount}
          onClick={() => navigate('/agenda')}
        />
        <NavTile
          icon={SeatReclineIcon}
          title="Sala de Espera"
          subtitle={
            loading.performance
              ? 'Cargando...'
              : data.activeWalkIn
              ? `En servicio: ${activeWalkInName}`
              : data.nextPendingWalkIn
              ? `Sigue: ${queueLeadName}`
              : data.pendingWalkIns > 0
              ? `Ver lista de espera (Walk-ins).`
              : 'Sin walk-ins.'
          }
          badge={data.pendingWalkIns}
          onClick={() => navigate('/walkins')}
        />
        <NavTile
          icon={ClockIcon}
          title="Registro Horario"
          subtitle={
            loading.performance
              ? 'Cargando...'
              : data.clockInTime
              ? `Entrada registrada: ${data.clockInTime}`
              : 'Sin registro'
          }
          onClick={() => navigate('/clock')}
        />
      </div>

      {/* ── Row 3: CTA banner (left) + Performance card (right) ── */}
      <div className="grid grid-cols-5 gap-4">
        {/* CTA banner — spans 3 cols */}
        <PosCard
          variant="dark"
          className="relative col-span-3 overflow-hidden p-0 font-bb-display tracking-[-0.015em] shadow-[0_18px_36px_-20px_rgba(0,0,0,0.85)]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
          />

          {loading.performance ? (
            <div className="relative flex min-h-[190px] items-center justify-between gap-5 px-6 py-6">
              <div className="flex-1 space-y-3">
                <div className="h-2 w-20 animate-pulse rounded-full bg-white/20" />
                <div className="h-9 w-52 animate-pulse rounded-xl bg-white/20" />
                <div className="h-3 w-full max-w-sm animate-pulse rounded-full bg-white/10" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/10" />
              </div>
              <div className="h-[96px] w-[160px] shrink-0 animate-pulse rounded-2xl bg-white/10" />
            </div>
          ) : (
            <div className="relative grid min-h-[190px] grid-cols-[1.6fr_1fr] items-center gap-5 px-6 py-6">
              <div className="max-w-xl">
                {hasActiveService ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-bb-primary">En Servicio Ahora</p>
                    <h2 className="mt-3 text-4xl font-bold uppercase leading-[0.9] tracking-[-0.03em]">{activeServiceName}</h2>
                    <p className="mt-4 max-w-lg text-sm leading-relaxed tracking-[-0.01em]">
                      {data.activeWalkIn
                        ? `Lleva ${activeWalkInMinutes} min en servicio. Cobra el servicio para cerrarlo, o cancela sin cobro para liberar al barbero.`
                        : 'Tienes una cita en servicio. Finalízala desde Agenda antes de tomar otro turno.'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-bb-primary">Acción Rápida</p>
                    <h2 className="mt-3 text-4xl font-bold uppercase leading-[0.9] tracking-[-0.03em]">Caballero Moderno</h2>
                    <p className="mt-4 max-w-lg text-sm leading-relaxed tracking-[-0.01em]">
                      Registrar corte estándar inmediatamente sin cita previa. Asigna automáticamente el siguiente turno disponible.
                    </p>
                  </>
                )}
              </div>

              <div className="flex justify-end">
                <TapButton
                  size="lg"
                  variant="primary"
                  className="h-[96px] px-8 !font-bb-display text-xl uppercase tracking-[-0.02em]"
                  onClick={() =>
                    data.activeWalkIn
                      ? navigate(`/checkout?completeWalkInId=${data.activeWalkIn.id}`)
                      : data.activeAppointment
                      ? navigate(`/checkout?completeAppointmentId=${data.activeAppointment.id}`)
                      : navigate('/walkins')
                  }
                >
                  <span className="flex w-full items-center justify-between gap-4">
                    <span className="text-left leading-[0.95]">
                      {data.activeWalkIn ? (
                        <>Cobrar<br />Servicio</>
                      ) : data.activeAppointment ? (
                        <>Terminar<br />Servicio</>
                      ) : (
                        <>Registrar<br />Corte</>
                      )}
                    </span>
                    <ArrowRightIcon className="h-7 w-7 shrink-0" />
                  </span>
                </TapButton>
              </div>
            </div>
          )}
        </PosCard>

        {/* Performance card — spans 2 cols */}
        <PosCard className="col-span-2 flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <span className="font-bb-display text-sm font-bold uppercase tracking-wide">Rendimiento Hoy</span>
            <AnalyticsIcon className="h-4 w-4 text-bb-muted" />
          </div>

          {loading.performance ? (
            <div className="flex flex-1 flex-col gap-3">
              <SkeletonBlock className="h-10" />
              <SkeletonBlock className="h-10" />
            </div>
          ) : (
            <>
              <PerfRow
                label="Venta de hoy"
                value={formatMoney(data.revenueCents)}
                barPct={data.revenueCents > 0 ? 100 : 0}
                barColor="bg-bb-info"
              />
              <PerfRow
                label="Comisiones"
                value={formatMoney(data.commissionCents)}
                barPct={data.commissionCents > 0 ? Math.max(18, Math.min((data.commissionCents / Math.max(data.revenueCents, 1)) * 100, 100)) : 0}
                barColor="bg-bb-warning"
              />
            </>
          )}
        </PosCard>
      </div>

      {/* ── Row 4: Activity table (full-width) ────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <SectionHeader title="Actividad Reciente" />
        </div>
        {loading.activity ? (
          <SkeletonBlock className="h-52" />
        ) : data.recentActivity.length === 0 ? (
          <PosCard className="py-8 text-center text-sm text-bb-muted">
            Sin actividad hoy
          </PosCard>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-bb-surface">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-bb-border text-[11px] uppercase tracking-wider text-bb-muted">
                  <th className="px-4 py-2.5 font-medium">Hora</th>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Movimiento</th>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.map((entry) => (
                  <tr key={entry.id} className="border-b border-bb-border/50 last:border-b-0">
                    <td className="px-4 py-3 tabular-nums text-bb-muted">
                      {new Date(entry.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {entry.customerName}
                    </td>
                    <td className="px-4 py-3 text-bb-muted">
                      {entry.detail}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        label={entry.movementLabel}
                        color={entry.movementColor}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        label={entry.statusLabel}
                        color={entry.statusColor}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {entry.totalCents === null ? '—' : formatMoney(entry.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
