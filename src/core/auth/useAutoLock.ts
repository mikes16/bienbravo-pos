import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { usePosAuth } from './usePosAuth.ts'
import { getSaleActivitySnapshot, subscribeSaleActivity } from './saleActivity.ts'
import { usePosSettings } from '@/core/bootstrap/usePosSettings.ts'

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'pointerdown',
  'pointermove',
  'keydown',
  'scroll',
  'touchstart',
]

/**
 * Ventana del aviso previo: los últimos segundos antes de bloquear son los
 * únicos en los que el hook publica un número (spec § 3.3 punto 3).
 */
export const AUTO_LOCK_WARNING_SECONDS = 5

export interface AutoLockStatus {
  /**
   * Segundos que faltan para bloquear, SOLO dentro de la ventana de aviso
   * (5, 4, 3, 2, 1). Fuera de ella es `null`: sin sesión, con el POS ya
   * bloqueado, con un cobro enviándose o mientras todavía sobra tiempo.
   *
   * Es deliberadamente escaso: quien monta este hook es el shell de la app, y
   * publicar un número cada segundo durante todo el tiempo de inactividad
   * re-renderizaría el árbol entero sin que nadie mire ese dato.
   */
  secondsRemaining: number | null
}

/**
 * Bloqueo automático del POS por inactividad — **dos tiempos** (spec § 3, R10).
 *
 * El riesgo real no es un intruso: es que un barbero cobre, olvide tocar el
 * candado y el siguiente cobre en su perfil (venta y comisión mal atribuidas).
 * Por eso el tiempo de reposo es agresivo (15 s por default) y por eso NO se
 * bloquea después de cada venta: pedir PIN por venta sería insoportable.
 *
 * Reglas:
 * 1. Tiempo vigente = `checkoutSeconds` si el cobro publicó una venta en curso
 *    (`saleActivity.inProgress`); si no, `idleSeconds`. Los dos salen de
 *    `usePosSettings()` (ajustes del negocio, con defaults 15 / 90) — antes
 *    había aquí un único plazo fijo de cinco minutos, ya retirado.
 *    El tiempo largo existe porque con el plazo corto parejo la tablet se
 *    bloquearía mientras el cliente busca el efectivo o la terminal responde,
 *    y bloquear desmonta el shell y **pierde el carrito** (vive en memoria).
 * 2. Nunca bloquea mientras un cobro se está enviando (`submitting`): cortar a
 *    media petición dejaría al operador sin saber si la venta se registró. Al
 *    terminar el envío el contador arranca de cero.
 * 3. Cualquier actividad del operador reinicia el contador, y cambiar de
 *    tiempo (abrir/cerrar una venta, o ajustes nuevos del admin) lo reinicia
 *    con el plazo vigente.
 *
 * Sin sesión o ya bloqueado es inerte: ni temporizadores ni oyentes.
 *
 * Es un bloqueo suave de ATRIBUCIÓN, no una frontera de seguridad (spec § 3.3
 * punto 6): la cookie sigue viva y el modelo de auth no cambia.
 *
 * Los tiempos se cuentan con timeouts de una sola vez encadenados, nunca con
 * un intervalo periódico ([D-015]).
 */
export function useAutoLock(): AutoLockStatus {
  const { isAuthenticated, isLocked, lock } = usePosAuth()
  const { idleSeconds, checkoutSeconds } = usePosSettings()
  const { inProgress, submitting } = useSyncExternalStore(
    subscribeSaleActivity,
    getSaleActivitySnapshot,
    getSaleActivitySnapshot,
  )

  const activeSeconds = inProgress ? checkoutSeconds : idleSeconds
  // Armado = hay sesión abierta que proteger, no está ya bloqueado, no hay un
  // cobro en vuelo y el plazo es utilizable (`usePosSettings` ya sanea, esto
  // es el cinturón por si alguien llama al hook con basura).
  const armed = isAuthenticated && !isLocked && !submitting && activeSeconds > 0

  // Identidad de la cuenta atrás vigente: cambia cuando cambia el plazo o
  // cuando el hook se arma/desarma. Sirve para tirar un aviso que ya no
  // corresponde (p. ej. el operador abre una venta con el aviso en pantalla:
  // el contador pasa a 90 s y el "Se bloquea en 3" debe desaparecer).
  const scheduleKey = armed ? String(activeSeconds) : null

  const [warningSeconds, setWarningSeconds] = useState<number | null>(null)
  const [seenKey, setSeenKey] = useState<string | null>(scheduleKey)
  // Ajuste de estado derivado en el RENDER (patrón oficial de React, el mismo
  // de RefreshControl), no en un efecto: el efecto solo programa y cancela
  // temporizadores, y el `setState` vive en sus callbacks.
  let secondsRemaining = warningSeconds
  if (seenKey !== scheduleKey) {
    setSeenKey(scheduleKey)
    setWarningSeconds(null)
    secondsRemaining = null
  }

  useEffect(() => {
    if (!armed) return

    let timer: ReturnType<typeof setTimeout> | null = null

    // Cuenta atrás del aviso: publica el número y encadena el siguiente
    // segundo. Al agotarse, bloquea.
    function countdown(remaining: number) {
      setWarningSeconds(remaining)
      timer = setTimeout(() => {
        if (remaining > 1) {
          countdown(remaining - 1)
          return
        }
        setWarningSeconds(null)
        lock()
      }, 1000)
    }

    // Un solo timeout hasta la ventana de aviso; de ahí en adelante, un
    // timeout por segundo. Mientras sobra tiempo no hay ni un render.
    function schedule() {
      if (timer !== null) clearTimeout(timer)
      const warnFrom = Math.min(activeSeconds, AUTO_LOCK_WARNING_SECONDS)
      timer = setTimeout(() => countdown(warnFrom), (activeSeconds - warnFrom) * 1000)
    }

    function handleActivity() {
      // Si el aviso estaba en pantalla, se retira. Con el valor ya en `null`
      // React sale por bail-out y NO re-renderiza: importa, porque
      // `pointermove` dispara esto decenas de veces por segundo.
      setWarningSeconds((prev) => (prev === null ? prev : null))
      schedule()
    }

    schedule()
    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handleActivity, { passive: true })
    }

    return () => {
      if (timer !== null) clearTimeout(timer)
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handleActivity)
      }
    }
  }, [armed, activeSeconds, lock])

  // Identidad estable mientras el número no cambie: el consumidor puede usar
  // el objeto como dependencia de un efecto sin reprogramarlo en cada render.
  return useMemo(() => ({ secondsRemaining }), [secondsRemaining])
}
