import { describe, expect, it } from 'vitest'
import type { Pixels } from './cardDetect'
import { adjustLight, applyLight, autoLight, measureLight, NO_ADJUST } from './photoLight'

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

const at = (img: Pixels, x: number, y: number): Colour => {
  const p = (y * img.width + x) * 4
  return [img.data[p], img.data[p + 1], img.data[p + 2]]
}

/**
 * A card as photographed: a white border and text box, dark lettering and coloured artwork, every tone
 * passed through `light` (how the photo was lit) at its position.
 */
function card(light: (c: Colour, x: number, y: number) => Colour = (c) => c): Pixels {
  return rgb(300, 420, (x, y) => {
    let c: Colour
    if (x < 20 || y < 20 || x >= 280 || y >= 400) c = [240, 240, 240] // border
    else if (y > 320) c = (x + y) % 9 < 2 ? [15, 15, 20] : [235, 235, 235] // text box with lettering
    else c = [(x * 3) % 200 + 30, 90, (y * 2) % 180 + 40] // artwork
    return light(c, x, y)
  })
}

const scaled = (c: Colour, k: number): Colour => c.map((v) => Math.round(v * k)) as Colour

describe('measureLight', () => {
  it('leaves a well-lit photo alone', () => {
    expect(measureLight(card())).toBeNull()
  })

  it('brightens a dim photo', () => {
    const dim = card((c) => scaled(c, 0.6))
    const fixed = autoLight(dim)!
    expect(at(dim, 10, 10)[0]).toBeLessThan(150)
    expect(at(fixed, 10, 10)[0]).toBeGreaterThan(200) // the white border is white again
  })

  it('restores contrast to a washed-out photo', () => {
    const washed = card((c) => c.map((v) => Math.round(100 + v * 0.6)) as Colour)
    const fixed = autoLight(washed)!
    const ink = (img: Pixels) => Math.min(...[...Array(9)].map((_, k) => at(img, 150 + k, 360)[0]))
    expect(ink(washed)).toBeGreaterThan(100)
    expect(ink(fixed)).toBeLessThan(70) // the lettering is dark again
  })

  it('takes a lamp’s yellow cast out of the whites', () => {
    const lamp = card((c) => [c[0], Math.round(c[1] * 0.93), Math.round(c[2] * 0.75)])
    const fixed = autoLight(lamp)!
    const [r, , b] = at(lamp, 10, 10)
    const [fr, , fb] = at(fixed, 10, 10)
    expect(r - b).toBeGreaterThan(50)
    expect(fr - fb).toBeLessThan(20)
  })

  it('does not tint a card with no whites to judge by', () => {
    const green = rgb(300, 420, (x, y) => [40, 140 + ((x + y) % 60), 60])
    expect(measureLight(green)?.gains ?? [1, 1, 1]).toEqual([1, 1, 1])
  })

  it('evens out light that falls off across the card', () => {
    // The lamp is to the right: the left edge gets 70% of the light.
    const uneven = card((c, x) => scaled(c, 0.7 + (0.3 * x) / 300))
    const fix = measureLight(uneven)!
    expect(fix.falloff).not.toBeNull()
    const fixed = applyLight(uneven, fix)
    const gap = (img: Pixels) => at(img, 290, 200)[0] - at(img, 10, 200)[0] // right border minus left border
    expect(gap(uneven)).toBeGreaterThan(60)
    expect(gap(fixed)).toBeLessThan(gap(uneven) / 2)
  })

  it('keeps a dark card dark', () => {
    const navy = card((c, x, y) => (x >= 20 && x < 280 && y >= 20 && y <= 320 ? [20, 30, 70] : c))
    const fixed = autoLight(navy) ?? navy
    expect(at(fixed, 150, 150)[2]).toBeLessThan(100)
  })
})

describe('adjustLight', () => {
  const photo = card()

  it('changes nothing at zero', () => {
    expect(at(adjustLight(photo, NO_ADJUST), 150, 150)).toEqual(at(photo, 150, 150))
  })

  it('brightens the midtones and warms the colour', () => {
    const before = at(photo, 150, 150)
    expect(at(adjustLight(photo, { ...NO_ADJUST, brightness: 50 }), 150, 150)[1]).toBeGreaterThan(before[1])
    const warm = at(adjustLight(photo, { ...NO_ADJUST, warmth: 60 }), 150, 150)
    expect(warm[0]).toBeGreaterThan(before[0])
    expect(warm[2]).toBeLessThan(before[2])
  })

  it('sharpens an edge without moving flat areas', () => {
    const edge = rgb(40, 40, (x) => (x < 20 ? [80, 80, 80] : [160, 160, 160]))
    const sharp = adjustLight(edge, { ...NO_ADJUST, sharpness: 100 })
    expect(at(sharp, 19, 20)[0]).toBeLessThan(80) // dark side of the edge gets darker
    expect(at(sharp, 20, 20)[0]).toBeGreaterThan(160) // light side lighter
    expect(at(sharp, 5, 20)[0]).toBe(80)
  })

  it('spreads tones apart with more contrast', () => {
    const more = adjustLight(photo, { ...NO_ADJUST, contrast: 50 })
    expect(at(more, 150, 364)[0]).toBeLessThanOrEqual(at(photo, 150, 364)[0]) // lettering
    expect(at(more, 10, 10)[0]).toBeGreaterThan(at(photo, 10, 10)[0])
  })
})
