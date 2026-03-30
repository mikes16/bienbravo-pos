import { useState } from 'react'
import {
  CashIcon,
  CardIcon,
  SwapIcon,
  ChevronLeftIcon,
  type PosIconComponent,
} from '@/shared/pos-ui/GoogleIcon.tsx'
import { cn } from '@/shared/lib/cn.ts'
import { formatMoney } from '@/shared/lib/money.ts'
import { useLocation } from '@/core/location/useLocation.ts'
import { useRegister } from '../application/useRegister.ts'
import type { Register, RegisterSession } from '../domain/register.types.ts'
import { PosCard, TapButton, StatusPill, SkeletonBlock, SectionHeader, EmptyState } from '@/shared/pos-ui/index.ts'

/* ── Views ────────────────────────────────────────────────────────────── */

type View =
  | { kind: 'list' }
  | { kind: 'close'; reg: Register }
  | { kind: 'summary'; session: RegisterSession; regName: string }

/* ── Counter input (inline) ───────────────────────────────────────────── */

function CounterInput({
  label,
  icon: Icon,
  value,
  onChange,
  expected,
}: {
  label: string
  icon: PosIconComponent
  value: string
  onChange: (v: string) => void
  expected: number
}) {
  return (
    <PosCard className="flex items-center gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bb-surface-2">
        <Icon className="h-5 w-5 text-bb-muted" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-bb-muted">{label}</p>
        <p className="text-xs text-bb-muted">Esperado: {formatMoney(expected)}</p>
      </div>
      <input
        type="number"
        inputMode="decimal"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-32 rounded-xl border border-bb-border bg-bb-bg px-4 py-3 text-right text-sm font-bold outline-none focus:border-bb-primary"
      />
    </PosCard>
  )
}

/* ── Close form (inline, not modal) ───────────────────────────────────── */

