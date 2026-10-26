import { describe, expect, it } from 'vitest'
import type { Pixels } from './cardDetect'
import {
  applyHomography,
  autoStraighten,
  autoTouchUp,
  downscale,
  fillGlare,
  findGlare,
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

/** Colour photo: each pixel's [r, g, b] comes from `colour(x, y)`. */
function rgb(width: number, height: number, colour: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4
      ;[data[p], data[p + 1], data[p + 2]] = colour(x, y)
      data[p + 3] = 255
    }
  }
  return { width, height, data }
}

const RED: [number, number, number] = [180, 30, 30]
const DARK: [number, number, number] = [25, 25, 30]

/** Red card with a soft glare spot: blown out within `core`, fading back to red by `core + fade`. */
function glareOnRed(cx: number, cy: number, core = 15, fade = 10) {
  return rgb(300, 400, (x, y) => {
    const d = Math.hypot(x - cx, y - cy)
    const t = d < core ? 1 : d < core + fade ? (core + fade - d) / fade : 0
    return RED.map((v) => Math.round(v + (255 - v) * t)) as [number, number, number]
  })
}

describe('downscale', () => {
  it('shrinks to the long edge and keeps the shape', () => {
    const small = downscale(image(800, 1100, () => 50), 400)
    expect([small.width, small.height]).toEqual([291, 400])
    expect(downscale(image(100, 100, () => 50), 400).width).toBe(100)
  })
})

describe('autoStraighten', () => {
  it('flattens a tilted card cut out with a margin, leaving only a sliver of background', () => {
    const corners: Point[] = [
      { x: 20, y: 10 },
      { x: 185, y: 25 },
      { x: 175, y: 250 },
      { x: 10, y: 235 },
    ]
    const photo = image(200, 260, (x, y) => (inside(corners, x + 0.5, y + 0.5) ? 220 : 20))
    const flat = autoStraighten(photo, 1600)!
    expect(flat).not.toBeNull()
    // The safety margin keeps a pixel or two of background round the edge; everything inside is card.
    for (let y = 6; y < flat.height - 6; y += 7) {
      for (let x = 6; x < flat.width - 6; x += 7) expect(gray(flat, x, y)).toBeGreaterThan(200)
    }
  })

  it('leaves a photo that is already straight and tight alone', () => {
    const photo = image(200, 280, (x, y) => (x >= 2 && x < 198 && y >= 2 && y < 278 ? 220 : 20))
    expect(autoStraighten(photo, 1600)).toBeNull()
  })

  it('leaves a photo with no clear card alone', () => {
    expect(autoStraighten(image(200, 280, () => 128), 1600)).toBeNull()
  })
})

describe('findGlare', () => {
  it('finds a soft glare spot, and autoTouchUp fills it', () => {
    const photo = glareOnRed(150, 180)
    expect(findGlare(photo)?.[180 * 300 + 150]).toBe(1)
    const { pixels, changes } = autoTouchUp(photo, { straighten: false, maxEdge: 1600 })
    expect(changes).toEqual(['glare'])
    const p = (180 * 300 + 150) * 4
    expect(pixels.data[p + 1]).toBeLessThan(60) // green back near the red card's 30, not white
  })

  it('leaves thin white letters alone', () => {
    const letters = rgb(300, 400, (x, y) => (y >= 100 && y < 140 && x >= 60 && x < 240 && x % 12 < 3 ? [255, 255, 255] : DARK))
    expect(findGlare(letters)).toBeNull()
  })

  it('leaves a hard-edged white logo alone', () => {
    const logo = rgb(300, 400, (x, y) => (x >= 130 && x < 160 && y >= 180 && y < 210 ? [255, 255, 255] : DARK))
    expect(findGlare(logo)).toBeNull()
  })

  it('gives up on an overexposed or white card', () => {
    expect(findGlare(rgb(300, 400, () => [252, 252, 252]))).toBeNull()
  })

  it('leaves a spot on the edge (the card border) alone', () => {
    expect(findGlare(glareOnRed(3, 180))).toBeNull()
  })

  it('leaves a glare spot on busy artwork alone, since a fill would smear it', () => {
    // The same soft spot as above, over fine red and dark stripes (like print or a face).
    const busy = rgb(300, 400, (x, y) => {
      const d = Math.hypot(x - 150, y - 180)
      const t = d < 15 ? 1 : d < 25 ? (25 - d) / 10 : 0
      const base = x % 8 < 4 ? RED : DARK
      return base.map((v) => Math.round(v + (255 - v) * t)) as [number, number, number]
    })
    expect(findGlare(busy)).toBeNull()
  })

  it('reports no changes when there is nothing to do', () => {
    const plain = rgb(300, 400, () => RED)
    expect(autoTouchUp(plain, { straighten: true, maxEdge: 1600 }).changes).toEqual([])
  })
})

