import { describe, expect, it } from 'vitest'
import { photoPath, thumbPath } from './photos'

describe('photo paths', () => {
  it('puts each photo in the user folder', () => {
    expect(photoPath('user-1', 'abc', 'front', 'webp')).toBe('user-1/abc-front.webp')
    expect(photoPath('user-1', 'abc', 'back', 'jpg')).toBe('user-1/abc-back.jpg')
  })

  it('derives the thumbnail path', () => {
    expect(thumbPath('user-1/abc-front.webp')).toBe('user-1/abc-front-thumb.webp')
    expect(thumbPath('user-1/abc-back.jpg')).toBe('user-1/abc-back-thumb.jpg')
  })
})
