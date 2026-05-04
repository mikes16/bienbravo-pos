import { useState } from 'react'
import { TileGrid, TileButton, TouchButton } from '@/shared/pos-ui'
import type { PosLocation } from '@/core/auth/auth.types'

interface PairingViewProps {
  locations: PosLocation[]
  loading: boolean
  onPair: (locationId: string, password: string) => Promise<boolean>
}

export function PairingView({ locations, loading, onPair }: PairingViewProps) {
  const [selected, setSelected] = useState<PosLocation | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
        Cargando sucursales…
      </div>
    )
  }

  async function handleContinue() {
    if (!selected || !password.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const ok = await onPair(selected.id, password.trim())
      if (!ok) setError('Contraseña incorrecta')
    } finally {
      setSubmitting(false)
    }
  }

  if (selected) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-4">
        <p className="text-[var(--pos-text-body-lg)] text-[var(--color-bone-muted)]">
          Sucursal: <strong className="text-[var(--color-bone)]">{selected.name}</strong>
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setError(null)
          }}
          placeholder="Contraseña de sucursal"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleContinue()
          }}
          className="h-[var(--pos-touch-secondary)] border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-4 text-[var(--pos-text-body)] text-[var(--color-bone)] outline-none focus:border-[var(--color-bravo)]"
        />
        {error && (
          <p className="text-[var(--pos-text-label)] text-[var(--color-bravo)]">{error}</p>
        )}
        <TouchButton
          onClick={() => void handleContinue()}
          disabled={!password.trim() || submitting}
        >
          {submitting ? 'Validando…' : 'Continuar'}
        </TouchButton>
        <TouchButton
          variant="ghost"
          size="row"
          onClick={() => {
            setSelected(null)
            setPassword('')
            setError(null)
          }}
        >
          Cambiar sucursal
        </TouchButton>
      </div>
    )
  }

  if (locations.length === 0) {
    return (
      <p className="text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
        No hay sucursales activas disponibles.
      </p>
    )
  }

  return (
    <div className="w-full max-w-2xl">
      <p className="mb-6 text-center text-[var(--pos-text-body-lg)] text-[var(--color-bone-muted)]">
        Selecciona la sucursal de este iPad
      </p>
      <TileGrid cols={3}>
        {locations.map((loc) => (
          <TileButton
            key={loc.id}
            title={loc.name}
            onClick={() => {
              setSelected(loc)
              setError(null)
            }}
          />
        ))}
      </TileGrid>
    </div>
  )
}
