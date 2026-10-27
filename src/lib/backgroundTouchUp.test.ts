import { describe, expect, it } from 'vitest'
import { touchUpInBackground } from './backgroundTouchUp'
import type { Pixels } from './cardDetect'
import { autoTouchUp } from './photoEdit'

function photo(width: number, height: number, paint: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      ;[data[i], data[i + 1], data[i + 2]] = paint(x, y)
      data[i + 3] = 255
    }
  }
  return { width, height, data }
}

describe('touchUpInBackground', () => {
  // Tests have no Worker, so this is the in-place fallback: the same result as autoTouchUp.
  it('gives the same result as autoTouchUp and leaves the photo passed in alone', async () => {
    const dim = photo(120, 168, (x, y) => (x + y) % 9 === 0 ? [60, 50, 40] : [110, 100, 90])
    const before = new Uint8ClampedArray(dim.data)
    const options = { straighten: true, maxEdge: 1600 }
    const result = await touchUpInBackground(dim, options)
    expect(result.changes).toEqual(autoTouchUp(dim, options).changes)
    expect(dim.data).toEqual(before)
  })
})
