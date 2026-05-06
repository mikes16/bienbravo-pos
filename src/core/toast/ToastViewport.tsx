import { useToast } from './useToast'
import { cn } from '@/shared/lib/cn'

export function ToastViewport() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-16 z-[60] flex flex-col items-center gap-2 px-4 sm:top-20"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => removeToast(t.id)}
          className={cn(
            'pointer-events-auto flex max-w-md cursor-pointer items-center gap-3 border bg-[var(--color-carbon-elevated)] px-4 py-3 text-left shadow-lg shadow-black/40',
            t.variant === 'success' && 'border-[var(--color-success)]',
            t.variant === 'error' && 'border-[var(--color-bravo)]',
            t.variant === 'info' && 'border-[var(--color-leather-muted)]',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'h-2 w-2 shrink-0',
              t.variant === 'success' && 'bg-[var(--color-success)]',
              t.variant === 'error' && 'bg-[var(--color-bravo)]',
              t.variant === 'info' && 'bg-[var(--color-leather)]',
            )}
          />
          <span className="text-[13px] font-bold text-[var(--color-bone)]">{t.message}</span>
        </button>
      ))}
    </div>
  )
}
