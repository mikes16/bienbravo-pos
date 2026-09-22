import { useCallback, useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { WizardShell, TouchButton, SkeletonRow } from '@/shared/pos-ui'
import { useLocation } from '@/core/location/useLocation'
import { usePosAuth } from '@/core/auth/usePosAuth'
import { useRegister } from '../application/useRegister'
import type { RegisterSession } from '../domain/register.types'
import { CountCashStep } from './steps/CountCashStep'
import { totalCountedCents, emptyCashCounts, type CashCounts } from '@/shared/cash/cashCounts'
import { ConfirmDigitalStep, type DigitalCounted } from './steps/ConfirmDigitalStep'
import { ReviewCloseStep } from './steps/ReviewCloseStep'
import { formatMoney } from '@/shared/lib/money'
import { readableSpanishError } from '@/shared/lib/errors'

const SUCCESS_REDIRECT_DELAY_MS = 2000
const STEPS = ['Contar efectivo', 'Tarjeta', 'Cerrar']

export function CloseCajaWizard() {
  const navigate = useNavigate()
  const { locationId } = useLocation()
  const { viewer } = usePosAuth()
  // Defensive: solo bloqueamos cuando estamos SEGUROS que el viewer cargó
  // sin el perm. Durante loading (viewer === null) dejamos pasar para no
  // romper renderings síncronos.
  const canClose = !viewer || viewer.permissions.includes('pos.register.close')
  const { registers, status, closeSession, refresh } = useRegister(locationId)

  /**
   * La lectura de caja falló (servidor u offline). Un fallo TIRA lo que había
   * ([D-018]), así que aquí NO hay esperado que mostrar: el corte no arranca.
   * Cerrar contra un `expected*Cents` de hace media hora descuadra la caja de
   * la sucursal, que es justo el escenario caro que esta pantalla evita.
   */
  const loadFailed = status === 'error' || status === 'offline'

  // `refresh()` RECHAZA cuando la carga falla (el canal de frescura cuenta con
  // eso, ver useRegister): acá se traga para no dejar una promesa sin manejar
  // — el fallo ya se está pintando en esta misma pantalla.
  const retry = useCallback(() => {
    void refresh().catch(() => {})
  }, [refresh])

  // `registers === null` es "aún no sé" ([D-020]), no "no hay cajas": sin
  // respuesta del servidor no hay sesión que mostrar y el wizard espera.
  const session = useMemo<RegisterSession | null>(
    () => registers?.find((r) => r.openSession)?.openSession ?? null,
    [registers],
  )
  /** 0 también mientras no sé: así el rebote de abajo no dispara antes de tiempo. */
  const registerCount = registers?.length ?? 0

  const [step, setStep] = useState(0)
  const [counts, setCounts] = useState<CashCounts>(emptyCashCounts())
  /**
   * Lo ÚNICO que se captura del paso digital: la TARJETA, que el cajero
   * reconcilia contra la terminal física (confirmar el esperado o "Ajustar").
   * `null` es "todavía no la confirma" ([D-020]) y es lo único que traba el paso.
   */
  const [countedCardCents, setCountedCardCents] = useState<number | null>(null)
  /**
   * Stripe se auto-confirma por definición: el cajero no tiene cómo verificarlo
   * y `ConfirmDigitalStep` ni siquiera pinta su fila. Por eso el contado se
   * DERIVA en render del esperado VIGENTE en vez de congelarse en estado: la
   * caja está viva dentro del asistente (`useRegister` escucha los temas
   * `sales` + `register` del canal de frescura, T-044/T-045), así que un pago
   * Stripe cobrado en otra terminal a media captura mueve
   * `expectedTransferCents` — con el auto-relleno de una sola vez el cierre
   * mandaba un contado viejo y registraba una diferencia fantasma que el
   * cajero NO puede corregir (no hay input de Stripe).
   *
   * Sin sesión es `null` = "no sé" ([D-018]/[D-060]), nunca 0: en ese estado el
   * wizard ni siquiera pinta pasos (rama del esqueleto, más abajo).
   */
  const countedTransferCents = session?.expectedTransferCents ?? null
  const digital: DigitalCounted = {
    cardCents: countedCardCents,
    transferCents: countedTransferCents,
  }
  const [confirmAck, setConfirmAck] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successOpen, setSuccessOpen] = useState(false)

  // Salida limpia cuando el servidor dice que ya no hay sesión abierta (la
  // cerraron desde otra terminal). Mientras `registers` sea null el conteo es
  // 0 y NO se navega: rebotar a /caja antes de la primera respuesta sacaría
  // al cajero del corte por una carga lenta, no por un cierre real.
  useEffect(() => {
    if (registerCount > 0 && !session) {
      navigate('/caja')
    }
  }, [registerCount, session, navigate])

  useEffect(() => {
    if (!successOpen) return
    const t = setTimeout(() => navigate('/hoy'), SUCCESS_REDIRECT_DELAY_MS)
    return () => clearTimeout(t)
  }, [successOpen, navigate])

  // Defensive: gate por deeplink. CajaPage también gatea, pero si alguien
  // navega directo a /caja/cerrar sin permiso, no debería ver el wizard.
  // Va ANTES de la espera de la carga: sin el permiso da igual qué conteste
  // el servidor, y explicar el bloqueo es mejor que un esqueleto eterno.
  if (!canClose) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-bone-muted)]">
            Sin acceso
          </p>
          <h1 className="mb-2 text-2xl font-bold text-[var(--color-bone)]">Cerrar caja</h1>
          <p className="mb-4 text-sm text-[var(--color-bone-muted)]">
            Tu rol no incluye <code className="font-mono text-[var(--color-bone)]">pos.register.close</code>.
          </p>
          <TouchButton variant="secondary" size="min" onClick={() => navigate('/caja')}>
            ← Volver
          </TouchButton>
        </div>
      </div>
    )
  }

  // Un cierre YA confirmado por el servidor manda sobre cualquier estado de la
  // lectura: el re-sync que `closeSession` dispara detrás puede fallar (red) y
  // dejar `registers` en null — anunciar "no se pudo confirmar" encima de una
  // caja que sí cerró sería mentirle al operador.
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

  // El corte se hace contra cifras recién traídas de la red. Si no se pudieron
  // confirmar, el asistente NO se pinta: sin pasos y sin CTA no hay forma de
  // avanzar ni de enviar el cierre. Las dos salidas son reintentar la carga o
  // volver a Caja.
  if (loadFailed) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div role="alert">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-bone-muted)]">
              {status === 'offline' ? 'Sin conexión' : 'Error'}
            </p>
            <h1
              className="mb-2 text-2xl font-bold text-[var(--color-bone)]"
              style={{ fontFamily: 'var(--font-pos-display)' }}
            >
              Cerrar caja
            </h1>
            <p className="text-sm text-[var(--color-bone-muted)]">
              No se pudo confirmar el estado de la caja. Revisa la conexión.
            </p>
          </div>
          <div className="mt-5 flex items-center justify-center gap-3">
            <TouchButton variant="primary" size="min" onClick={retry}>
              Reintentar
            </TouchButton>
            <TouchButton variant="secondary" size="min" onClick={() => navigate('/caja')}>
              ← Volver a caja
            </TouchButton>
          </div>
        </div>
      </div>
    )
  }

  // Todavía no sé si hay sesión abierta ni con qué montos ([D-020]): esqueleto,
  // nunca el paso 1 con un esperado sin confirmar. Antes esto era un
  // `return null` — pantalla en blanco sin explicación. También cubre el
  // instante entre "el servidor dice que ya no hay sesión" y el rebote a /caja
  // que dispara el efecto de arriba.
  if (!session) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="flex h-full flex-col items-center justify-center gap-4 px-8 py-12 text-center"
      >
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-bone-muted)]">
          Cerrar caja
        </p>
        <SkeletonRow heightPx={48} widthPercent={50} />
        <SkeletonRow heightPx={20} widthPercent={30} />
        <SkeletonRow heightPx={56} widthPercent={60} />
        <p className="text-[13px] text-[var(--color-bone-muted)]">
          Confirmando el estado de la caja…
        </p>
      </div>
    )
  }

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
      // Solo llegamos aquí si la mutation resolvió — closeSession re-lanza en
      // fallo, así que NUNCA mostramos éxito sobre un cierre rechazado.
      setSuccessOpen(true)
    } catch (e) {
      // closeSession ya re-sincronizó contra la red. Si la caja se cerró
      // remotamente, `session` ahora es null → el effect de arriba navega a
      // /caja (salida limpia). Si sigue abierta (otro fallo), mostramos el
      // mensaje del servidor en español, o un fallback si viene en inglés técnico.
      setError(
        readableSpanishError((e as { message?: string }).message) ??
          'No se pudo cerrar la caja.',
      )
      setSubmitting(false)
    }
  }

  const ctaLabel =
    step === 0 ? 'Siguiente: Tarjeta · Stripe →' :
    step === 1 ? 'Revisar y cerrar →' :
    submitting ? 'Cerrando…' : 'Cerrar caja ✓'

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
          // Del paso digital sólo se guarda la tarjeta: el contado de Stripe es
          // derivado del esperado vigente y no hay control que lo edite.
          onChange={(next) => setCountedCardCents(next.cardCents)}
        />
      )}
      {step === 2 && (
        <ReviewCloseStep
          expected={expected}
          counted={counted}
          openingCashCents={session.openingCashCents}
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
