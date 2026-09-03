import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StaleCajaBlocker, StaleCajaBanner } from './StaleCajaBlocker'

const TZ = 'America/Monterrey'
const OPENED_AT = '2026-09-01T16:33:00Z' // 1 sep 10:33 Monterrey

describe('StaleCajaBlocker', () => {
  it('dice desde cuándo está abierta la caja en la hora de la sucursal', () => {
    render(<StaleCajaBlocker openedAt={OPENED_AT} timezone={TZ} onLock={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('1 sep · 10:33')
  })

  it('"Cambiar de operador" cede el POS (onLock)', () => {
    const onLock = vi.fn()
    render(<StaleCajaBlocker openedAt={OPENED_AT} timezone={TZ} onLock={onLock} />)
    fireEvent.click(screen.getByRole('button', { name: /cambiar de operador/i }))
    expect(onLock).toHaveBeenCalledTimes(1)
  })
})

describe('StaleCajaBanner', () => {
  it('muestra la fecha y hora de apertura en la tz de la sucursal', () => {
    render(<StaleCajaBanner openedAt={OPENED_AT} timezone={TZ} />)
    expect(screen.getByRole('status')).toHaveTextContent('Caja abierta desde el 1 sep · 10:33')
  })
})
