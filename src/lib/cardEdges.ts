import type { Pixels } from './cardDetect'
import type { Point, Quad } from './photoEdit'

/**
 * Finds a card in a photo by its four straight edges. Carpet, tables and the plastic of a toploader have
 * plenty of texture but no long straight lines; a card's edges do, so this works where telling card from
 * background by brightness can't. Steps: an edge map, the longest unbroken straight edges running roughly
 * up and across, then the four that close a card-shaped rectangle with an edge along nearly all of every side.
 * Returns null unless that rectangle is found for sure.
 */

/** Edges are found on a copy this size: enough to place them within a pixel or two of the stored photo. */
export const EDGE_MAX = 600
/** Card edges are looked for this far off upright, in degrees. */
const MAX_TILT = 10
const TILT_STEP = 0.25
/** Smallest brightness change (Sobel, on the smoothed copy) that counts as an edge: a step of about 8 levels. */
const EDGE_LEVEL = 14
/** Rounds of smoothing before edges are found: enough to wash out carpet and plastic texture. */
const BLUR_PASSES = 3
/** Along a line, each step without an edge costs this many steps with one, so texture can't add up. */
const MISS_COST = 2
/** Longest lines kept each way; the rectangle is chosen among them. */
const CANDIDATES = 30
/** Lines closer than this (pixels at both ends) are the same edge. */
const SAME_LINE = 6
/** Share of each side the edge must run along. */
const MIN_COVERAGE = 0.7
/** Standard cards are 2.5 × 3.5 in; a little more or less allows for the camera angle. Toploaders are 0.75. */
export const CARD_RATIO = 63.5 / 88.9
const RATIO_TOLERANCE = 0.035
/** The card must fill at least this share of the photo. */
const MIN_SHARE = 0.1

/**
 * Edge pixels for edges running up and down (`up`) and across (`across`), each widened by a pixel either side
 * across the edge so a straight line a pixel off still runs along it.
 */
type Edges = { up: Uint8Array; across: Uint8Array; width: number; height: number }
/** A straight line: `vertical` lines are x = a + b·(y − h/2), others y = a + b·(x − w/2), in pixels. */
type Line = { vertical: boolean; a: number; b: number; score: number }

/**
 * The card's corners (normalized, clockwise from top-left), or null. Of all the card-shaped rectangles with
 * an edge along every side, the largest: the toploader or the card itself, never a frame printed inside it.
 */
export function findCardEdges(pixels: Pixels): Quad | null {
  const edges = edgeMap(pixels)
  const { width, height } = edges
  const vertical = lineCandidates(edges, true)
  const across = lineCandidates(edges, false)
  let best: { quad: Point[]; area: number } | null = null

  for (const left of vertical) {
    for (const right of vertical) {
      if (left.a >= right.a) continue
      for (const top of across) {
        for (const bottom of across) {
          if (top.a >= bottom.a) continue
          const quad = [meet(left, top, edges), meet(right, top, edges), meet(right, bottom, edges), meet(left, bottom, edges)]
          if (!quad.every((p) => p.x >= -1 && p.y >= -1 && p.x <= width && p.y <= height)) continue
          const area = polygonArea(quad) / (width * height)
          if (area < MIN_SHARE || (best && area <= best.area)) continue
          if (Math.abs(shapeRatio(quad) - CARD_RATIO) > RATIO_TOLERANCE) continue
          const sides: [Point, Point, boolean][] = [
            [quad[0], quad[1], false],
            [quad[1], quad[2], true],
            [quad[3], quad[2], false],
            [quad[0], quad[3], true],
          ]
          if (sides.every(([p, q, v]) => sideCoverage(edges, p, q, v) >= MIN_COVERAGE)) best = { quad, area }
        }
      }
    }
  }
  return best && (best.quad.map((p) => ({ x: p.x / width, y: p.y / height })) as Quad)
}

/**
 * Edge pixels: where the smoothed colour changes clearly, mostly in one direction, and most there (a ridge
 * across the edge). Colour, not just brightness: a teal card on grey plastic is about as bright as the plastic.
 */
function edgeMap(pixels: Pixels): Edges {
  const { width, height, data } = pixels
  const gx = new Float32Array(width * height)
  const gy = new Float32Array(width * height)
  for (let c = 0; c < 3; c++) {
    let channel: Float32Array = new Float32Array(width * height)
    for (let i = 0; i < channel.length; i++) channel[i] = data[i * 4 + c]
    for (let pass = 0; pass < BLUR_PASSES; pass++) channel = boxBlur(channel, width, height)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x
        const nw = channel[i - width - 1]
        const ne = channel[i - width + 1]
        const sw = channel[i + width - 1]
        const se = channel[i + width + 1]
        const dx = Math.abs(ne + 2 * channel[i + 1] + se - nw - 2 * channel[i - 1] - sw)
        const dy = Math.abs(sw + 2 * channel[i + width] + se - nw - 2 * channel[i - width] - ne)
        if (dx > gx[i]) gx[i] = dx
        if (dy > gy[i]) gy[i] = dy
      }
    }
  }
  const up = new Uint8Array(width * height)
  const across = new Uint8Array(width * height)
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const i = y * width + x
      if (gx[i] >= EDGE_LEVEL && gx[i] >= 2 * gy[i] && gx[i] >= gx[i - 1] && gx[i] >= gx[i + 1]) {
        up[i - 1] = up[i] = up[i + 1] = 1
      }
      if (gy[i] >= EDGE_LEVEL && gy[i] >= 2 * gx[i] && gy[i] >= gy[i - width] && gy[i] >= gy[i + width]) {
        across[i - width] = across[i] = across[i + width] = 1
      }
    }
  }
  return { up, across, width, height }
}

