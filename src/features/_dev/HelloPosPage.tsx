import { useState } from 'react'
import {
  WizardShell,
  TileGrid,
  TileButton,
  MoneyDisplay,
  TouchButton,
  MoneyInput,
  EmptyStateV2,
  SuccessSplash,
} from '@/shared/pos-ui'

const STEPS = ['Catálogo', 'Pago', 'Listo']

interface CartLine {
  id: string
  title: string
  cents: number
}

const SAMPLE_ITEMS = [
  { id: 's1', title: 'Corte clásico', cents: 25000 },
  { id: 's2', title: 'Fade', cents: 28000 },
  { id: 's3', title: 'Barba', cents: 18000 },
  { id: 's4', title: 'Diseño', cents: 12000 },
  { id: 'p1', title: 'Pomada', cents: 39000 },
  { id: 'p2', title: 'Shampoo', cents: 22000 },
]

/**
 * Visual verification screen for the foundation tokens + components.
 * Mounted at /dev/hello-pos, not a real POS feature. Validates that
 * tokens, primitives, and the wizard shell compose correctly.
 */
export function HelloPosPage() {
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [cart, setCart] = useState<CartLine[]>([])
  const [paid, setPaid] = useState(0)

  const total = cart.reduce((sum, l) => sum + l.cents, 0)

  function addToCart(item: { id: string; title: string; cents: number }) {
    setCart((prev) => [...prev, { ...item, id: `${item.id}-${prev.length}` }])
  }

  if (step === 2) {
    return (
      <SuccessSplash
        title="Cobrado"
        subtitle={`Total: $${(total / 100).toLocaleString('es-MX')}`}
        action={{
          label: 'Nueva venta',
          onClick: () => {
            setCart([])
            setPaid(0)
            setStep(0)
          },
        }}
      />
    )
  }

  if (step === 1) {
    return (
      <WizardShell
        steps={STEPS}
        activeIndex={1}
        meta={
          <span className="text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
            Total: <strong className="text-[var(--color-bone)]">${(total / 100).toLocaleString('es-MX')}</strong>
          </span>
        }
        cta={
          <TouchButton onClick={() => setStep(2)} disabled={paid < total}>
            Confirmar pago
          </TouchButton>
        }
      >
        <div className="flex flex-col items-center gap-8">
          <p className="text-[var(--pos-text-body-lg)] text-[var(--color-bone-muted)]">
            Recibe del cliente
          </p>
          <MoneyInput cents={paid} onChange={setPaid} />
        </div>
      </WizardShell>
    )
  }

  return (
    <WizardShell
      steps={STEPS}
      activeIndex={0}
      meta={
        <div className="flex items-baseline gap-3">
          <span className="text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
            Carrito
          </span>
          <MoneyDisplay cents={total} size="S" />
          <span className="text-[var(--pos-text-caption)] text-[var(--color-leather)]">
            {cart.length} {cart.length === 1 ? 'línea' : 'líneas'}
          </span>
        </div>
      }
      cta={
        <TouchButton onClick={() => setStep(1)} disabled={cart.length === 0}>
          Cobrar
        </TouchButton>
      }
    >
      {SAMPLE_ITEMS.length === 0 ? (
        <EmptyStateV2
          title="Sin servicios"
          description="No hay nada en el catálogo todavía."
        />
      ) : (
        <TileGrid cols={3}>
          {SAMPLE_ITEMS.map((item) => (
            <TileButton
              key={item.id}
              title={item.title}
              subtitle={`$${(item.cents / 100).toLocaleString('es-MX')}`}
              onClick={() => addToCart(item)}
            />
          ))}
        </TileGrid>
      )}
    </WizardShell>
  )
}
