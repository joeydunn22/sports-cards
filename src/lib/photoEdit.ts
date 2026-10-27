import { borderMean, dilate, otsuThreshold, toGray, type Pixels } from './cardDetect'
import { EDGE_MAX, findCardEdges } from './cardEdges'
import { autoLight } from './photoLight'

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
 * Suggests the corners of the card in a one-card photo for the user to nudge: its straight edges when they
 * are found for sure (the toploader's, if it's in one), else the largest card-coloured region, else an inset frame.
 */
export function findCardCorners(pixels: Pixels): Quad {
  return (
    findCardEdges(downscale(pixels, EDGE_MAX))?.quad ?? detectCardCorners(downscale(pixels, DETECT_MAX_EDGE)) ?? insetQuad(FALLBACK_INSET)
  )
}

/** The card's corners, or null when no card-sized region stands out from the background. */
export function detectCardCorners(pixels: Pixels): Quad | null {
  const { width, height } = pixels
  const gray = toGray(pixels)
  const threshold = otsuThreshold(gray)
  const foregroundIsBright = borderMean(gray, width, height) <= threshold
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < gray.length; i++) mask[i] = gray[i] > threshold === foregroundIsBright ? 1 : 0

  // Close gaps from dark artwork. A square dilation moves each diagonal extreme by exactly (±r, ±r),
  // so that is taken back off the corners below.
  const r = Math.max(1, Math.round(Math.min(width, height) * 0.01))
  const region = outerRegion(dilate(mask, width, height, r), width, height)
  if (!region || region.area < MIN_CARD_SHARE * width * height) return null

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

type Region = { area: number; tl: Point; tr: Point; br: Point; bl: Point }

/**
 * The 4-connected region whose corners (extreme pixels along x+y and x−y) enclose the most area. Judged by
 * enclosed area, not pixel count, so a card whose dark artwork reads as background still counts by its border.
 */
function outerRegion(mask: Uint8Array, width: number, height: number): Region | null {
  const seen = new Uint8Array(mask.length)
  const stack: number[] = []
  let best: Region | null = null
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    const region: Region = { area: 0, tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } }
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
    region.area = quadArea([region.tl, region.tr, region.br, region.bl])
    if (!best || region.area > best.area) best = region
  }
  return best
}

/** Area enclosed by four points in order (shoelace formula). */
function quadArea(pts: Point[]): number {
  return Math.abs(pts.reduce((sum, a, i) => sum + a.x * pts[(i + 1) % 4].y - pts[(i + 1) % 4].x * a.y, 0)) / 2
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

// Automatic touch-up: the same tools as the editor, applied only when they are clearly safe. Every result
// still goes through the before/after review on the touch-up page (except straightening at capture).

/** Corner finding works on a small copy; more pixels don't help find four corners. */
const DETECT_MAX_EDGE = 400
/** A trim leaves this much (share of the card's size, each side) around the found edges, so it never clips them. */
const SAFETY_MARGIN = 0.01
/** Corners closer than this to the photo's corners mean it is already straight and tight. */
const STRAIGHT_ENOUGH = 0.02

/** Glare is blown out: all channels near white and nearly gray. */
const CLIPPED_LEVEL = 245
const CLIPPED_TINT = 20
/** More blown-out spots than this in total means an overexposed photo, not glare; it is left alone. */
const MAX_GLARE_TOTAL = 0.08
/** Size of one glare spot, as a share of the photo. */
const MIN_GLARE_SHARE = 0.0002
const MAX_GLARE_SHARE = 0.03
/** A glare spot is compact: its short side (share of the long edge) and how much of its box it fills. */
const MIN_GLARE_SIDE = 0.008
const MIN_GLARE_FILL = 0.35
/** Spots this close to the edge (share of the long edge) are left alone: usually the card's white border. */
const EDGE_BAND = 0.015
/** Glare fades out softly; white print has a hard edge. Minimum brightness of the ring just outside. */
const SOFT_EDGE_LEVEL = 170
/** The fade around a glare spot ends where less than this share of its brightening is left. */
const FADE_LEFT = 0.1
/** How far out the fade is followed at most, as a share of the photo's long edge (keeps it quick). */
const MAX_FADE = 0.08
/**
 * A fill can only look right where the surroundings are plain (a border, sky, a solid jersey): the colour spread
 * (standard deviation of brightness) just outside the glare must stay under this, or the spot is left alone.
 */
const FLAT_SPREAD = 20

export type TouchUpChange = 'straightened' | 'glare' | 'lighting'

export const CHANGE_LABELS: Record<TouchUpChange, string> = {
  straightened: 'Trimmed & straightened',
  glare: 'Glare filled',
  lighting: 'Lighting fixed',
}

/** Nearest-neighbour shrink to at most `maxEdge` on the long side (for detection, not for display). */
export function downscale(pixels: Pixels, maxEdge: number): Pixels {
  const scale = Math.min(1, maxEdge / Math.max(pixels.width, pixels.height))
  if (scale === 1) return pixels
  const width = Math.max(1, Math.round(pixels.width * scale))
  const height = Math.max(1, Math.round(pixels.height * scale))
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const sy = Math.min(pixels.height - 1, Math.floor((y + 0.5) / scale))
    for (let x = 0; x < width; x++) {
      const sx = Math.min(pixels.width - 1, Math.floor((x + 0.5) / scale))
      const from = (sy * pixels.width + sx) * 4
      const to = (y * width + x) * 4
      for (let c = 0; c < 4; c++) data[to + c] = pixels.data[from + c]
    }
  }
  return { width, height, data }
}

