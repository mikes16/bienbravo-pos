import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { WizardShell } from './WizardShell'

describe('WizardShell', () => {
  it('renders steps via StepBar', () => {
    render(
      <WizardShell
        steps={['Catálogo', 'Cliente', 'Pago']}
        activeIndex={0}
        cta={<button type="button">Siguiente</button>}
      >
        <p>Body content</p>
      </WizardShell>,
    )
    expect(screen.getByText('Catálogo')).toBeInTheDocument()
    expect(screen.getByText('Cliente')).toBeInTheDocument()
    expect(screen.getByText('Pago')).toBeInTheDocument()
  })

  it('renders body children', () => {
    render(
      <WizardShell
        steps={['A']}
        activeIndex={0}
        cta={<button type="button">Siguiente</button>}
      >
        <p>Body content</p>
      </WizardShell>,
    )
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('renders cta', () => {
    render(
      <WizardShell
        steps={['A']}
        activeIndex={0}
        cta={<button type="button">Siguiente</button>}
      >
        <p>Body</p>
      </WizardShell>,
    )
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument()
  })

  it('renders meta slot when provided', () => {
    render(
      <WizardShell
        steps={['A']}
        activeIndex={0}
        cta={<button type="button">Siguiente</button>}
        meta={<span>3 líneas</span>}
      >
        <p>Body</p>
      </WizardShell>,
    )
    expect(screen.getByText('3 líneas')).toBeInTheDocument()
  })

  it('does not render back button when onBack is not provided', () => {
    render(
      <WizardShell
        steps={['A']}
        activeIndex={0}
        cta={<button type="button">Siguiente</button>}
      >
        <p>Body</p>
      </WizardShell>,
    )
    expect(screen.queryByRole('button', { name: /regresar/i })).not.toBeInTheDocument()
  })

  it('renders back button and invokes onBack when clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(
      <WizardShell
        steps={['A', 'B']}
        activeIndex={1}
        onBack={onBack}
        cta={<button type="button">Siguiente</button>}
      >
        <p>Body</p>
      </WizardShell>,
    )
    const back = screen.getByRole('button', { name: /regresar/i })
    await user.click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
