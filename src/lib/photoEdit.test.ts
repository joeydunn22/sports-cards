import { describe, expect, it } from 'vitest'
import type { Pixels } from './cardDetect'
import {
  applyHomography,
  fillGlare,
  FULL_FRAME,
  findCardCorners,
  homography,
  inpaint,
  outputSize,
  rotateQuad,
  rotateQuarter,
  warpPerspective,
  type Point,
  type Quad,
} from './photoEdit'

/** Synthetic photo: each pixel's gray level comes from `shade(x, y)`. */
function image(width: number, height: number, shade: (x: number, y: number) => number): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4
      data[p] = data[p + 1] = data[p + 2] = shade(x, y)
      data[p + 3] = 255
    }
  }
  return { width, height, data }
}

const gray = (img: Pixels, x: number, y: number) => img.data[(y * img.width + x) * 4]

/** Is (x, y) inside the convex quad given in pixel coordinates? */
function inside(quad: Point[], x: number, y: number) {
  return quad.every((a, i) => {
    const b = quad[(i + 1) % 4]
    return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) >= 0
  })
}

/** A bright card tilted about 6° on a dark background, 300×300 photo. Corners in pixels, clockwise from top-left. */
const TILTED: Point[] = [
  { x: 80, y: 40 },
  { x: 210, y: 54 },
  { x: 190, y: 240 },
  { x: 60, y: 226 },
]
const tiltedPhoto = () => image(300, 300, (x, y) => (inside(TILTED, x + 0.5, y + 0.5) ? 220 : 20))

describe('homography', () => {
  it('is the identity for matching corners', () => {
    const h = homography(FULL_FRAME, FULL_FRAME)
    const p = applyHomography(h, { x: 0.3, y: 0.7 })
    expect(p.x).toBeCloseTo(0.3)
    expect(p.y).toBeCloseTo(0.7)
  })

  it('maps each corner onto its target', () => {
    const quad: Quad = [
      { x: 0.1, y: 0.2 },
      { x: 0.9, y: 0.1 },
      { x: 0.8, y: 0.95 },
      { x: 0.15, y: 0.85 },
    ]
    const h = homography(FULL_FRAME, quad)
    FULL_FRAME.forEach((corner, i) => {
      const p = applyHomography(h, corner)
      expect(p.x).toBeCloseTo(quad[i].x)
      expect(p.y).toBeCloseTo(quad[i].y)
    })
  })

  it('refuses corners that are all on one line', () => {
    const line = [0, 1, 2, 3].map((i) => ({ x: i / 3, y: i / 3 }))
    expect(() => homography(FULL_FRAME, line)).toThrow()
  })
})

describe('outputSize', () => {
  it('averages opposite edges and caps the long side', () => {
    const quad: Quad = [
      { x: 0.1, y: 0.1 },
      { x: 0.6, y: 0.1 },
      { x: 0.6, y: 0.8 },
      { x: 0.1, y: 0.8 },
    ]
    expect(outputSize(quad, 1000, 1000, 1600)).toEqual({ width: 500, height: 700 })
    expect(outputSize(quad, 1000, 1000, 350)).toEqual({ width: 250, height: 350 })
  })
})

describe('warpPerspective', () => {
  it('flattens a tilted card into an upright one with no background left', () => {
    const photo = tiltedPhoto()
    const quad = TILTED.map((p) => ({ x: p.x / 300, y: p.y / 300 })) as Quad
    const { width, height } = outputSize(quad, 300, 300, 1600)
    const flat = warpPerspective(photo, quad, width, height)
    expect(flat.width).toBe(width)
    expect(height).toBeGreaterThan(width) // still portrait
    // Everything except the outermost pixel ring is card.
    for (let y = 2; y < height - 2; y += 5) {
      for (let x = 2; x < width - 2; x += 5) expect(gray(flat, x, y)).toBeGreaterThan(200)
    }
  })
})

describe('findCardCorners', () => {
  it('finds the corners of a tilted card', () => {
    const corners = findCardCorners(tiltedPhoto())
    corners.forEach((c, i) => {
      expect(Math.abs(c.x * 300 - TILTED[i].x)).toBeLessThan(4)
      expect(Math.abs(c.y * 300 - TILTED[i].y)).toBeLessThan(4)
    })
  })

  it('falls back to an inset frame when there is no card', () => {
    const corners = findCardCorners(image(100, 100, () => 128))
    expect(corners[0].x).toBeCloseTo(0.03)
    expect(corners[2].y).toBeCloseTo(0.97)
  })
})

describe('rotation', () => {
  it('turns the photo a quarter clockwise', () => {
    // 3 wide × 2 tall; the top-left pixel is marked.
    const img = image(3, 2, (x, y) => (x === 0 && y === 0 ? 255 : 0))
    const turned = rotateQuarter(img)
    expect([turned.width, turned.height]).toEqual([2, 3])
    expect(gray(turned, 1, 0)).toBe(255) // top-left goes to top-right
  })

  it('keeps the corners in top-left, top-right, bottom-right, bottom-left order', () => {
    expect(rotateQuad(FULL_FRAME)).toEqual(FULL_FRAME)
  })
})

describe('inpaint', () => {
  it('fills a glare spot on a flat area with the surrounding colour', () => {
    const img = image(40, 40, (x, y) => (x >= 15 && x < 25 && y >= 15 && y < 25 ? 255 : 90))
    const mask = new Uint8Array(40 * 40)
    for (let y = 13; y < 27; y++) for (let x = 13; x < 27; x++) mask[y * 40 + x] = 1
    const out = inpaint(img, mask)
    for (let y = 13; y < 27; y++) for (let x = 13; x < 27; x++) expect(gray(out, x, y)).toBeCloseTo(90, 0)
  })

  it('follows a gradient across the spot', () => {
    const img = image(40, 20, (x) => x * 5)
    const mask = new Uint8Array(40 * 20)
    for (let y = 6; y < 14; y++) for (let x = 16; x < 24; x++) mask[y * 40 + x] = 1
    const out = inpaint(img, mask)
    expect(Math.abs(gray(out, 20, 10) - 100)).toBeLessThan(12)
  })

  it('takes in the soft fringe around a glare spot painted only at its core', () => {
    // 200×200 at gray 90, with glare fading from 255 at the centre to nothing at a radius of 9.
    const img = image(200, 200, (x, y) => {
      const d = Math.hypot(x - 100, y - 100)
      return d < 5 ? 255 : d < 9 ? 90 + (255 - 90) * ((9 - d) / 4) : 90
    })
    const mask = new Uint8Array(200 * 200)
    for (let y = 94; y < 106; y++) for (let x = 94; x < 106; x++) mask[y * 200 + x] = 1
    const out = fillGlare(img, mask)
    for (const [x, y] of [[100, 100], [108, 100], [100, 92]]) expect(Math.abs(gray(out, x, y) - 90)).toBeLessThan(6)
  })

  it('leaves pixels outside the mask alone', () => {
    const img = image(10, 10, (x, y) => x * 10 + y)
    const mask = new Uint8Array(100)
    mask[55] = 1
    const out = inpaint(img, mask)
    expect(gray(out, 0, 0)).toBe(0)
    expect(gray(out, 9, 9)).toBe(99)
  })
})
