import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { WizardShell, TouchButton } from '@/shared/pos-ui'
import { useLocation } from '@/core/location/useLocation'
import { useRegister } from '../application/useRegister'
import type { RegisterSession } from '../domain/register.types'
import { CountCashStep } from './steps/CountCashStep'
import { totalCountedCents, type CashCounts } from '@/shared/cash/cashCounts'
import { ConfirmDigitalStep, type DigitalCounted } from './steps/ConfirmDigitalStep'
import { ReviewCloseStep } from './steps/ReviewCloseStep'
import { formatMoney } from '@/shared/lib/money'

const ZERO_COUNTS: CashCounts = {
  d500: 0, d200: 0, d100: 0, d50: 0, d20: 0, coinsCents: 0,
}
const PENDING_DIGITAL: DigitalCounted = { cardCents: null, transferCents: null }
const SUCCESS_REDIRECT_DELAY_MS = 2000
const STEPS = ['Contar efectivo', 'Tarjeta · Stripe', 'Cerrar']

export function CloseCajaWizard() {
  const navigate = useNavigate()
  const { locationId } = useLocation()
  const { registers, closeSession } = useRegister(locationId)

  const session = useMemo<RegisterSession | null>(
    () => registers.find((r) => r.openSession)?.openSession ?? null,
    [registers],
  )

  const [step, setStep] = useState(0)
  const [counts, setCounts] = useState<CashCounts>(ZERO_COUNTS)
  const [digital, setDigital] = useState<DigitalCounted>(PENDING_DIGITAL)
  const [confirmAck, setConfirmAck] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)

  useEffect(() => {
    if (registers.length > 0 && !session) {
      navigate('/caja')
    }
  }, [registers.length, session, navigate])

  useEffect(() => {
    if (!successOpen) return
    const t = setTimeout(() => navigate('/hoy'), SUCCESS_REDIRECT_DELAY_MS)
    return () => clearTimeout(t)
  }, [successOpen, navigate])

  if (!session) return null

  const expected = {
    cashCents: session.expectedCashCents,
    cardCents: session.expectedCardCents,
    transferCents: session.expectedTransferCents,
  }
  const counted = {
    cashCents: totalCountedCents(counts),
    // canAdvance at step 1 enforces non-null; fallback to 0 (not expected)
    // surfaces any breach as a large diff rather than silently passing.
    cardCents: digital.cardCents ?? 0,
    transferCents: digital.transferCents ?? 0,
  }
  const totalDiff =
    (counted.cashCents - expected.cashCents) +
    (counted.cardCents - expected.cardCents) +
    (counted.transferCents - expected.transferCents)
  const hasDiff = totalDiff !== 0

  const canAdvance =
    step === 0 ? true :
    step === 1 ? digital.cardCents !== null && digital.transferCents !== null :
    step === 2 ? !hasDiff || confirmAck :
    false

  const handleNext = async () => {
    if (step < 2) {
      setStep(step + 1)
      return
    }
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await closeSession({
        sessionId: session.id,
        countedCashCents: counted.cashCents,
        countedCardCents: counted.cardCents,
        countedTransferCents: counted.transferCents,
      })
      setSuccessOpen(true)
      // useRegister.closeSession already calls refresh() internally
    } catch (e) {
      setError((e as { message?: string }).message ?? 'No se pudo cerrar la caja.')
      setSubmitting(false)
    }
  }

  const ctaLabel =
    step === 0 ? 'Siguiente: Tarjeta · Stripe →' :
    step === 1 ? 'Revisar y cerrar →' :
    submitting ? 'Cerrando…' : 'Cerrar caja ✓'

  if (successOpen) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 py-12 text-center">
        <p className="font-[var(--font-pos-display)] text-[36px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--color-success)]">
          ✓ Caja cerrada
        </p>
        <p className="text-[14px] text-[var(--color-bone-muted)]">
          Resumen guardado · regresando a Hoy
        </p>
      </div>
    )
  }

  return (
    <WizardShell
      steps={STEPS}
      activeIndex={step}
      onBack={step > 0 && !submitting ? () => setStep(step - 1) : undefined}
      cta={
        <TouchButton
          variant="primary"
          size="primary"
          disabled={!canAdvance || submitting}
          onClick={handleNext}
        >
          {ctaLabel}
        </TouchButton>
      }
      meta={
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-bone-muted)]">
            Paso {step + 1} de 3
          </span>
          {step === 0 && (
            <span className="text-[16px] font-extrabold tabular-nums text-[var(--color-bone)]">
              {formatMoney(counted.cashCents)} contados
            </span>
          )}
        </div>
      }
    >
      {step === 0 && (
        <CountCashStep
          counts={counts}
          expectedCashCents={expected.cashCents}
          onChange={setCounts}
        />
      )}
      {step === 1 && (
        <ConfirmDigitalStep
          expectedCardCents={expected.cardCents}
          expectedTransferCents={expected.transferCents}
          counted={digital}
          onChange={setDigital}
        />
      )}
      {step === 2 && (
        <ReviewCloseStep
          expected={expected}
          counted={counted}
          confirmAck={confirmAck}
          onConfirmAckChange={setConfirmAck}
        />
      )}
      {error && (
        <div role="alert" className="mx-6 border border-[var(--color-bravo)]/40 bg-[var(--color-bravo)]/[0.06] px-4 py-3">
          <p className="text-[13px] text-[var(--color-bravo)]">{error}</p>
        </div>
      )}
    </WizardShell>
  )
}
