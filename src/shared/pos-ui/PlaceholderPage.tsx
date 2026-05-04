interface PlaceholderPageProps {
  title: string
  subtitle?: string
}

export function PlaceholderPage({ title, subtitle }: PlaceholderPageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 py-12 text-center">
      <p className="font-[var(--font-pos-display)] text-[var(--pos-text-numeral-s)] font-extrabold uppercase tracking-[0.04em] text-[var(--color-leather)]">
        {title}
      </p>
      {subtitle && (
        <p className="max-w-md text-[var(--pos-text-body)] text-[var(--color-bone-muted)]">
          {subtitle}
        </p>
      )}
    </div>
  )
}
