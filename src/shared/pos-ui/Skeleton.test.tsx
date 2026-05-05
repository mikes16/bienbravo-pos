import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SkeletonRow, SkeletonCard, SkeletonText, SkeletonCircle } from './Skeleton'

describe('Skeleton primitives', () => {
  it('SkeletonRow renders with pulse + cuero-viejo bg', () => {
    const { container } = render(<SkeletonRow />)
    expect(container.firstChild).toHaveClass('animate-pulse')
    expect((container.firstChild as HTMLElement).className).toMatch(/cuero-viejo/)
  })

  it('SkeletonCard renders square aspect block', () => {
    const { container } = render(<SkeletonCard />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })

  it('SkeletonText renders inline-block with width prop', () => {
    const { container } = render(<SkeletonText widthPercent={60} />)
    expect((container.firstChild as HTMLElement).style.width).toBe('60%')
  })

  it('SkeletonCircle renders rounded for avatars', () => {
    const { container } = render(<SkeletonCircle size={48} />)
    expect((container.firstChild as HTMLElement).className).toMatch(/rounded-full/)
    expect((container.firstChild as HTMLElement).style.height).toBe('48px')
    expect((container.firstChild as HTMLElement).style.width).toBe('48px')
  })

  it('accepts custom className', () => {
    const { container } = render(<SkeletonRow className="my-custom" />)
    expect((container.firstChild as HTMLElement).className).toMatch(/my-custom/)
  })

  it('SkeletonRow accepts heightPx prop', () => {
    const { container } = render(<SkeletonRow heightPx={20} />)
    expect((container.firstChild as HTMLElement).style.height).toBe('20px')
  })
})
