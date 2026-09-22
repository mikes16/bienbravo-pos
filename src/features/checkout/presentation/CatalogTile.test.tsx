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

  /* ── Modo venta a staff (spec §4.5) ────────────────────────────────────── */

  it('modo staff: pinta el precio staff, tacha el público y los nombra en el texto accesible', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <CatalogTile
        kind="product"
        name="Pomada"
        priceCents={25000}
        stockQty={9}
        staffMode
        staffPriceCents={12000}
        onAdd={onAdd}
      />,
    )
    // El número grande es el precio STAFF, no el público.
    expect(screen.getByText('$120')).toBeInTheDocument()
    // El público queda tachado (semántica, no CSS) y nombrado en la etiqueta:
    // el tachado no puede ser información sólo visual.
    expect(screen.getByRole('deletion')).toHaveTextContent('$250')
    const btn = screen.getByRole('button', {
      name: /pomada, precio staff \$120, precio público anterior \$250/i,
    })
    // Elegible: se puede agregar como siempre.
    expect(btn).toBeEnabled()
    await user.click(btn)
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('modo staff: un producto no elegible se marca, queda deshabilitado y no se agrega', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <CatalogTile
        kind="product"
        name="Shampoo"
        priceCents={25000}
        stockQty={9}
        staffMode
        staffPriceCents={null}
        staffUnavailableMessage="Este producto no está disponible para venta a staff"
        onAdd={onAdd}
      />,
    )
    expect(screen.getByText('No disponible para staff')).toBeInTheDocument()
    // Sin precio staff no se pinta ninguno: sigue el público, jamás un $0.
    expect(screen.getByText('$250')).toBeInTheDocument()
    expect(screen.queryByRole('deletion')).not.toBeInTheDocument()
    const btn = screen.getByRole('button', { name: /no disponible para staff/i })
    expect(btn).toBeDisabled()
    await user.click(btn)
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('modo staff: agotado manda sobre el aviso de staff y sigue sin poder agregarse', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <CatalogTile
        kind="product"
        name="Shampoo"
        priceCents={25000}
        stockQty={0}
        staffMode
        staffPriceCents={null}
        staffUnavailableMessage="Elige la presentación"
        onAdd={onAdd}
      />,
    )
    expect(screen.getByText('agotado')).toBeInTheDocument()
    expect(screen.queryByText('No disponible para staff')).not.toBeInTheDocument()
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    await user.click(btn)
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('sin modo staff la card no cambia: precio público, sin tachado ni aviso', async () => {
    const onAdd = vi.fn()
    const user = userEvent.setup()
    render(<CatalogTile kind="product" name="Pomada" priceCents={25000} stockQty={9} onAdd={onAdd} />)
    expect(screen.getByText('$250')).toBeInTheDocument()
    expect(screen.queryByRole('deletion')).not.toBeInTheDocument()
    expect(screen.queryByText('No disponible para staff')).not.toBeInTheDocument()
    const btn = screen.getByRole('button')
    expect(btn).not.toHaveAccessibleName(/precio staff/i)
    expect(btn).toBeEnabled()
    await user.click(btn)
    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})
