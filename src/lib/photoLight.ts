import type { Pixels } from './cardDetect'

/**
 * Lighting correction for a card photo, all in the browser: evening out light that falls off across the
 * card, taking out a lamp's colour cast, and stretching a dim or washed-out photo to a normal range. Every
 * step is a smooth change to the whole photo, so it can't smear detail; each one is measured on the card and
 * capped, and skipped when the photo doesn't need it. Pure logic on raw RGBA pixels, unit tested.
 */

/** The automatic correction for one photo. */
export type LightFix = {
  /** Brightness across the photo as a plane, from the band round its edge: 1 + x·(x − ½) + y·(y − ½). */
  falloff: { x: number; y: number } | null
  /** Per-channel gains that make the card's whites neutral. */
  gains: [number, number, number]
  /** Levels: `low` maps to black-ish, `high` to white-ish, in a straight line (a dark card stays dark). */
  low: number
  high: number
}

/** The manual sliders: brightness, contrast and warmth −100 to 100, sharpness 0 to 100. */
export type LightAdjust = { brightness: number; contrast: number; warmth: number; sharpness: number }
export const NO_ADJUST: LightAdjust = { brightness: 0, contrast: 0, warmth: 0, sharpness: 0 }
/** Full sharpness adds this much of the difference from a slightly blurred copy (an unsharp mask). */
const MAX_SHARPEN = 1.5

/** Measurements use about this many pixels on the long edge: plenty for averages and percentiles. */
const SAMPLE_EDGE = 400
/** The band round the edge (share of each side) that shows how the light falls: border, sleeve and plastic. */
const BAND_FROM = 0.015
const BAND_TO = 0.07
/** Pieces of the band along each side; their medians are fitted with a plane. */
const BAND_PIECES = 6
/** Even out only a clear falloff (brightest corner over darkest) that the band agrees on (fit error). */
const MIN_FALLOFF = 1.12
const MAX_FIT_ERROR = 0.08
/** Falloff is corrected this much of the way, and never by more than these factors. */
const FALLOFF_STRENGTH = 0.7
const MIN_LIGHT = 0.75
const MAX_LIGHT = 1.35
/** Colour is judged on the card away from its edge (share of each side). */
const INNER = 0.08
/** Whites: bright, near-grey pixels (spread under this share of their brightness), not blown out. */
const WHITE_LEVEL = 110
const WHITE_SPREAD = 0.35
const BLOWN = 250
/** At least this share of the card must be whites to judge a cast from; gains are capped and partly applied. */
const MIN_WHITES = 0.01
const MIN_CAST = 0.03
const MAX_GAIN = 1.2
const MIN_GAIN = 0.85
const CAST_STRENGTH = 0.8
/** Levels: the darkest and brightest 1% go to these, unless the photo already spans most of the range. */
const BLACK = 12
const WHITE = 247
const LOW_ENOUGH = 18
const HIGH_ENOUGH = 232
const MAX_STRETCH = 1.5
/** Average change (levels) below this isn't worth showing as a change. */
const MIN_CHANGE = 5

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b

/** The correction this photo needs, or null when it already looks evenly and well lit. */
export function measureLight(pixels: Pixels): LightFix | null {
  const sample = shrink(pixels)
  const falloff = measureFalloff(sample)
  const evened = falloff ? applyLight(sample, { falloff, gains: [1, 1, 1], low: BLACK, high: WHITE }) : sample
  const gains = measureCast(evened)
  const balanced = applyLight(evened, { falloff: null, gains, low: BLACK, high: WHITE })
  const fix: LightFix = { falloff, gains, ...measureLevels(balanced) }
  return averageChange(sample, applyLight(sample, fix)) >= MIN_CHANGE ? fix : null
}

/** Applies a correction to every pixel. */
export function applyLight(pixels: Pixels, { falloff, gains, low, high }: LightFix): Pixels {
  const { width, height, data } = pixels
  const out = new Uint8ClampedArray(data.length)
  const scale = (WHITE - BLACK) / (high - low)
  const curve = toneCurve((v) => (v - low) * scale + BLACK)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const light = falloff ? lightAt(falloff, (x + 0.5) / width, (y + 0.5) / height) : 1
      for (let c = 0; c < 3; c++) out[i + c] = curve(data[i + c] * light * gains[c])
      out[i + 3] = data[i + 3]
    }
  }
  return { width, height, data: out }
}

/** The automatic correction, or null when the photo doesn't need one. */
export function autoLight(pixels: Pixels): Pixels | null {
  const fix = measureLight(pixels)
  return fix && applyLight(pixels, fix)
}

/**
 * The manual sliders: brightness bends the midtones, contrast pivots round the middle, warmth tints, and
 * sharpness crisps up edges softened by the sleeve and toploader.
 */
