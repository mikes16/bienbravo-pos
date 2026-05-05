import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CatalogChips } from './CatalogChips'

const CATEGORIES = [
  { id: 'cat-1', name: 'Cortes', sortOrder: 1 },
  { id: 'cat-2', name: 'Color', sortOrder: 2 },
  { id: 'cat-3', name: 'Productos', sortOrder: 3 },
]

describe('CatalogChips', () => {
  it('renders all categories', () => {
    render(<CatalogChips categories={CATEGORIES} selectedCategoryId={null} onSelect={() => {}} searchQuery="" onSearchChange={() => {}} />)
    expect(screen.getByText('Cortes')).toBeInTheDocument()
    expect(screen.getByText('Color')).toBeInTheDocument()
    expect(screen.getByText('Productos')).toBeInTheDocument()
  })

  it('renders "Todo" chip', () => {
    render(<CatalogChips categories={CATEGORIES} selectedCategoryId={null} onSelect={() => {}} searchQuery="" onSearchChange={() => {}} />)
    expect(screen.getByText('Todo')).toBeInTheDocument()
  })

  it('clicking a chip fires onSelect with id', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<CatalogChips categories={CATEGORIES} selectedCategoryId={null} onSelect={onSelect} searchQuery="" onSearchChange={() => {}} />)
    await user.click(screen.getByText('Cortes'))
    expect(onSelect).toHaveBeenCalledWith('cat-1')
  })

  it('search input fires onSearchChange', async () => {
    const onSearchChange = vi.fn()
    const user = userEvent.setup()
    render(<CatalogChips categories={CATEGORIES} selectedCategoryId={null} onSelect={() => {}} searchQuery="" onSearchChange={onSearchChange} />)
    const input = screen.getByPlaceholderText(/buscar/i)
    await user.type(input, 'corte')
    expect(onSearchChange).toHaveBeenLastCalledWith('corte')
  })
})
