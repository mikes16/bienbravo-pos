import { describe, it, expect } from 'vitest'
import { cldThumb } from './cloudinary'

const SAMPLE = 'https://res.cloudinary.com/insightcollective/image/upload/v1780465868/staff/jvgbzeuubxlnxrsjp98n.jpg'

describe('cldThumb', () => {
  it('returns null for null/undefined', () => {
    expect(cldThumb(null, { w: 40 })).toBeNull()
    expect(cldThumb(undefined, { w: 40 })).toBeNull()
  })

  it('passes through non-Cloudinary URLs unchanged', () => {
    expect(cldThumb('https://example.com/photo.jpg', { w: 40 })).toBe('https://example.com/photo.jpg')
  })

  it('inserts transforms after /image/upload/', () => {
    const out = cldThumb(SAMPLE, { w: 40 })!
    expect(out).toContain('/image/upload/c_fill,w_40,q_auto,f_auto/v1780465868/')
  })

  it('honors h, dpr, q, f, c overrides', () => {
    const out = cldThumb(SAMPLE, { w: 120, h: 150, q: 80, f: 'webp', c: 'fit', dpr: 2 })!
    expect(out).toContain('c_fit,w_120,h_150,q_80,f_webp,dpr_2')
  })

  it('rounds non-integer dimensions', () => {
    const out = cldThumb(SAMPLE, { w: 39.7, h: 40.4 })!
    expect(out).toContain('w_40,h_40')
  })
})