/** Does straightening to this quad change anything worth keeping? */
export function needsStraighten(quad: Quad): boolean {
  return quad.some((p, i) => Math.hypot(p.x - FULL_FRAME[i].x, p.y - FULL_FRAME[i].y) >= STRAIGHT_ENOUGH)
}

/**
 * The photo trimmed and flattened to the card (or the toploader around it), or null when its four edges
 * aren't found for sure or the photo is already tight and straight.
 */
export function autoStraighten(pixels: Pixels, maxEdge: number): Pixels | null {
  const found = findCardEdges(downscale(pixels, EDGE_MAX))
  if (!found) return null
  const quad = growQuad(found.quad, SAFETY_MARGIN)
  if (!needsStraighten(quad)) return null
  const size = outputSize(quad, pixels.width, pixels.height, maxEdge)
  return warpPerspective(pixels, quad, size.width, size.height)
}

/** Corners moved out from the middle by `share` of the quad's size each way, kept inside the photo. */
export function growQuad(quad: Quad, share: number): Quad {
  const cx = quad.reduce((s, p) => s + p.x, 0) / 4
  const cy = quad.reduce((s, p) => s + p.y, 0) / 4
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return quad.map((p) => ({ x: clamp(cx + (p.x - cx) * (1 + 2 * share)), y: clamp(cy + (p.y - cy) * (1 + 2 * share)) })) as Quad
}

/** A mask of the clear glare spots in a photo (for `fillGlare`), or null when there are none. Conservative on purpose. */
export function findGlare(pixels: Pixels): Uint8Array | null {
  const { width, height, data } = pixels
  const total = width * height
  const clipped = new Uint8Array(total)
  let count = 0
  for (let i = 0, p = 0; i < total; i++, p += 4) {
    const lo = Math.min(data[p], data[p + 1], data[p + 2])
    const hi = Math.max(data[p], data[p + 1], data[p + 2])
    if (lo >= CLIPPED_LEVEL && hi - lo <= CLIPPED_TINT) {
      clipped[i] = 1
      count++
    }
  }
  if (count === 0) return null

  // Judged spot by spot: a bright white border is one big region touching the edge, and is skipped.
  const long = Math.max(width, height)
  const band = Math.round(long * EDGE_BAND)
  const mask = new Uint8Array(total)
  let cores = 0
  for (const blob of blobs(clipped, width, height)) {
    const { pixels: members, x0, y0, x1, y1 } = blob
    const w = x1 - x0 + 1
    const h = y1 - y0 + 1
    if (members.length < MIN_GLARE_SHARE * total || members.length > MAX_GLARE_SHARE * total) continue
    if (x0 < band || y0 < band || x1 >= width - band || y1 >= height - band) continue
    if (Math.min(w, h) < long * MIN_GLARE_SIDE || members.length / (w * h) < MIN_GLARE_FILL) continue
    if (ringBrightness(pixels, blob) < SOFT_EDGE_LEVEL) continue
    if (!markWithFade(pixels, blob, mask)) continue
    cores += members.length
  }
  return cores && cores <= MAX_GLARE_TOTAL * total ? mask : null
}

type Blob = { pixels: number[]; x0: number; y0: number; x1: number; y1: number }

/** 4-connected regions of a mask, with their pixels and bounding boxes. */
function blobs(mask: Uint8Array, width: number, height: number): Blob[] {
  const seen = new Uint8Array(mask.length)
  const out: Blob[] = []
  const stack: number[] = []
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    const blob: Blob = { pixels: [], x0: width, y0: height, x1: 0, y1: 0 }
    seen[start] = 1
    stack.push(start)
    while (stack.length) {
      const i = stack.pop()!
      const x = i % width
      const y = (i - x) / width
      blob.pixels.push(i)
      if (x < blob.x0) blob.x0 = x
      if (x > blob.x1) blob.x1 = x
      if (y < blob.y0) blob.y0 = y
      if (y > blob.y1) blob.y1 = y
      const neighbors = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1]
      for (const n of neighbors) {
        if (n >= 0 && mask[n] && !seen[n]) {
          seen[n] = 1
          stack.push(n)
        }
      }
    }
    out.push(blob)
  }
  return out
}

