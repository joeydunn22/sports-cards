import { borderMean, dilate, otsuThreshold, toGray, type Pixels } from './cardDetect'

/**
 * Touch-up for a saved card photo, all in the browser: flattening a crooked card into an upright
 * rectangle (perspective correction from four corners) and filling glare spots from the pixels around
 * them. Pure logic on raw RGBA pixels so it can be unit tested; photos.ts moves pixels to and from canvases.
 */

export type Point = { x: number; y: number }
/** Card corners in normalized coordinates (0..1): top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point]
/** 3×3 projective transform, row-major, with the last entry fixed at 1 (so 8 numbers). */
export type Homography = number[]

export const FULL_FRAME: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

/** Corners are suggested this far in from the edges when no card can be found. */
const FALLBACK_INSET = 0.03
/** A found card must cover at least this share of the photo, or the suggestion is a guess. */
const MIN_CARD_SHARE = 0.25
/** Each round of smoothing after a fill softens the seams between the filled rings. */
const SMOOTHING_PASSES = 4
/** How far past the painted area a glare fill reaches, as a share of the photo's long edge. */
const GLARE_MARGIN = 0.015

/** The transform that maps each `src` point onto the matching `dst` point. */
export function homography(src: Point[], dst: Point[]): Homography {
  const a: number[][] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]
    const { x: u, y: v } = dst[i]
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  return solve(a)
}

export function applyHomography(h: Homography, { x, y }: Point): Point {
  const w = h[6] * x + h[7] * y + 1
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w }
}

/** Gaussian elimination with partial pivoting on an augmented n×(n+1) matrix. */
function solve(a: number[][]): number[] {
  const n = a.length
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r
    if (Math.abs(a[pivot][col]) < 1e-12) throw new Error('Those corners don’t make a card shape.')
    ;[a[col], a[pivot]] = [a[pivot], a[col]]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = a[r][col] / a[col][col]
      for (let c = col; c <= n; c++) a[r][c] -= f * a[col][c]
    }
  }
  return a.map((row, i) => row[n] / row[i])
}

/** Size of the flattened card: the average of opposite edges, capped at `maxEdge` on the long side. */
export function outputSize(quad: Quad, width: number, height: number, maxEdge: number) {
  const dist = (p: Point, q: Point) => Math.hypot((p.x - q.x) * width, (p.y - q.y) * height)
  const [tl, tr, br, bl] = quad
  const w = (dist(tl, tr) + dist(bl, br)) / 2
  const h = (dist(tl, bl) + dist(tr, br)) / 2
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

/** Flattens the part of the photo inside `quad` into an upright `outW` × `outH` image. */
export function warpPerspective(src: Pixels, quad: Quad, outW: number, outH: number): Pixels {
  const h = homography(FULL_FRAME, quad)
  const data = new Uint8ClampedArray(outW * outH * 4)
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const p = applyHomography(h, { x: (x + 0.5) / outW, y: (y + 0.5) / outH })
      sample(src, p.x * src.width - 0.5, p.y * src.height - 0.5, data, (y * outW + x) * 4)
    }
  }
  return { width: outW, height: outH, data }
}

/** Bilinear sample at a fractional pixel position, clamped to the image. */
function sample({ data, width, height }: Pixels, fx: number, fy: number, out: Uint8ClampedArray, o: number) {
  const x = Math.min(Math.max(fx, 0), width - 1)
  const y = Math.min(Math.max(fy, 0), height - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, width - 1)
  const y1 = Math.min(y0 + 1, height - 1)
  const dx = x - x0
  const dy = y - y0
  const p00 = (y0 * width + x0) * 4
  const p10 = (y0 * width + x1) * 4
  const p01 = (y1 * width + x0) * 4
  const p11 = (y1 * width + x1) * 4
  for (let c = 0; c < 4; c++) {
    const top = data[p00 + c] * (1 - dx) + data[p10 + c] * dx
    const bottom = data[p01 + c] * (1 - dx) + data[p11 + c] * dx
    out[o + c] = top * (1 - dy) + bottom * dy
  }
}

/**
 * Suggests the corners of the card in a one-card photo: the largest card-coloured region, and its
 * extreme points along the diagonals. The user nudges them; inside a toploader it may find the toploader.
 */
export function findCardCorners(pixels: Pixels): Quad {
  const { width, height } = pixels
  const gray = toGray(pixels)
  const threshold = otsuThreshold(gray)
  const foregroundIsBright = borderMean(gray, width, height) <= threshold
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < gray.length; i++) mask[i] = gray[i] > threshold === foregroundIsBright ? 1 : 0

  // Close gaps from dark artwork. A square dilation moves each diagonal extreme by exactly (±r, ±r),
  // so that is taken back off the corners below.
  const r = Math.max(1, Math.round(Math.min(width, height) * 0.01))
  const region = largestRegion(dilate(mask, width, height, r), width, height)
  if (!region || region.count < MIN_CARD_SHARE * width * height) return insetQuad(FALLBACK_INSET)

  const point = (x: number, y: number): Point => ({
    x: Math.min(Math.max((x + 0.5) / width, 0), 1),
    y: Math.min(Math.max((y + 0.5) / height, 0), 1),
  })
  const { tl, tr, br, bl } = region
  return [point(tl.x + r, tl.y + r), point(tr.x - r, tr.y + r), point(br.x - r, br.y - r), point(bl.x + r, bl.y - r)]
}

