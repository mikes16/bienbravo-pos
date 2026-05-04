import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LockShell } from './LockShell'

describe('LockShell', () => {
  it('renders the brand wordmark', () => {
    render(
      <LockShell>
        <p>body</p>
      </LockShell>,
    )
    expect(screen.getByText('BIENBRAVO')).toBeInTheDocument()
  })

  it('renders children', () => {
    render(
      <LockShell>
        <p>body content here</p>
      </LockShell>,
    )
    expect(screen.getByText('body content here')).toBeInTheDocument()
  })
})
