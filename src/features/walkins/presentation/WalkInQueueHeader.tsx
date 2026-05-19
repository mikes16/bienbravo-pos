import type { WalkIn } from '../domain/walkins.types.ts'

type Props = {
  walkIns: WalkIn[]
}

/**
 * Top-of-queue metrics strip: how many are actively waiting, how many
 * are paused, and the running average wait of the active set. Numbers
 * only — actions live on the rows.
 *
 * "Active" = PENDING and not paused. Paused walk-ins are excluded from
 * the wait average because their clock isn't really ticking from the
 * customer's POV.
 */
export function WalkInQueueHeader({ walkIns }: Props) {
  const pending = walkIns.filter((w) => w.status === 'PENDING')
  const active = pending.filter((w) => !w.pausedAt)
  const paused = pending.filter((w) => !!w.pausedAt)
  const avgWaitMin =
    active.length === 0
      ? 0
      : Math.round(
          active.reduce(
            (sum, w) => sum + (Date.now() - new Date(w.createdAt).getTime()) / 60_000,
            0,
          ) / active.length,
        )

  return (
    <div className="mb-4 grid grid-cols-3 gap-3">
      <Stat label="En cola" value={String(active.length)} />
      <Stat label="Pausados" value={String(paused.length)} />
      <Stat label="Prom. espera" value={`${avgWaitMin}min`} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--color-leather-muted)]/30 bg-[var(--color-cuero-viejo)] px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-bone-muted)]">
        {label}
      </div>
      <div
        className="tabular-nums text-2xl text-[var(--color-bone)]"
        style={{ fontFamily: 'var(--font-pos-display)' }}
      >
        {value}
      </div>
    </div>
  )
}
