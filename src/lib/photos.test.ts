import { describe, expect, it } from 'vitest'
import { isAutoPhoto, isFlatPhoto, photoPath, photosDone, thumbPath } from './photos'

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

  it('marks photos touched up when they were taken, straightened or not', () => {
    const both = photoPath('user-1', 'abc', 'front', 'webp', true, true)
    expect(both).toBe('user-1/abc-front-flat-auto.webp')
    expect(isFlatPhoto(both)).toBe(true)
    expect(isAutoPhoto(both)).toBe(true)
    const unstraightened = photoPath('user-1', 'abc', 'back', 'jpg', false, true)
    expect(unstraightened).toBe('user-1/abc-back-auto.jpg')
    expect(isFlatPhoto(unstraightened)).toBe(false)
    expect(isAutoPhoto('user-1/abc-front-flat.webp')).toBe(false)
  })

  it('counts a card’s photos as done only when every one was touched up when taken', () => {
    expect(photosDone('u/a-front-flat-auto.webp', 'u/a-back-auto.webp')).toBe(true)
    expect(photosDone('u/a-front-flat-auto.webp', null)).toBe(true)
    expect(photosDone('u/a-front-flat-auto.webp', 'u/a-back-flat.webp')).toBe(false)
    expect(photosDone(null, null)).toBe(false)
  })

  it('derives the thumbnail path', () => {
    expect(thumbPath('user-1/abc-front.webp')).toBe('user-1/abc-front-thumb.webp')
    expect(thumbPath('user-1/abc-back.jpg')).toBe('user-1/abc-back-thumb.jpg')
  })
})
