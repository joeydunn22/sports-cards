import { describe, expect, it } from 'vitest'
import { boxesFor, cardSpots, initialOrder, swap, type CapturedPhoto } from './captureState'

const box = (x: number) => ({ x, y: 0.1, w: 0.2, h: 0.3 })

function photo(id: string, autoBoxes = [box(0.1)], layout: CapturedPhoto['layout'] = 'auto'): CapturedPhoto {
  return { id, file: new File([], `${id}.jpg`), url: '', width: 4000, height: 3000, autoBoxes, layout }
}

describe('boxesFor', () => {
  it('uses detected boxes in auto mode and a grid otherwise', () => {
    expect(boxesFor(photo('a', [box(0.1), box(0.5)]))).toHaveLength(2)
    expect(boxesFor(photo('a', [box(0.1)], '2x3'))).toHaveLength(6)
  })
})

describe('cardSpots', () => {
  it('lists cards photo by photo, keeping each photo’s order', () => {
    const spots = cardSpots([photo('a', [box(0.1), box(0.5)]), photo('b', [box(0.3)])])
    expect(spots.map((s) => [s.photo.id, s.box.x])).toEqual([
      ['a', 0.1],
      ['a', 0.5],
      ['b', 0.3],
    ])
  })
})

describe('pairing order', () => {
  it('pairs by position and swaps two backs', () => {
    expect(initialOrder(3)).toEqual([0, 1, 2])
    expect(swap([0, 1, 2], 0, 2)).toEqual([2, 1, 0])
  })
})