export function adjustLight(pixels: Pixels, { brightness, contrast, warmth, sharpness }: LightAdjust): Pixels {
  const gamma = Math.pow(2, -brightness / 100)
  const spread = 1 + contrast / 100
  const tint: [number, number, number] = [1 + warmth / 400, 1, 1 - warmth / 400]
  const curve = toneCurve((v) => {
    const bent = 255 * Math.pow(Math.min(Math.max(v, 0), 255) / 255, gamma)
    return (bent - 128) * spread + 128
  })
  const { width, height, data } = pixels
  const out = new Uint8ClampedArray(data.length)
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) out[i + c] = curve(data[i + c] * tint[c])
    out[i + 3] = data[i + 3]
  }
  const toned = { width, height, data: out }
  return sharpness > 0 ? sharpen(toned, (sharpness / 100) * MAX_SHARPEN) : toned
}

/** Unsharp mask: each pixel pushed away from the average of its 3×3 neighbourhood by `amount`. */
export function sharpen({ width, height, data }: Pixels, amount: number): Pixels {
  const out = new Uint8ClampedArray(data)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let dy = -1; dy <= 1; dy++) {
          const row = i + dy * width * 4 + c
          sum += data[row - 4] + data[row] + data[row + 4]
        }
        out[i + c] = data[i + c] + amount * (data[i + c] - sum / 9)
      }
    }
  }
  return { width, height, data: out }
}

/** A lookup for a tone curve on 0–255 (inputs above 255 after gains are clamped first). */
function toneCurve(f: (v: number) => number): (v: number) => number {
  const table = new Float32Array(256)
  for (let v = 0; v < 256; v++) table[v] = f(v)
  return (v) => table[Math.min(255, Math.max(0, Math.round(v)))]
}

function lightAt(falloff: { x: number; y: number }, fx: number, fy: number): number {
  const seen = 1 + falloff.x * (fx - 0.5) + falloff.y * (fy - 0.5)
  return Math.min(MAX_LIGHT, Math.max(MIN_LIGHT, 1 / seen))
}

/** Every few pixels, for measuring. */
function shrink(pixels: Pixels): Pixels {
  const step = Math.max(1, Math.ceil(Math.max(pixels.width, pixels.height) / SAMPLE_EDGE))
  if (step === 1) return pixels
  const width = Math.floor(pixels.width / step)
  const height = Math.floor(pixels.height / step)
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * step * pixels.width + x * step) * 4
      data.set(pixels.data.subarray(from, from + 4), (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

/**
 * How the light falls across the photo, from the band round its edge (sleeve, plastic and border are much
 * the same all round, unlike the artwork): a plane fitted to the band's brightness, piece by piece.
 * Null when the falloff is slight or the band doesn't agree with a plane.
 */
function measureFalloff({ width, height, data }: Pixels): { x: number; y: number } | null {
  const points: { x: number; y: number; v: number }[] = []
  const piece = (x0: number, y0: number, x1: number, y1: number) => {
    const values: number[] = []
    for (let y = Math.floor(y0 * height); y < Math.ceil(y1 * height); y++) {
      for (let x = Math.floor(x0 * width); x < Math.ceil(x1 * width); x++) {
        const i = (y * width + x) * 4
        values.push(luma(data[i], data[i + 1], data[i + 2]))
      }
    }
    if (values.length) points.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, v: median(values) })
  }
  for (let k = 0; k < BAND_PIECES; k++) {
    const a = BAND_TO + ((1 - 2 * BAND_TO) * k) / BAND_PIECES
    const b = BAND_TO + ((1 - 2 * BAND_TO) * (k + 1)) / BAND_PIECES
    piece(a, BAND_FROM, b, BAND_TO) // top
    piece(a, 1 - BAND_TO, b, 1 - BAND_FROM) // bottom
    piece(BAND_FROM, a, BAND_TO, b) // left
    piece(1 - BAND_TO, a, 1 - BAND_FROM, b) // right
  }
  // Fit, drop the quarter that fit worst (a logo on the border), fit again.
  let plane = fitPlane(points)
  if (!plane) return null
  const residual = (p: { x: number; y: number; v: number }) => Math.abs(p.v - (plane!.c + plane!.x * (p.x - 0.5) + plane!.y * (p.y - 0.5)))
  const kept = [...points].sort((p, q) => residual(p) - residual(q)).slice(0, Math.ceil(points.length * 0.75))
  plane = fitPlane(kept)
  if (!plane || plane.c <= 0) return null
  const error = Math.sqrt(kept.reduce((s, p) => s + residual(p) ** 2, 0) / kept.length) / plane.c
  const corners = [-0.5, 0.5].flatMap((dx) => [-0.5, 0.5].map((dy) => plane!.c + plane!.x * dx + plane!.y * dy))
  if (Math.min(...corners) <= 0) return null
  if (error > MAX_FIT_ERROR || Math.max(...corners) / Math.min(...corners) < MIN_FALLOFF) return null
  return { x: (FALLOFF_STRENGTH * plane.x) / plane.c, y: (FALLOFF_STRENGTH * plane.y) / plane.c }
}