/** Average darkest-channel level of the pixels 2–3 steps outside a blob. */
function ringBrightness({ width, height, data }: Pixels, blob: Blob): number {
  const pad = 3
  const lx = Math.max(0, blob.x0 - pad)
  const ly = Math.max(0, blob.y0 - pad)
  const lw = Math.min(width - 1, blob.x1 + pad) - lx + 1
  const lh = Math.min(height - 1, blob.y1 + pad) - ly + 1
  const local = new Uint8Array(lw * lh)
  for (const i of blob.pixels) local[(Math.floor(i / width) - ly) * lw + ((i % width) - lx)] = 1
  const near = dilate(local, lw, lh, 1)
  const far = dilate(local, lw, lh, pad)
  let sum = 0
  let n = 0
  for (let j = 0; j < local.length; j++) {
    if (!far[j] || near[j]) continue
    const p = ((ly + Math.floor(j / lw)) * width + lx + (j % lw)) * 4
    sum += Math.min(data[p], data[p + 1], data[p + 2])
    n++
  }
  return n ? sum / n : 0
}

/**
 * Marks a glare spot plus the soft fade around it. Measures the brightness of each ring outward from the
 * blown-out core (up to twice the spot's size), takes the darkest ring as the card underneath, and marks
 * out to where 90% of the glare's brightening is gone. False (nothing marked) when the surroundings are too
 * busy to fill from.
 */
function markWithFade(pixels: Pixels, blob: Blob, mask: Uint8Array): boolean {
  const { width, height, data } = pixels
  const size = Math.max(blob.x1 - blob.x0, blob.y1 - blob.y0) + 1
  const reach = Math.min(2 * size, Math.round(Math.max(width, height) * MAX_FADE))
  const lx = Math.max(0, blob.x0 - reach)
  const ly = Math.max(0, blob.y0 - reach)
  const lw = Math.min(width - 1, blob.x1 + reach) - lx + 1
  const lh = Math.min(height - 1, blob.y1 + reach) - ly + 1
  const toGlobal = (j: number) => (ly + Math.floor(j / lw)) * width + lx + (j % lw)
  const level = (j: number) => {
    const p = toGlobal(j) * 4
    return Math.min(data[p], data[p + 1], data[p + 2])
  }

  const core = new Uint8Array(lw * lh)
  for (const i of blob.pixels) core[(Math.floor(i / width) - ly) * lw + ((i % width) - lx)] = 1
  const ringMeans: number[] = []
  let inside: Uint8Array = core
  for (let step = 0; step < reach; step++) {
    const grown = dilate(inside, lw, lh, 1)
    let sum = 0
    let n = 0
    for (let j = 0; j < grown.length; j++) {
      if (grown[j] && !inside[j]) {
        sum += level(j)
        n++
      }
    }
    if (n === 0) break
    ringMeans.push(sum / n)
    inside = grown
  }
  // Still clearly getting darker over the last few rings means the fade goes on past the reach: take all of
  // it. (Rings are squares, so their average keeps easing down a little even after the fade has ended.)
  const last = ringMeans.length - 1
  const base = Math.min(...ringMeans)
  const stillFading = last >= 3 && ringMeans[last - 3] - ringMeans[last] > FADE_LEFT * 0.5 * (CLIPPED_LEVEL - base)
  const faded = base + FADE_LEFT * (CLIPPED_LEVEL - base)
  const rings = stillFading ? -1 : ringMeans.findIndex((m) => m <= faded)
  const area = dilate(core, lw, lh, rings === -1 ? ringMeans.length : rings)

  // What the fill borrows from: a busy ring (a face, print, detailed art) would be smeared in, so skip it.
  const around = dilate(area, lw, lh, 3)
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let j = 0; j < around.length; j++) {
    if (!around[j] || area[j]) continue
    const p = toGlobal(j) * 4
    const v = (data[p] + data[p + 1] + data[p + 2]) / 3
    sum += v
    sumSq += v * v
    n++
  }
  if (!n || Math.sqrt(Math.max(0, sumSq / n - (sum / n) ** 2)) > FLAT_SPREAD) return false

  for (let j = 0; j < area.length; j++) if (area[j]) mask[toGlobal(j)] = 1
  return true
}

/**
 * Trims and straightens (unless the photo already is), fills clear glare spots and corrects the lighting;
 * `changes` is empty when nothing applied.
 */
export function autoTouchUp(
  pixels: Pixels,
  { straighten, maxEdge }: { straighten: boolean; maxEdge: number },
): { pixels: Pixels; changes: TouchUpChange[] } {
  const changes: TouchUpChange[] = []
  let out = pixels
  const flat = straighten ? autoStraighten(out, maxEdge) : null
  if (flat) {
    out = flat
    changes.push('straightened')
  }
  const glare = findGlare(out)
  if (glare) {
    out = fillGlare(out, glare)
    changes.push('glare')
  }
  // Last, and measured on the trimmed card, so the carpet round it doesn't count.
  const lit = autoLight(out)
  if (lit) {
    out = lit
    changes.push('lighting')
  }
  return { pixels: out, changes }
}
