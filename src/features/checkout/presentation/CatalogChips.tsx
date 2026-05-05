import { useEffect, useRef } from 'react'
import { TouchButton } from '@/shared/pos-ui/TouchButton'
import { cn } from '@/shared/lib/cn'

interface Category {
  id: string
  name: string
  sortOrder: number
}

interface CatalogChipsProps {
  categories: Category[]
  selectedCategoryId: string | null
  onSelect: (id: string | null) => void
  searchQuery: string
  onSearchChange: (q: string) => void
}

export function CatalogChips({ categories, selectedCategoryId, onSelect, searchQuery, onSearchChange }: CatalogChipsProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync controlled value to DOM without fighting userEvent in tests
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = searchQuery
    }
  }, [searchQuery])

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-leather-muted)]/40 px-5 py-4">
      <div className="flex items-center gap-2 border border-[var(--color-leather-muted)] bg-[var(--color-carbon-elevated)] px-3 py-2">
        <span className="text-[var(--color-bone-muted)]" aria-hidden>🔎</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar servicio o producto"
          defaultValue={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Buscar"
          className="flex-1 bg-transparent text-[14px] text-[var(--color-bone)] outline-none placeholder:text-[var(--color-bone-muted)]"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <TouchButton
          variant="secondary"
          size="min"
          onClick={() => onSelect(null)}
          className={cn(
            'shrink-0',
            selectedCategoryId === null && 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
          )}
        >
          Todo
        </TouchButton>
        {categories.map((c) => (
          <TouchButton
            key={c.id}
            variant="secondary"
            size="min"
            onClick={() => onSelect(c.id)}
            className={cn(
              'shrink-0',
              selectedCategoryId === c.id && 'border-[var(--color-bravo)] bg-[var(--color-bravo)]/[0.08] text-[var(--color-bone)]',
            )}
          >
            {c.name}
          </TouchButton>
        ))}
      </div>
    </div>
  )
}
