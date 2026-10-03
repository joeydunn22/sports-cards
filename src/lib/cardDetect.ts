/**
 * Finds card-shaped regions in a photo of several cards laid out on a plain background.
 * Pure logic on raw RGBA pixels so it can be unit tested; the caller downsizes the photo first
 * (about 800px on the long edge is plenty) and maps the normalized boxes back onto the full image.
 */

export type Pixels = { width: number; height: number; data: Uint8ClampedArray }

/** A box in normalized coordinates: 0..1 of the image width/height. */
export type Box = { x: number; y: number; w: number; h: number }

/** Short side / long side. Cards are 0.71, toploaders 0.75; leave room for perspective and sleeves. */
const MIN_ASPECT = 0.5
const MAX_ASPECT = 0.92
/** Ignore specks and reflections smaller than this share of the photo. */
const MIN_AREA = 0.012

export function detectCards(pixels: Pixels): Box[] {
  const { width, height } = pixels
  const gray = toGray(pixels)
  const threshold = otsuThreshold(gray)
  const foregroundIsBright = borderMean(gray, width, height) <= threshold

  const mask = new Uint8Array(width * height)
  for (let i = 0; i < gray.length; i++) mask[i] = gray[i] > threshold === foregroundIsBright ? 1 : 0

  // Close small gaps (dark artwork inside a card, sleeve edges) so each card is one blob.
  const radius = Math.max(1, Math.round(Math.min(width, height) * 0.012))
  const closed = dilate(mask, width, height, radius)

  const boxes = connectedBoxes(closed, width, height)
    .map((b) => shrink(b, radius, width, height))
    .filter((b) => {
      const aspect = Math.min(b.w, b.h) / Math.max(b.w, b.h)
      return b.w * b.h >= MIN_AREA * width * height && aspect >= MIN_ASPECT && aspect <= MAX_ASPECT
    })
    .map((b) => ({ x: b.x / width, y: b.y / height, w: b.w / width, h: b.h / height }))

  return readingOrder(dropNested(boxes))
}

/** Evenly spaced boxes for when detection can't separate the cards (e.g. they touch). */
export function gridBoxes(rows: number, cols: number): Box[] {
  const inset = 0.01
  const boxes: Box[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      boxes.push({ x: c / cols + inset, y: r / rows + inset, w: 1 / cols - 2 * inset, h: 1 / rows - 2 * inset })
    }
  }
  return boxes
}

/** Top-to-bottom rows, left-to-right within a row. */
export function readingOrder(boxes: Box[]): Box[] {
  if (boxes.length < 2) return boxes
  const heights = boxes.map((b) => b.h).sort((a, b) => a - b)
  const rowTolerance = heights[Math.floor(heights.length / 2)] / 2
  const byY = [...boxes].sort((a, b) => cy(a) - cy(b))
  const rows: Box[][] = []
  for (const box of byY) {
    const row = rows.at(-1)
    if (row && Math.abs(cy(box) - cy(row[0])) <= rowTolerance) row.push(box)
    else rows.push([box])
  }
  return rows.flatMap((row) => row.sort((a, b) => cx(a) - cx(b)))
}

/** Adds a margin around a box (normalized), clamped to the image. */
export function padBox(box: Box, margin: number): Box {
  const x = Math.max(0, box.x - box.w * margin)
  const y = Math.max(0, box.y - box.h * margin)
  const right = Math.min(1, box.x + box.w * (1 + margin))
  const bottom = Math.min(1, box.y + box.h * (1 + margin))
  return { x, y, w: right - x, h: bottom - y }
}

const cx = (b: Box) => b.x + b.w / 2
const cy = (b: Box) => b.y + b.h / 2

type PixelBox = { x: number; y: number; w: number; h: number }

function toGray({ data, width, height }: Pixels): Uint8Array {
  const gray = new Uint8Array(width * height)
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000
  }
  return gray
}