function CloseForm({
  reg,
  onBack,
  onSubmit,
}: {
  reg: Register
  onBack: () => void
  onSubmit: (cash: number, card: number, transfer: number) => void
}) {
  const [cash, setCash] = useState('')
  const [card, setCard] = useState('')
  const [transfer, setTransfer] = useState('')

  const session = reg.openSession!

  function handleSubmit() {
    onSubmit(
      Math.round(parseFloat(cash || '0') * 100),
      Math.round(parseFloat(card || '0') * 100),
      Math.round(parseFloat(transfer || '0') * 100),
    )
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-bb-muted hover:bg-bb-surface"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-base font-bold">Cerrar Caja — {reg.name}</h2>
          <p className="text-xs text-bb-muted">
            Abierta desde {new Date(session.openedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      <SectionHeader title="Conteo de Cierre" />

      <div className="space-y-3">
        <CounterInput
          label="Efectivo"
          icon={CashIcon}
          value={cash}
          onChange={setCash}
          expected={session.expectedCashCents}
        />
        <CounterInput
          label="Tarjeta"
          icon={CardIcon}
          value={card}
          onChange={setCard}
          expected={session.expectedCardCents}
        />
        <CounterInput
          label="Transferencia"
          icon={SwapIcon}
          value={transfer}
          onChange={setTransfer}
          expected={session.expectedTransferCents}
        />
      </div>

      <div className="mt-auto flex gap-3 pt-4">
        <TapButton size="lg" variant="ghost" className="flex-1" onClick={onBack}>
          Cancelar
        </TapButton>
        <TapButton size="lg" variant="primary" className="flex-1" onClick={handleSubmit}>
          Cerrar Caja
        </TapButton>
      </div>
    </div>
  )
}

/* ── Summary view (inline, not modal) ─────────────────────────────────── */

function SummaryView({
  session,
  regName,
  onDone,
}: {
  session: RegisterSession
  regName: string
  onDone: () => void
}) {
  const rows = [
    { label: 'Efectivo', icon: CashIcon, expected: session.expectedCashCents, counted: session.countedCashCents ?? 0 },
    { label: 'Tarjeta', icon: CardIcon, expected: session.expectedCardCents, counted: session.countedCardCents ?? 0 },
    { label: 'Transferencia', icon: SwapIcon, expected: session.expectedTransferCents, counted: session.countedTransferCents ?? 0 },
  ]
  const totalExpected = rows.reduce((s, r) => s + r.expected, 0)
  const totalCounted = rows.reduce((s, r) => s + r.counted, 0)
  const totalDiff = totalCounted - totalExpected

  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <h2 className="text-base font-bold">Resumen de Cierre</h2>
        <p className="text-xs text-bb-muted">{regName}</p>
      </div>

      <PosCard className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-bb-border text-[11px] uppercase tracking-wider text-bb-muted">
              <th className="px-4 py-3 text-left font-medium">Método</th>
              <th className="px-4 py-3 text-right font-medium">Esperado</th>
              <th className="px-4 py-3 text-right font-medium">Contado</th>
              <th className="px-4 py-3 text-right font-medium">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = r.counted - r.expected
              const Icon = r.icon
              return (
                <tr key={r.label} className="border-b border-bb-border/50 last:border-b-0">
                  <td className="flex items-center gap-2 px-4 py-3">
                    <Icon className="h-4 w-4 text-bb-muted" />
                    <span>{r.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(r.expected)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatMoney(r.counted)}</td>
                  <td className={cn(
                    'px-4 py-3 text-right tabular-nums font-bold',
                    d === 0 ? 'text-bb-muted' : d > 0 ? 'text-green-400' : 'text-bb-danger',
                  )}>
                    {d > 0 ? '+' : ''}{formatMoney(d)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-bb-border font-bold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totalExpected)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totalCounted)}</td>
              <td className={cn(
                'px-4 py-3 text-right tabular-nums',
                totalDiff === 0 ? 'text-bb-muted' : totalDiff > 0 ? 'text-green-400' : 'text-bb-danger',
              )}>
                {totalDiff > 0 ? '+' : ''}{formatMoney(totalDiff)}
              </td>
            </tr>
          </tfoot>
        </table>
      </PosCard>

      {/* Status badge */}
      <PosCard className="flex items-center justify-between">
        <span className="text-sm font-semibold">Estado de conciliación</span>
        <StatusPill
          label={totalDiff === 0 ? 'Cuadrado' : totalDiff > 0 ? 'Sobrante' : 'Faltante'}
          color={totalDiff === 0 ? 'green' : totalDiff > 0 ? 'amber' : 'red'}
        />
      </PosCard>

      <div className="mt-auto pt-4">
        <TapButton size="lg" variant="primary" className="w-full" onClick={onDone}>
          Listo
        </TapButton>
      </div>
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────── */

export function RegisterPage() {
  const { locationId } = useLocation()
  const { registers, loading, error, openSession, closeSession } = useRegister(locationId)
  const [view, setView] = useState<View>({ kind: 'list' })

  if (view.kind === 'close') {
    return (
      <div className="flex h-full flex-col px-6 py-6">
        <CloseForm
          reg={view.reg}
          onBack={() => setView({ kind: 'list' })}
          onSubmit={async (cash, card, transfer) => {
            const session = await closeSession({
              sessionId: view.reg.openSession!.id,
              countedCashCents: cash,
              countedCardCents: card,
              countedTransferCents: transfer,
            })
            if (session) {
              setView({ kind: 'summary', session, regName: view.reg.name })
            } else {
              setView({ kind: 'list' })
            }
          }}
        />
      </div>
    )
  }

  if (view.kind === 'summary') {
    return (
      <div className="flex h-full flex-col px-6 py-6">
        <SummaryView
          session={view.session}
          regName={view.regName}
          onDone={() => setView({ kind: 'list' })}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col px-6 py-6">
      <SectionHeader title="Conciliación de Caja" className="mb-5" />

      {error && (
        <p className="mb-4 rounded-xl bg-bb-danger/10 px-4 py-3 text-sm text-bb-danger">{error}</p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-28" />
          ))}
        </div>
      ) : registers.length === 0 ? (
        <EmptyState icon={<CashIcon className="h-10 w-10 text-bb-muted" />} message="Sin cajas registradas" />
      ) : (
        <div className="space-y-4">
          {registers.map((reg) => (
            <PosCard key={reg.id} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bb-surface-2">
                  <CashIcon className="h-5 w-5 text-bb-muted" />
                </div>
                <div>
                  <p className="text-sm font-bold">{reg.name}</p>
                  <p className="text-xs text-bb-muted">
                    {reg.openSession
                      ? `Abierta ${new Date(reg.openSession.openedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
                      : 'Cerrada'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill
                  label={reg.openSession ? 'Abierta' : 'Cerrada'}
                  color={reg.openSession ? 'green' : 'gray'}
                />
                {reg.openSession ? (
                  <TapButton size="md" variant="danger" onClick={() => setView({ kind: 'close', reg })}>
                    Cerrar
                  </TapButton>
                ) : (
                  <TapButton size="md" variant="primary" onClick={() => openSession(reg.id)}>
                    Abrir
                  </TapButton>
                )}
              </div>
            </PosCard>
          ))}
        </div>
      )}
    </div>
  )
}