describe('auto touch-up on real-world layouts', () => {
  it('finds glare on a card with a bright white border', () => {
    // White border (blown out too) around red artwork, with a soft glare spot on the artwork.
    const spot = glareOnRed(150, 180)
    const card = rgb(300, 400, (x, y) => {
      if (x < 20 || y < 20 || x >= 280 || y >= 380) return [250, 250, 250]
      const p = (y * 300 + x) * 4
      return [spot.data[p], spot.data[p + 1], spot.data[p + 2]]
    })
    expect(findGlare(card)?.[180 * 300 + 150]).toBe(1)
  })

  it('straightens a steeply tilted card in a wide capture cut', () => {
    // A 9° card, cut out with generous margins: the card is only about 48% of the cut.
    const angle = (9 * Math.PI) / 180
    const turn = (x: number, y: number): Point => ({
      x: 380 + x * Math.cos(angle) - y * Math.sin(angle),
      y: 480 + x * Math.sin(angle) + y * Math.cos(angle),
    })
    const corners = [turn(-250, -350), turn(250, -350), turn(250, 350), turn(-250, 350)]
    const cut = image(760, 960, (x, y) => (inside(corners, x + 0.5, y + 0.5) ? 220 : 20))
    const flat = autoStraighten(cut, 1600)!
    expect(flat.width / flat.height).toBeCloseTo(500 / 700, 1)
  })
})

describe('findCardCorners with dark artwork', () => {
  it('finds the card by its light border when the artwork is as dark as the background', () => {
    // Light border ring, artwork nearly as dark as the table: only the ring stands out.
    const frame = (x: number, y: number) => x >= 30 && x < 270 && y >= 25 && y < 365
    const art = (x: number, y: number) => x >= 45 && x < 255 && y >= 40 && y < 350
    const corners = findCardCorners(image(300, 390, (x, y) => (art(x, y) ? 35 : frame(x, y) ? 235 : 20)))
    expect(corners[0].x * 300).toBeCloseTo(30, -1)
    expect(corners[2].y * 390).toBeCloseTo(365, -1)
  })
})

describe('glare with a wide fade', () => {
  it('fills the haze around the blown-out core too', () => {
    const photo = glareOnRed(150, 200, 12, 36)
    const { pixels } = autoTouchUp(photo, { straighten: false, maxEdge: 1600 })
    // 30 px out, the glare had lifted green from 30 to about 100; after the fill it is back near the card.
    const p = (200 * 300 + 180) * 4
    expect(photo.data[p + 1]).toBeGreaterThan(90)
    expect(pixels.data[p + 1]).toBeLessThan(55)
  })
})

describe('glare with a long, shallow fade', () => {
  it('follows the haze until it is nearly gone', () => {
    // Blown out within 10 px, a nearly flat bright plateau (under 1 level per pixel) to 36 px, then down to the card by 50 px.
    const photo = rgb(300, 400, (x, y) => {
      const d = Math.hypot(x - 150, y - 200)
      const t = d < 10 ? 1 : d < 36 ? 1 - (0.15 * (d - 10)) / 26 : d < 50 ? (0.85 * (50 - d)) / 14 : 0
      return RED.map((v) => Math.round(v + (255 - v) * t)) as [number, number, number]
    })
    const { pixels } = autoTouchUp(photo, { straighten: false, maxEdge: 1600 })
    const p = (200 * 300 + 175) * 4 // 25 px out
    expect(photo.data[p + 1]).toBeGreaterThan(180)
    expect(pixels.data[p + 1]).toBeLessThan(80)
  })
})
