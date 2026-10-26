import { useEffect, useRef, useState } from 'react'
import { downloadPhoto } from '../../hooks/usePhotos'
import { autoTouchUp, type TouchUpChange } from '../../lib/photoEdit'
import {
  drawPixels,
  finishPhoto,
  imagePixels,
  isFlatPhoto,
  loadImage,
  PHOTO_MAX_EDGE,
  type CardCrop,
  type Side,
} from '../../lib/photos'
import type { Card } from '../../types/card'

/** Cards worked on at a time: enough to review in one go, few enough for a phone's memory. */
export const BATCH_SIZE = 8

/** One photo the automatic touch-up changed: object URLs of both versions, and the new one ready to upload. */
export type SideResult = { side: Side; before: string; after: string; crop: CardCrop; changes: TouchUpChange[] }
export type CardResult = { card: Card; sides: SideResult[] }
/** `failed`: photos that couldn't be downloaded or decoded; those cards stay unchecked. */
export type Batch = { cards: Card[]; changed: CardResult[]; failed: Card[] }

/** Cards with photos that haven't been through the touch-up yet, in the collection's order (newest first). */
export function touchUpQueue(cards: Card[]): Card[] {
  return cards.filter((c) => (c.front_image_path || c.back_image_path) && !c.photos_checked_at)
}

/** Runs the automatic touch-up over a batch of cards, in the browser. */
export function useTouchUpBatch() {
  const [batch, setBatch] = useState<Batch | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const urls = useRef<string[]>([])

  const release = () => {
    for (const url of urls.current) URL.revokeObjectURL(url)
    urls.current = []
  }
  useEffect(() => release, [])

  async function touchUpPhoto(path: string): Promise<Omit<SideResult, 'side'> | null> {
    const blob = await downloadPhoto(path)
    const wasFlat = isFlatPhoto(path)
    const { pixels, changes } = autoTouchUp(imagePixels(await loadImage(blob)), {
      straighten: !wasFlat,
      maxEdge: PHOTO_MAX_EDGE,
    })
    if (changes.length === 0) return null
    const crop = await finishPhoto(drawPixels(pixels), wasFlat || changes.includes('straightened'))
    const before = URL.createObjectURL(blob)
    const after = URL.createObjectURL(crop.photo.blob)
    urls.current.push(before, after)
    return { before, after, crop, changes }
  }

  async function run(cards: Card[]) {
    release()
    setBatch(null)
    setProgress({ done: 0, total: cards.length })
    const changed: CardResult[] = []
    const failed: Card[] = []
    for (const [i, card] of cards.entries()) {
      try {
        const sides: SideResult[] = []
        for (const side of ['front', 'back'] as const) {
          const path = side === 'front' ? card.front_image_path : card.back_image_path
          const result = path ? await touchUpPhoto(path) : null
          if (result) sides.push({ side, ...result })
        }
        if (sides.length) changed.push({ card, sides })
      } catch {
        failed.push(card)
      }
      setProgress({ done: i + 1, total: cards.length })
      await new Promise((resolve) => setTimeout(resolve)) // let the progress line paint between cards
    }
    setBatch({ cards, changed, failed })
    setProgress(null)
  }

  function clear() {
    release()
    setBatch(null)
  }

  return { batch, progress, run, clear }
}
