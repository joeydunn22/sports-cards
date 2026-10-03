import { gridBoxes, type Box } from '../../lib/cardDetect'

/** How the cards in one photo were found: automatically, or a grid the user picked. */
export type Layout = 'auto' | `${number}x${number}`

export const GRID_LAYOUTS: { layout: Layout; label: string }[] = [
  { layout: '1x1', label: '1' },
  { layout: '1x2', label: '2' },
  { layout: '2x2', label: '4' },
  { layout: '2x3', label: '6' },
  { layout: '3x3', label: '9' },
]

export type CapturedPhoto = {
  id: string
  file: File
  url: string
  /** Pixel size, for drawing crops at the right proportions. */
  width: number
  height: number
  autoBoxes: Box[]
  layout: Layout
}

export function boxesFor(photo: Pick<CapturedPhoto, 'autoBoxes' | 'layout'>): Box[] {
  if (photo.layout === 'auto') return photo.autoBoxes
  const [rows, cols] = photo.layout.split('x').map(Number)
  return gridBoxes(rows, cols)
}

/** One card's spot within a photo. */
export type CardSpot = { photo: CapturedPhoto; box: Box }

/** Every card across a step's photos, in the order they were shot (reading order within each photo). */
export function cardSpots(photos: CapturedPhoto[]): CardSpot[] {
  return photos.flatMap((photo) => boxesFor(photo).map((box) => ({ photo, box })))
}

/**
 * Backs pair with fronts by position: flip each card over where it lies and shoot the backs in the
 * same order, and card N's back is back N. `order[i]` is the index of the back paired with front i.
 */
export function initialOrder(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i)
}

export function swap(order: number[], a: number, b: number): number[] {
  const next = [...order]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}
