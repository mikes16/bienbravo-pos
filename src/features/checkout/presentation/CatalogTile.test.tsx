import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CatalogTile } from './CatalogTile'

describe('CatalogTile', () => {
  it('renders service tile with name + price', () => {
    render(<CatalogTile kind="service" name="Corte" priceCents={28000} onAdd={() => {}} />)
    expect(screen.getByText('Corte')).toBeInTheDocument()
    expect(screen.getByText('$280')).toBeInTheDocument()
  })

  it('renders product tile with low-stock badge', () => {
    render(<CatalogTile kind="product" name="Shampoo" priceCents={25000} stockQty={2} onAdd={() => {}} />)
    expect(screen.getByText(/2 left|stock/i)).toBeInTheDocument()
  })

  it('clicking calls onAdd', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<CatalogTile kind="service" name="Corte" priceCents={28000} onAdd={onAdd} />)
    await user.click(screen.getByRole('button'))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('disabled when stockQty is 0', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<CatalogTile kind="product" name="Shampoo" priceCents={25000} stockQty={0} onAdd={onAdd} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    await user.click(btn)
    expect(onAdd).not.toHaveBeenCalled()
  })
})
