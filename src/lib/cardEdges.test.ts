import { describe, expect, it } from 'vitest'
import type { Pixels } from './cardDetect'
import { findCardEdges } from './cardEdges'
import type { Point, Quad } from './photoEdit'

type Colour = [number, number, number]

function rgb(width: number, height: number, colour: (x: number, y: number) => Colour): Pixels {
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

/** Repeatable carpet-like texture: blotches a few pixels across, brown, with plenty of contrast. */
function carpet(x: number, y: number): Colour {
  const cell = (cx: number, cy: number) => {
    const s = Math.sin(cx * 127.1 + cy * 311.7) * 43758.5453
    return s - Math.floor(s)
  }
  const v = cell(Math.floor(x / 3), Math.floor(y / 3)) * 0.6 + cell(Math.floor(x / 7), Math.floor(y / 7)) * 0.4
  const level = 70 + v * 90
  return [level, level * 0.85, level * 0.7]
}

/** A rectangle turned by `deg` about (cx, cy), corners clockwise from top-left. */
function turned(cx: number, cy: number, w: number, h: number, deg: number): Point[] {
  const a = (deg * Math.PI) / 180
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => ({ x: cx + x * Math.cos(a) - y * Math.sin(a), y: cy + x * Math.sin(a) + y * Math.cos(a) }))
}

function inside(quad: Point[], x: number, y: number) {
  return quad.every((a, i) => {
    const b = quad[(i + 1) % 4]
    return (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) >= 0
  })
}

/** Largest distance from a found corner (normalized) to the expected one (pixels). */
function cornerError(found: Quad | null, expected: Point[], width: number, height: number) {
  if (!found) return Infinity
  return Math.max(...found.map((p, i) => Math.hypot(p.x * width - expected[i].x, p.y * height - expected[i].y)))
}

const TEAL: Colour = [40, 170, 160]
const PLASTIC: Colour = [125, 125, 128]

describe('findCardEdges', () => {
  it('finds a tilted card on carpet', () => {
    const card = turned(200, 260, 250, 350, 4)
    const photo = rgb(400, 560, (x, y) => (inside(card, x, y) ? [200, 60, 50] : carpet(x, y)))
    expect(cornerError(findCardEdges(photo), card, 400, 560)).toBeLessThan(4)
  })

  it('takes the toploader around the card, not the card or a frame printed inside it', () => {
    const toploader = turned(210, 280, 296, 400, 0) // 0.74, a toploader as photographed
    const card = turned(210, 285, 250, 350, 0)
    const frame = turned(210, 285, 210, 294, 0) // a frame line printed inside the card, card-shaped too
    const onFrame = (x: number, y: number) => inside(frame, x, y) && !inside(turned(210, 285, 204, 288, 0), x, y)
    const photo = rgb(420, 560, (x, y) =>
      onFrame(x, y) ? [20, 20, 20] : inside(card, x, y) ? [215, 210, 200] : inside(toploader, x, y) ? PLASTIC : carpet(x, y),
    )
    expect(cornerError(findCardEdges(photo), toploader, 420, 560)).toBeLessThan(4)
  })

  it('sees a card that differs from the plastic in colour but not brightness', () => {
    const card = turned(200, 270, 250, 350, -3)
    const photo = rgb(400, 560, (x, y) => (inside(card, x, y) ? TEAL : PLASTIC))
    expect(cornerError(findCardEdges(photo), card, 400, 560)).toBeLessThan(4)
  })

  it('finds nothing in carpet alone', () => {
    expect(findCardEdges(rgb(400, 560, carpet))).toBeNull()
  })

  it('finds nothing when the card runs off the photo', () => {
    const card = turned(200, 420, 250, 350, 0) // bottom edge past the photo
    const photo = rgb(400, 560, (x, y) => (inside(card, x, y) ? [200, 60, 50] : carpet(x, y)))
    expect(findCardEdges(photo)).toBeNull()
  })

  it('finds nothing when the only rectangle is not card-shaped', () => {
    const square = turned(200, 280, 300, 300, 0)
    const photo = rgb(400, 560, (x, y) => (inside(square, x, y) ? [200, 60, 50] : carpet(x, y)))
    expect(findCardEdges(photo)).toBeNull()
  })
})
