import { describe, expect, it } from 'vitest'
import { detectCards, gridBoxes, padBox, readingOrder, type Box, type Pixels } from './cardDetect'

type Rect = { x: number; y: number; w: number; h: number; hole?: boolean }

/** Synthetic photo: flat background with filled rectangles ("cards"), optionally with a dark middle. */
function photo(width: number, height: number, rects: Rect[], { bg = 20, fg = 220 } = {}): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  const set = (x: number, y: number, v: number) => {
    const p = (y * width + x) * 4
    data[p] = data[p + 1] = data[p + 2] = v
    data[p + 3] = 255
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) set(x, y, bg)
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        const border = Math.min(x - r.x, y - r.y, r.x + r.w - 1 - x, r.y + r.h - 1 - y)
        set(x, y, r.hole && border > 6 ? bg : fg)
      }
    }
  }
  return { width, height, data }
}

const near = (box: Box, x: number, y: number, w: number, h: number) => {
  expect(box.x).toBeCloseTo(x, 1)
  expect(box.y).toBeCloseTo(y, 1)
  expect(box.w).toBeCloseTo(w, 1)
  expect(box.h).toBeCloseTo(h, 1)
}

describe('detectCards', () => {
  it('finds each card on a dark background, in reading order', () => {
    // 2 rows x 3 cards, portrait 60x84 (card proportions)
    const rects = [0, 1, 2].flatMap((col) =>
      [0, 1].map((row) => ({ x: 30 + col * 120, y: 20 + row * 110, w: 60, h: 84 })),
    )
    const boxes = detectCards(photo(400, 240, rects))
    expect(boxes).toHaveLength(6)
    near(boxes[0], 30 / 400, 20 / 240, 60 / 400, 84 / 240)
    near(boxes[1], 150 / 400, 20 / 240, 60 / 400, 84 / 240) // top row, middle
    near(boxes[3], 30 / 400, 130 / 240, 60 / 400, 84 / 240) // second row starts left again
  })

  it('keeps a card whole when its middle is as dark as the table', () => {
    const boxes = detectCards(photo(300, 200, [{ x: 40, y: 30, w: 90, h: 126, hole: true }]))
    expect(boxes).toHaveLength(1)
    near(boxes[0], 40 / 300, 30 / 200, 90 / 300, 126 / 200)
  })

  it('works on a light background too', () => {
    const boxes = detectCards(
      photo(300, 200, [{ x: 30, y: 40, w: 80, h: 112 }, { x: 170, y: 40, w: 80, h: 112 }], { bg: 235, fg: 40 }),
    )
    expect(boxes).toHaveLength(2)
  })

  it('finds landscape cards and ignores specks and long strips', () => {
    const boxes = detectCards(
      photo(400, 240, [
        { x: 40, y: 60, w: 140, h: 100 }, // landscape card
        { x: 250, y: 30, w: 4, h: 4 }, // speck
        { x: 220, y: 200, w: 160, h: 12 }, // strip (e.g. a ruler edge)
      ]),
    )
    expect(boxes).toHaveLength(1)
    near(boxes[0], 40 / 400, 60 / 240, 140 / 400, 100 / 240)
  })

  it('returns nothing for an empty photo', () => {
    expect(detectCards(photo(200, 150, []))).toEqual([])
  })
})

describe('readingOrder', () => {
  it('groups slightly uneven rows', () => {
    const b = (x: number, y: number): Box => ({ x, y, w: 0.2, h: 0.3 })
    const ordered = readingOrder([b(0.6, 0.55), b(0.1, 0.05), b(0.6, 0.08), b(0.1, 0.5)])
    expect(ordered.map((o) => [o.x, o.y])).toEqual([
      [0.1, 0.05],
      [0.6, 0.08],
      [0.1, 0.5],
      [0.6, 0.55],
    ])
  })
})

describe('gridBoxes', () => {
  it('splits the photo evenly', () => {
    const boxes = gridBoxes(2, 3)
    expect(boxes).toHaveLength(6)
    near(boxes[4], 1 / 3 + 0.01, 0.5 + 0.01, 1 / 3 - 0.02, 0.5 - 0.02)
  })
})

describe('padBox', () => {
  it('grows the box but stays inside the image', () => {
    const box = padBox({ x: 0.01, y: 0.5, w: 0.2, h: 0.4 }, 0.1)
    expect(box.x).toBe(0)
    expect(box.y).toBeCloseTo(0.46)
    expect(box.w).toBeCloseTo(0.23)
    expect(box.h).toBeCloseTo(0.48)
  })
})
