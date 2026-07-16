import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CustomerChip } from './CustomerChip'

describe('CustomerChip', () => {
  it('renders empty CTA when no customer', () => {
    render(<CustomerChip customer={null} onTap={() => {}} onClear={() => {}} />)
    expect(screen.getByText(/cliente/i)).toBeInTheDocument()
    expect(screen.getByText(/opcional/i)).toBeInTheDocument()
  })

  it('renders customer name + clear × when selected', () => {
    render(<CustomerChip customer={{ id: 'c1', fullName: 'Carlos Méndez' }} onTap={() => {}} onClear={() => {}} />)
    expect(screen.getByText(/carlos méndez/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /quitar cliente/i })).toBeInTheDocument()
  })

  it('clicking the chip body fires onTap', async () => {
    const onTap = vi.fn()
    const user = userEvent.setup()
    render(<CustomerChip customer={null} onTap={onTap} onClear={() => {}} />)
    await user.click(screen.getByRole('button', { name: /\+ cliente/i }))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('clicking × fires onClear (does not fire onTap)', async () => {
    const onTap = vi.fn()
    const onClear = vi.fn()
    const user = userEvent.setup()
    render(<CustomerChip customer={{ id: 'c1', fullName: 'Carlos' }} onTap={onTap} onClear={onClear} />)
    await user.click(screen.getByRole('button', { name: /quitar cliente/i }))
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(onTap).not.toHaveBeenCalled()
  })

  it('shows a VIP badge when the linked customer is VIP', () => {
    render(
      <CustomerChip
        customer={{ id: 'c1', fullName: 'Carlos', reputationTag: 'VIP' }}
        onTap={() => {}}
        onClear={() => {}}
      />,
    )
    expect(screen.getByText('VIP')).toBeInTheDocument()
  })

  it('shows an ATENCIÓN badge when the linked customer is FLAGGED_BY_STAFF', () => {
    render(
      <CustomerChip
        customer={{ id: 'c1', fullName: 'Carlos', reputationTag: 'FLAGGED_BY_STAFF' }}
        onTap={() => {}}
        onClear={() => {}}
      />,
    )
    expect(screen.getByText('ATENCIÓN')).toBeInTheDocument()
  })

  it('shows no reputation badge for reliable / no-show / untagged customers', () => {
    render(
      <CustomerChip
        customer={{ id: 'c1', fullName: 'Carlos', reputationTag: 'RELIABLE' }}
        onTap={() => {}}
        onClear={() => {}}
      />,
    )
    expect(screen.queryByText('VIP')).toBeNull()
    expect(screen.queryByText('ATENCIÓN')).toBeNull()
  })
})