/** Least-squares v = c + x·(x − ½) + y·(y − ½). */
function fitPlane(points: { x: number; y: number; v: number }[]): { c: number; x: number; y: number } | null {
  const n = points.length
  if (n < 3) return null
  let sx = 0
  let sy = 0
  let sv = 0
  for (const p of points) {
    sx += p.x - 0.5
    sy += p.y - 0.5
    sv += p.v
  }
  const mx = sx / n
  const my = sy / n
  const mv = sv / n
  let xx = 0
  let yy = 0
  let xy = 0
  let xv = 0
  let yv = 0
  for (const p of points) {
    const dx = p.x - 0.5 - mx
    const dy = p.y - 0.5 - my
    const dv = p.v - mv
    xx += dx * dx
    yy += dy * dy
    xy += dx * dy
    xv += dx * dv
    yv += dy * dv
  }
  const det = xx * yy - xy * xy
  if (Math.abs(det) < 1e-12) return null
  const x = (xv * yy - yv * xy) / det
  const y = (yv * xx - xv * xy) / det
  return { c: mv - x * mx - y * my, x, y }
}

/** Gains that make the card's whites grey again, or none when there's no clear cast or too few whites. */
function measureCast(pixels: Pixels): [number, number, number] {
  const whites: [number, number, number][] = []
  let counted = 0
  forInner(pixels, (r, g, b) => {
    counted++
    const v = luma(r, g, b)
    if (v < WHITE_LEVEL || Math.max(r, g, b) >= BLOWN) return
    if (Math.max(r, g, b) - Math.min(r, g, b) > WHITE_SPREAD * v) return
    whites.push([r, g, b])
  })
  if (whites.length < MIN_WHITES * counted) return [1, 1, 1]
  // The brightest third of them: most likely white card stock rather than a pale colour.
  whites.sort((p, q) => luma(...q) - luma(...p))
  const top = whites.slice(0, Math.max(1, Math.ceil(whites.length / 3)))
  const mean = [0, 1, 2].map((c) => top.reduce((s, w) => s + w[c], 0) / top.length)
  const grey = luma(mean[0], mean[1], mean[2])
  const gains = mean.map((m) => {
    const full = Math.min(MAX_GAIN, Math.max(MIN_GAIN, grey / m))
    return 1 + (full - 1) * CAST_STRENGTH
  }) as [number, number, number]
  return gains.some((g) => Math.abs(g - 1) >= MIN_CAST) ? gains : [1, 1, 1]
}

/** Levels for the card's brightness range: its darkest and brightest 1% spread toward black and white. */
function measureLevels(pixels: Pixels): { low: number; high: number } {
  const values: number[] = []
  forInner(pixels, (r, g, b) => values.push(luma(r, g, b)))
  values.sort((a, b) => a - b)
  const at = (q: number) => values[Math.min(values.length - 1, Math.floor(q * values.length))]
  let low = at(0.01)
  let high = at(0.99)
  if ((low <= LOW_ENOUGH && high >= HIGH_ENOUGH) || high - low < 1) {
    low = BLACK
    high = WHITE
  } else {
    // Never flatten a photo, and never stretch too far (that brings up the grain in a dark shot).
    const stretch = (WHITE - BLACK) / (high - low)
    if (stretch < 1) {
      low = BLACK
      high = WHITE
    } else if (stretch > MAX_STRETCH) {
      const middle = (low + high) / 2
      const half = (WHITE - BLACK) / MAX_STRETCH / 2
      low = middle - half
      high = middle + half
    }
  }
  return { low, high }
}

function forInner({ width, height, data }: Pixels, visit: (r: number, g: number, b: number) => void) {
  for (let y = Math.floor(height * INNER); y < Math.ceil(height * (1 - INNER)); y++) {
    for (let x = Math.floor(width * INNER); x < Math.ceil(width * (1 - INNER)); x++) {
      const i = (y * width + x) * 4
      visit(data[i], data[i + 1], data[i + 2])
    }
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function averageChange(a: Pixels, b: Pixels): number {
  let sum = 0
  for (let i = 0; i < a.data.length; i += 4) {
    sum += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])
  }
  return sum / ((a.data.length / 4) * 3)
}
