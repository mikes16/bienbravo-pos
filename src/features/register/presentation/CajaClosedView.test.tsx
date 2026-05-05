import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CajaClosedView } from './CajaClosedView'
import type { Register } from '../domain/register.types'

const REG_A: Register = {
  id: 'reg-a',
  name: 'Caja A',
  isActive: true,
  locationId: 'loc-1',
  openSession: null,
}
const REG_B: Register = { ...REG_A, id: 'reg-b', name: 'Caja B' }

describe('CajaClosedView', () => {
  it('renders the Sin abrir hero', () => {
    render(<CajaClosedView registers={[REG_A]} onAbrir={() => {}} />)
    expect(screen.getByText(/sin abrir/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /abrir caja/i })).toBeInTheDocument()
  })

  it('auto-picks the single register on CTA click', async () => {
    const onAbrir = vi.fn()
    const user = userEvent.setup()
    render(<CajaClosedView registers={[REG_A]} onAbrir={onAbrir} />)
    await user.click(screen.getByRole('button', { name: /abrir caja/i }))
    expect(onAbrir).toHaveBeenCalledWith('reg-a')
  })

  it('shows register selector when 2+ registers configured', () => {
    render(<CajaClosedView registers={[REG_A, REG_B]} onAbrir={() => {}} />)
    expect(screen.getByText('Caja A')).toBeInTheDocument()
    expect(screen.getByText('Caja B')).toBeInTheDocument()
  })

  it('uses selected register id when clicking CTA in multi-register mode', async () => {
    const onAbrir = vi.fn()
    const user = userEvent.setup()
    render(<CajaClosedView registers={[REG_A, REG_B]} onAbrir={onAbrir} />)
    await user.click(screen.getByRole('button', { name: /caja b/i }))
    await user.click(screen.getByRole('button', { name: /abrir caja/i }))
    expect(onAbrir).toHaveBeenCalledWith('reg-b')
  })

  it('shows empty state when no registers configured', () => {
    render(<CajaClosedView registers={[]} onAbrir={() => {}} />)
    expect(screen.getByText(/sin cajas configuradas|no hay cajas/i)).toBeInTheDocument()
  })

  it('resets selection when registers prop changes', async () => {
    const onAbrir = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<CajaClosedView registers={[REG_A, REG_B]} onAbrir={onAbrir} />)
    await user.click(screen.getByRole('button', { name: /caja b/i }))
    // At this point reg-b is selected — CTA enabled
    rerender(<CajaClosedView registers={[REG_A]} onAbrir={onAbrir} />)
    // After re-render with single register, selection should be reg-a (auto-pick)
    await user.click(screen.getByRole('button', { name: /abrir caja/i }))
    expect(onAbrir).toHaveBeenCalledWith('reg-a')
  })
})
