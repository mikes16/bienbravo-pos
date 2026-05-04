import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PairingView } from './PairingView'

const SAMPLE_LOCATIONS = [
  { id: 'loc1', name: 'Centro' },
  { id: 'loc2', name: 'Norte' },
  { id: 'loc3', name: 'Sur' },
]

describe('PairingView', () => {
  it('renders all locations as tiles', () => {
    render(
      <PairingView
        locations={SAMPLE_LOCATIONS}
        loading={false}
        onPair={async () => true}
      />,
    )
    expect(screen.getByRole('button', { name: 'Centro' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Norte' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sur' })).toBeInTheDocument()
  })

  it('shows password input after location is selected', async () => {
    const user = userEvent.setup()
    render(
      <PairingView
        locations={SAMPLE_LOCATIONS}
        loading={false}
        onPair={async () => true}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Centro' }))
    expect(screen.getByPlaceholderText('Contraseña de sucursal')).toBeInTheDocument()
    expect(screen.getByText(/centro/i)).toBeInTheDocument()
  })

  it('calls onPair with locationId + password when Continuar clicked', async () => {
    const onPair = vi.fn(async () => true)
    const user = userEvent.setup()
    render(
      <PairingView locations={SAMPLE_LOCATIONS} loading={false} onPair={onPair} />,
    )
    await user.click(screen.getByRole('button', { name: 'Centro' }))
    await user.type(screen.getByPlaceholderText('Contraseña de sucursal'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(onPair).toHaveBeenCalledWith('loc1', 'secret123')
  })

  it('shows error when onPair returns false', async () => {
    const user = userEvent.setup()
    render(
      <PairingView locations={SAMPLE_LOCATIONS} loading={false} onPair={async () => false} />,
    )
    await user.click(screen.getByRole('button', { name: 'Centro' }))
    await user.type(screen.getByPlaceholderText('Contraseña de sucursal'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText(/contraseña incorrecta/i)).toBeInTheDocument()
  })

  it('cancel returns to location selector', async () => {
    const user = userEvent.setup()
    render(
      <PairingView locations={SAMPLE_LOCATIONS} loading={false} onPair={async () => true} />,
    )
    await user.click(screen.getByRole('button', { name: 'Centro' }))
    await user.click(screen.getByRole('button', { name: 'Cambiar sucursal' }))
    expect(screen.getByRole('button', { name: 'Centro' })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Contraseña de sucursal')).not.toBeInTheDocument()
  })

  it('renders loading skeleton when loading=true', () => {
    render(<PairingView locations={[]} loading={true} onPair={async () => true} />)
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })
})
