import { useEffect, useRef } from 'react'
import { usePosAuth } from './usePosAuth.ts'

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'pointerdown',
  'pointermove',
  'keydown',
  'scroll',
  'touchstart',
]

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export function useAutoLock(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  const { isAuthenticated, isLocked, lock } = usePosAuth()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isAuthenticated || isLocked) return

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(lock, timeoutMs)
    }

    resetTimer()

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, resetTimer, { passive: true })
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, resetTimer)
      }
    }
  }, [isAuthenticated, isLocked, lock, timeoutMs])
}
