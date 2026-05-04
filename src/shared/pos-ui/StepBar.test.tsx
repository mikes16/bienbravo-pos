import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StepBar } from './StepBar'

describe('StepBar', () => {
  it('renders all step labels', () => {
    render(<StepBar steps={['Catálogo', 'Cliente', 'Pago']} activeIndex={0} />)
    expect(screen.getByText('Catálogo')).toBeInTheDocument()
    expect(screen.getByText('Cliente')).toBeInTheDocument()
    expect(screen.getByText('Pago')).toBeInTheDocument()
  })

  it('marks the active step with bone color', () => {
    render(<StepBar steps={['Catálogo', 'Cliente', 'Pago']} activeIndex={1} />)
    const active = screen.getByText('Cliente')
    expect(active.className).toContain('text-[var(--color-bone)]')
  })

  it('renders separators between steps', () => {
    const { container } = render(
      <StepBar steps={['Catálogo', 'Cliente', 'Pago']} activeIndex={0} />,
    )
    const separators = container.querySelectorAll('[data-step-separator]')
    expect(separators).toHaveLength(2)
  })

  it('renders only labels with no separators when single step', () => {
    const { container } = render(<StepBar steps={['Solo paso']} activeIndex={0} />)
    expect(container.querySelectorAll('[data-step-separator]')).toHaveLength(0)
  })
})
