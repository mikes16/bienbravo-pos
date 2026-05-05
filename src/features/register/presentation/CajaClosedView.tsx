import { useState, useEffect } from 'react'
import type { Register } from '../domain/register.types'
import { cn } from '@/shared/lib/cn'
import { StrongboxIcon } from '@/shared/pos-ui/icons/StrongboxIcon'
import { TouchButton } from '@/shared/pos-ui/TouchButton'

interface CajaClosedViewProps {
  registers: Register[]
  onAbrir: (registerId: string) => void
}

export function CajaClosedView({ registers, onAbrir }: CajaClosedViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    registers.length === 1 ? registers[0].id : null,
  )

  useEffect(() => {
    setSelectedId(registers.length === 1 ? registers[0].id : null)
  }, [registers])

  if (registers.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-8 py-12">
        <div className="text-center text-[14px] text-[var(--color-bone-muted)]">
          <p>Sin cajas configuradas en esta sucursal.</p>
          <p>Pide a tu administrador que configure una caja para esta sucursal.</p>
        </div>
      </div>
    )
  }

  const canAbrir = selectedId !== null

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8 py-12 text-center">
      <div
        aria-hidden="true"
        className="flex h-20 w-20 items-center justify-center border-2 border-[var(--color-leather-muted)] text-[var(--color-bone-muted)]"
      >
        <StrongboxIcon className="h-10 w-10" />
      </div>
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--color-bone-muted)]">
        Caja
      </p>
      <p className="font-[var(--font-pos-display)] text-[32px] font-extrabold leading-none tracking-[-0.02em] text-[var(--color-bone)]">
        Sin abrir
      </p>
      <p className="max-w-[280px] text-[13px] text-[var(--color-bone-muted)]">
        Para empezar a cobrar abre la caja con el fondo inicial.
      </p>

      {registers.length > 1 && (
        <div className="flex flex-col gap-2">
          {registers.map((r) => (
            <TouchButton
              key={r.id}
              variant="secondary"
              size="min"
              onClick={() => setSelectedId(r.id)}
              className={cn(
                selectedId === r.id
                  ? 'border-[var(--color-bravo)] text-[var(--color-bone)]'
                  : 'border-[var(--color-leather-muted)] text-[var(--color-bone-muted)]',
              )}
            >
              {r.name}
            </TouchButton>
          ))}
        </div>
      )}

      <TouchButton
        variant="primary"
        size="primary"
        disabled={!canAbrir}
        onClick={() => selectedId && onAbrir(selectedId)}
        className="mt-2 uppercase tracking-[0.06em]"
      >
        Abrir caja →
      </TouchButton>
    </div>
  )
}