function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0)
  for (const v of gray) hist[v]++
  const total = gray.length
  let sumAll = 0
  for (let i = 0; i < 256; i++) sumAll += i * hist[i]

  let sumBg = 0
  let weightBg = 0
  let best = 0
  let threshold = 127
  for (let t = 0; t < 256; t++) {
    weightBg += hist[t]
    if (weightBg === 0) continue
    const weightFg = total - weightBg
    if (weightFg === 0) break
    sumBg += t * hist[t]
    const meanBg = sumBg / weightBg
    const meanFg = (sumAll - sumBg) / weightFg
    const between = weightBg * weightFg * (meanBg - meanFg) ** 2
    if (between > best) {
      best = between
      threshold = t
    }
  }
  return threshold
}

/** Average brightness of the outer edge of the photo: that's the background. */
function borderMean(gray: Uint8Array, width: number, height: number): number {
  let sum = 0
  let count = 0
  for (let x = 0; x < width; x++) {
    sum += gray[x] + gray[(height - 1) * width + x]
    count += 2
  }
  for (let y = 0; y < height; y++) {
    sum += gray[y * width] + gray[y * width + width - 1]
    count += 2
  }
  return sum / count
}

/** Square dilation, done as two separable passes. */
function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const horizontal = new Uint8Array(mask.length)
  for (let y = 0; y < height; y++) {
    const row = y * width
    let run = -1 // index of the last set pixel seen
    for (let x = 0; x < width; x++) {
      if (mask[row + x]) run = x
      if (run >= 0 && x - run <= radius) horizontal[row + x] = 1
    }
    run = -1
    for (let x = width - 1; x >= 0; x--) {
      if (mask[row + x]) run = x
      if (run >= 0 && run - x <= radius) horizontal[row + x] = 1
    }
  }
  const out = new Uint8Array(mask.length)
  for (let x = 0; x < width; x++) {
    let run = -1
    for (let y = 0; y < height; y++) {
      if (horizontal[y * width + x]) run = y
      if (run >= 0 && y - run <= radius) out[y * width + x] = 1
    }
    run = -1
    for (let y = height - 1; y >= 0; y--) {
      if (horizontal[y * width + x]) run = y
      if (run >= 0 && run - y <= radius) out[y * width + x] = 1
    }
  }
  return out
}

/** Bounding boxes of 4-connected regions. */
function connectedBoxes(mask: Uint8Array, width: number, height: number): PixelBox[] {
  const seen = new Uint8Array(mask.length)
  const stack: number[] = []
  const boxes: PixelBox[] = []
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    seen[start] = 1
    stack.push(start)
    while (stack.length) {
      const i = stack.pop()!
      const x = i % width
      const y = (i - x) / width
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      const neighbors = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1]
      for (const n of neighbors) {
        if (n >= 0 && mask[n] && !seen[n]) {
          seen[n] = 1
          stack.push(n)
        }
      }
    }
    boxes.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 })
  }
  return boxes
}

/** Undo the growth that dilation added around each region. */
function shrink(b: PixelBox, radius: number, width: number, height: number): PixelBox {
  const x = Math.min(b.x + (b.x > 0 ? radius : 0), width - 1)
  const y = Math.min(b.y + (b.y > 0 ? radius : 0), height - 1)
  const right = Math.max(b.x + b.w - (b.x + b.w < width ? radius : 0), x + 1)
  const bottom = Math.max(b.y + b.h - (b.y + b.h < height ? radius : 0), y + 1)
  return { x, y, w: right - x, h: bottom - y }
}

function dropNested(boxes: Box[]): Box[] {
  return boxes.filter(
    (inner) =>
      !boxes.some(
        (outer) =>
          outer !== inner &&
          inner.x >= outer.x &&
          inner.y >= outer.y &&
          inner.x + inner.w <= outer.x + outer.w &&
          inner.y + inner.h <= outer.y + outer.h,
      ),
  )
}