export function insetQuad(inset: number): Quad {
  return [
    { x: inset, y: inset },
    { x: 1 - inset, y: inset },
    { x: 1 - inset, y: 1 - inset },
    { x: inset, y: 1 - inset },
  ]
}

type Region = { count: number; tl: Point; tr: Point; br: Point; bl: Point }

/** The biggest 4-connected region, with its extreme pixels along x+y and x−y. */
function largestRegion(mask: Uint8Array, width: number, height: number): Region | null {
  const seen = new Uint8Array(mask.length)
  const stack: number[] = []
  let best: Region | null = null
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    const region: Region = { count: 0, tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } }
    let minSum = Infinity
    let maxSum = -Infinity
    let minDiff = Infinity
    let maxDiff = -Infinity
    seen[start] = 1
    stack.push(start)
    while (stack.length) {
      const i = stack.pop()!
      const x = i % width
      const y = (i - x) / width
      region.count++
      if (x + y < minSum) [minSum, region.tl] = [x + y, { x, y }]
      if (x + y > maxSum) [maxSum, region.br] = [x + y, { x, y }]
      if (x - y > maxDiff) [maxDiff, region.tr] = [x - y, { x, y }]
      if (x - y < minDiff) [minDiff, region.bl] = [x - y, { x, y }]
      const neighbors = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1]
      for (const n of neighbors) {
        if (n >= 0 && mask[n] && !seen[n]) {
          seen[n] = 1
          stack.push(n)
        }
      }
    }
    if (!best || region.count > best.count) best = region
  }
  return best
}

/** Turns the photo a quarter turn clockwise. */
export function rotateQuarter({ width, height, data }: Pixels): Pixels {
  const out = new Uint8ClampedArray(data.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4
      const to = (x * height + (height - 1 - y)) * 4
      for (let c = 0; c < 4; c++) out[to + c] = data[from + c]
    }
  }
  return { width: height, height: width, data: out }
}

/** The same corners after a quarter turn clockwise (the old bottom-left becomes the top-left). */
export function rotateQuad([tl, tr, br, bl]: Quad): Quad {
  const turn = ({ x, y }: Point): Point => ({ x: 1 - y, y: x })
  return [turn(bl), turn(tl), turn(tr), turn(br)]
}

/**
 * Fills a painted glare spot. Glare fades out softly, and people paint over the bright core, so the
 * painted area is first grown by a small margin to take in the fringe; otherwise the fill blends from it.
 */
export function fillGlare(pixels: Pixels, painted: Uint8Array): Pixels {
  const { width, height } = pixels
  const margin = Math.max(1, Math.round(Math.max(width, height) * GLARE_MARGIN))
  return inpaint(pixels, dilate(painted, width, height, margin))
}

/**
 * Fills the masked pixels from their surroundings: ring by ring from the edge of the mask inward, each
 * pixel takes the average of its already-known neighbours, then a few smoothing passes hide the rings.
 * Good for glare on borders and plain areas; detail under the mask is invented, not recovered.
 */
export function inpaint(pixels: Pixels, mask: Uint8Array): Pixels {
  const { width, height } = pixels
  const data = new Uint8ClampedArray(pixels.data)
  const unknown = new Uint8Array(mask)
  const bounds = maskBounds(mask, width, height)
  if (!bounds) return { width, height, data }
  const { x0, y0, x1, y1 } = bounds
  const filled: number[] = []

  for (;;) {
    const ring: number[] = []
    const values: number[] = []
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * width + x
        if (!unknown[i]) continue
        const avg = neighbourAverage(data, unknown, width, height, x, y)
        if (!avg) continue
        ring.push(i)
        values.push(...avg)
      }
    }
    if (ring.length === 0) break // everything filled, or nothing known to fill from
    ring.forEach((i, k) => {
      for (let c = 0; c < 3; c++) data[i * 4 + c] = values[k * 3 + c]
      unknown[i] = 0
      filled.push(i)
    })
  }

  for (let pass = 0; pass < SMOOTHING_PASSES; pass++) {
    const smoothed = filled.map((i) => neighbourAverage(data, null, width, height, i % width, Math.floor(i / width))!)
    filled.forEach((i, k) => {
      for (let c = 0; c < 3; c++) data[i * 4 + c] = smoothed[k][c]
    })
  }
  return { width, height, data }
}

/** Average colour of the 8 neighbours that aren't `unknown` (diagonals count a little less). */
function neighbourAverage(
  data: Uint8ClampedArray,
  unknown: Uint8Array | null,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number] | null {
  let r = 0
  let g = 0
  let b = 0
  let weight = 0
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const n = ny * width + nx
      if (unknown?.[n]) continue
      const w = dx && dy ? 0.7 : 1
      r += data[n * 4] * w
      g += data[n * 4 + 1] * w
      b += data[n * 4 + 2] * w
      weight += w
    }
  }
  return weight ? [r / weight, g / weight, b / weight] : null
}

function maskBounds(mask: Uint8Array, width: number, height: number) {
  let x0 = width
  let y0 = height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 }
}
