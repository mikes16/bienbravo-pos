import { createContext, useState, useCallback, useRef, type ReactNode } from 'react'

export interface Toast {
  id: string
  message: string
  variant: 'success' | 'error' | 'info'
}

export interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, variant?: Toast['variant']) => void
  removeToast: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

const TOAST_TTL_MS = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  // Recent message+variant fingerprints → timestamp del último add. Sirve
  // para dedupar spam-taps sin tener que leer state dentro del updater
  // (React 18 StrictMode invoca el updater dos veces en dev). Como `recent`
  // vive en un ref, la verificación es estable y no se duplica.
  const recentRef = useRef<Map<string, number>>(new Map())

  const addToast = useCallback((message: string, variant: Toast['variant'] = 'info') => {
    const key = `${variant}::${message}`
    const now = Date.now()
    const lastShown = recentRef.current.get(key) ?? 0
    if (now - lastShown < TOAST_TTL_MS) return
    recentRef.current.set(key, now)

    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      // Limpia la huella cuando expira el toast, para que el mismo mensaje
      // pueda volver a aparecer 4s después si el usuario lo amerita.
      recentRef.current.delete(key)
    }, TOAST_TTL_MS)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}