/** 3×3 average, done as a pass across and a pass down. */
function boxBlur(src: Float32Array, width: number, height: number): Float32Array {
  const mid = new Float32Array(src.length)
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      const l = x > 0 ? src[row + x - 1] : src[row + x]
      const r = x < width - 1 ? src[row + x + 1] : src[row + x]
      mid[row + x] = (l + src[row + x] + r) / 3
    }
  }
  const out = new Float32Array(src.length)
  for (let y = 0; y < height; y++) {
    const up = y > 0 ? -width : 0
    const down = y < height - 1 ? width : 0
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      out[i] = (mid[i + up] + mid[i] + mid[i + down]) / 3
    }
  }
  return out
}

/** Is there an edge pixel (widened) at (u, v): u across the line, v along it? */
function hit({ up, across, width, height }: Edges, vertical: boolean, u: number, v: number): boolean {
  if (vertical) return v >= 0 && v < height && u >= 0 && u < width && up[v * width + u] === 1
  return v >= 0 && v < width && u >= 0 && u < height && across[u * width + v] === 1
}

/**
 * The longest straight edges running one way. A line's score is its best stretch of edge pixels, with each
 * gap costing more than a hit gains: a real edge runs on almost unbroken, while texture breaks up at once.
 */
function lineCandidates({ up, across, width, height }: Edges, vertical: boolean): Line[] {
  const map = vertical ? up : across
  const along = vertical ? height : width
  const span = vertical ? width : height
  // Step along the line: one row down (vertical) or one column across; across the line: one column or row.
  const stepAlong = vertical ? width : 1
  const stepAcross = vertical ? 1 : width
  const center = along / 2
  const lines: Line[] = []
  for (let deg = -MAX_TILT; deg <= MAX_TILT + 1e-9; deg += TILT_STEP) {
    const b = Math.tan((deg * Math.PI) / 180)
    for (let a = 1; a < span - 1; a++) {
      let run = 0
      let best = 0
      for (let v = 0; v < along; v++) {
        const u = Math.round(a + b * (v - center))
        const on = u >= 0 && u < span && map[v * stepAlong + u * stepAcross] === 1
        run = on ? run + 1 : run > MISS_COST ? run - MISS_COST : 0
        if (run > best) best = run
      }
      if (best > 0) lines.push({ vertical, a, b, score: best })
    }
  }
  lines.sort((p, q) => q.score - p.score)
  const kept: Line[] = []
  const end = (l: Line, v: number) => l.a + l.b * (v - center)
  for (const line of lines) {
    if (kept.length === CANDIDATES) break
    const same = kept.some(
      (k) => Math.abs(end(k, 0) - end(line, 0)) < SAME_LINE && Math.abs(end(k, along) - end(line, along)) < SAME_LINE,
    )
    if (!same) kept.push(line)
  }
  return kept
}

/** Where a vertical line crosses a horizontal one. */
function meet(v: Line, h: Line, { width, height }: Edges): Point {
  const cx = width / 2
  const cy = height / 2
  const x = (v.a + v.b * (h.a - h.b * cx - cy)) / (1 - v.b * h.b)
  return { x, y: h.a + h.b * (x - cx) }
}

function polygonArea(pts: Point[]): number {
  return Math.abs(pts.reduce((sum, a, i) => sum + a.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * a.y, 0)) / 2
}

/** Short side over long side, either way up. */
function shapeRatio([tl, tr, br, bl]: Point[]): number {
  const d = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y)
  const w = (d(tl, tr) + d(bl, br)) / 2
  const h = (d(tl, bl) + d(tr, br)) / 2
  return Math.min(w, h) / Math.max(w, h)
}

/** Share of a side, from corner to corner (the last 4% each end skipped), that runs along an edge. */
function sideCoverage(edges: Edges, p: Point, q: Point, vertical: boolean): number {
  const length = Math.hypot(q.x - p.x, q.y - p.y)
  const n = Math.max(10, Math.round(length))
  let hits = 0
  for (let k = 0; k < n; k++) {
    const t = 0.04 + (0.92 * k) / (n - 1)
    const x = Math.round(p.x + t * (q.x - p.x))
    const y = Math.round(p.y + t * (q.y - p.y))
    if (vertical ? hit(edges, true, x, y) : hit(edges, false, y, x)) hits++
  }
  return hits / n
}
