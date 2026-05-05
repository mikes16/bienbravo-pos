import { useState } from 'react'
import type { Register } from '../domain/register.types'
import { cn } from '@/shared/lib/cn'
import { StrongboxIcon } from '@/shared/pos-ui/icons/StrongboxIcon'

interface CajaClosedViewProps {
  registers: Register[]
  onAbrir: (registerId: string) => void
}

export function CajaClosedView({ registers, onAbrir }: CajaClosedViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    registers.length === 1 ? registers[0].id : null,
  )

  if (registers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-8 py-12">
        <p className="text-center text-[14px] text-[var(--color-bone-muted)]">
          Sin cajas configuradas en esta sucursal.
        </p>
      </div>
    )
  }

  const effectiveId = selectedId ?? (registers.length === 1 ? registers[0].id : null)
  const canAbrir = effectiveId !== null

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8 py-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center border-2 border-[var(--color-leather-muted)] text-[var(--color-bone-muted)]">
        <StrongboxIcon className="h-10 w-10" />
      </div>
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
        Caja
      </p>
      <p className="font-[var(--font-pos-display)] text-[32px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
        Sin abrir
      </p>
      <p className="max-w-[280px] text-[13px] text-[var(--color-bone-muted)]">
        Para empezar a cobrar abre la caja con el fondo inicial. Lo hace cualquier barbero del turno.
      </p>

      {registers.length > 1 && (
        <div className="flex flex-col gap-2">
          {registers.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className={cn(
                'cursor-pointer border px-4 py-2 text-[14px]',
                selectedId === r.id
                  ? 'border-[var(--color-bravo)] text-[var(--color-bone)]'
                  : 'border-[var(--color-leather-muted)] text-[var(--color-bone-muted)]',
              )}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={!canAbrir}
        onClick={() => effectiveId && onAbrir(effectiveId)}
        className={cn(
          'mt-2 cursor-pointer bg-[var(--color-bravo)] px-8 py-3.5 font-extrabold uppercase tracking-[0.06em] text-[var(--color-bone)] transition-colors hover:bg-[var(--color-bravo-hover)]',
          !canAbrir && 'cursor-not-allowed bg-[var(--color-leather-muted)]',
        )}
      >
        Abrir caja →
      </button>
    </div>
  )
}
