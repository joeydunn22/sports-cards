import { useEffect, useRef, useState } from 'react'
import { downloadPhoto } from '../../hooks/usePhotos'
import { touchUpInBackground } from '../../lib/backgroundTouchUp'
import type { TouchUpChange } from '../../lib/photoEdit'
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

/** A batch being worked on, or done (`finished`). Once `dropped` it stops, and its object URLs are released. */
type Job = {
  key: string
  done: number
  total: number
  finished: Batch | null
  result: Promise<Batch>
  urls: string[]
  dropped: boolean
  onProgress: ((done: number) => void) | null
}

/** Cards with photos that haven't been through the touch-up yet, in the collection's order (newest first). */
export function touchUpQueue(cards: Card[]): Card[] {
  return cards.filter((c) => (c.front_image_path || c.back_image_path) && !c.photos_checked_at)
}

const keyOf = (cards: Card[]) => cards.map((c) => c.id).join(',')

function drop(job: Job) {
  job.dropped = true
  for (const url of job.urls) URL.revokeObjectURL(url)
  job.urls = []
}

/**
 * Runs the automatic touch-up over a batch of cards in the browser (in a worker, so the screen stays
 * responsive), and gets the next batch ready while the current one is being reviewed.
 */
export function useTouchUpBatch() {
  const [batch, setBatch] = useState<Batch | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const shown = useRef<Job | null>(null)
  const ahead = useRef<Job | null>(null)
  const mounted = useRef(false)

  // Leaving the page lets go of both batches (and stops the one being worked on). Checked a moment later,
  // since React's development mode unmounts and remounts once on purpose.
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      setTimeout(() => {
        if (mounted.current) return
        for (const job of [shown.current, ahead.current]) if (job) drop(job)
        shown.current = ahead.current = null
      })
    }
  }, [])

  async function touchUpPhoto(path: string, job: Job): Promise<Omit<SideResult, 'side'> | null> {
    const blob = await downloadPhoto(path)
    const wasFlat = isFlatPhoto(path)
    const { pixels, changes } = await touchUpInBackground(imagePixels(await loadImage(blob)), {
      straighten: !wasFlat,
      maxEdge: PHOTO_MAX_EDGE,
    })
    if (changes.length === 0) return null
    const crop = await finishPhoto(drawPixels(pixels), wasFlat || changes.includes('straightened'))
    const before = URL.createObjectURL(blob)
    const after = URL.createObjectURL(crop.photo.blob)
    job.urls.push(before, after)
    if (job.dropped) drop(job) // let go while this photo was in the works
    return { before, after, crop, changes }
  }

  function prepare(cards: Card[]): Job {
    const job: Job = { key: keyOf(cards), done: 0, total: cards.length, finished: null, result: null!, urls: [], dropped: false, onProgress: null }
    job.result = (async () => {
      const changed: CardResult[] = []
      const failed: Card[] = []
      for (const card of cards) {
        if (job.dropped) break
        try {
          const sides: SideResult[] = []
          for (const side of ['front', 'back'] as const) {
            const path = side === 'front' ? card.front_image_path : card.back_image_path
            const result = path ? await touchUpPhoto(path, job) : null
            if (result) sides.push({ side, ...result })
          }
          if (sides.length) changed.push({ card, sides })
        } catch {
          failed.push(card)
        }
        job.done++
        job.onProgress?.(job.done)
      }
      job.finished = { cards, changed, failed }
      return job.finished
    })()
    return job
  }

  /**
   * Shows `cards` for review (straight away if they were got ready ahead), then gets `next` ready behind them.
   * The batch shown before is let go.
   */
  async function load(cards: Card[], next: Card[]) {
    const job = ahead.current?.key === keyOf(cards) ? ahead.current : prepare(cards)
    if (ahead.current && ahead.current !== job) drop(ahead.current)
    ahead.current = null
    if (shown.current) drop(shown.current)
    shown.current = job
    showJob(job)
    const result = job.finished ?? (await job.result)
    if (shown.current !== job) return // moved on, or the page closed
    showJob(job, result)
    if (next.length) ahead.current = prepare(next)
  }

  /** The batch's review once it's done, its progress until then. */
  function showJob(job: Job, result = job.finished) {
    job.onProgress = result ? null : (done) => setProgress({ done, total: job.total })
    setProgress(result ? null : { done: job.done, total: job.total })
    setBatch(result)
  }

  function clear() {
    for (const job of [shown.current, ahead.current]) if (job) drop(job)
    shown.current = ahead.current = null
    setBatch(null)
    setProgress(null)
  }

  return { batch, progress, load, clear }
}
