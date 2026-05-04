import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LockoutView } from './LockoutView'

describe('LockoutView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders barber name + countdown', () => {
    const lockedUntil = new Date(Date.now() + 60_000)
    render(
      <LockoutView
        staffName="Juan"
        photoUrl={null}
        lockedUntil={lockedUntil}
        onUnlocked={() => {}}
        onBack={() => {}}
        onPoll={async () => null}
      />,
    )
    expect(screen.getByText('Juan')).toBeInTheDocument()
    expect(screen.getByText(/0:60|1:00|0:59/)).toBeInTheDocument()
  })

  it('counts down each second', () => {
    const lockedUntil = new Date(Date.now() + 60_000)
    render(
      <LockoutView
        staffName="Juan"
        photoUrl={null}
        lockedUntil={lockedUntil}
        onUnlocked={() => {}}
        onBack={() => {}}
        onPoll={async () => lockedUntil}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(screen.getByText(/0:5[78]/)).toBeInTheDocument()
  })

  it('calls onUnlocked when countdown reaches 0', () => {
    const onUnlocked = vi.fn()
    const lockedUntil = new Date(Date.now() + 1_000)
    render(
      <LockoutView
        staffName="Juan"
        photoUrl={null}
        lockedUntil={lockedUntil}
        onUnlocked={onUnlocked}
        onBack={() => {}}
        onPoll={async () => lockedUntil}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(1_500)
    })
    expect(onUnlocked).toHaveBeenCalledTimes(1)
  })

  it('calls onUnlocked when poll returns null lockedUntil (admin override)', async () => {
    const onUnlocked = vi.fn()
    const lockedUntil = new Date(Date.now() + 60_000)
    let pollCount = 0
    const onPoll = vi.fn(async () => {
      pollCount++
      return pollCount === 1 ? lockedUntil : null
    })
    render(
      <LockoutView
        staffName="Juan"
        photoUrl={null}
        lockedUntil={lockedUntil}
        onUnlocked={onUnlocked}
        onBack={() => {}}
        onPoll={onPoll}
      />,
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_500)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_500)
    })
    expect(onUnlocked).toHaveBeenCalled()
  })

  it('calls onBack when "Otro barbero" tapped', async () => {
    vi.useRealTimers()
    const onBack = vi.fn()
    const user = userEvent.setup()
    render(
      <LockoutView
        staffName="Juan"
        photoUrl={null}
        lockedUntil={new Date(Date.now() + 60_000)}
        onUnlocked={() => {}}
        onBack={onBack}
        onPoll={async () => null}
      />,
    )
    await user.click(screen.getByRole('button', { name: /otro barbero/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
