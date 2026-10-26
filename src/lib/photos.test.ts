import { describe, expect, it } from 'vitest'
import { isFlatPhoto, photoPath, thumbPath } from './photos'

describe('photo paths', () => {
  it('puts each photo in the user folder', () => {
    expect(photoPath('user-1', 'abc', 'front', 'webp')).toBe('user-1/abc-front.webp')
    expect(photoPath('user-1', 'abc', 'back', 'jpg')).toBe('user-1/abc-back.jpg')
  })

  it('marks straightened photos', () => {
    const flat = photoPath('user-1', 'abc', 'front', 'webp', true)
    expect(flat).toBe('user-1/abc-front-flat.webp')
    expect(isFlatPhoto(flat)).toBe(true)
    expect(isFlatPhoto('user-1/abc-front.webp')).toBe(false)
  })

  it('derives the thumbnail path', () => {
    expect(thumbPath('user-1/abc-front.webp')).toBe('user-1/abc-front-thumb.webp')
    expect(thumbPath('user-1/abc-back.jpg')).toBe('user-1/abc-back-thumb.jpg')
  })
})
