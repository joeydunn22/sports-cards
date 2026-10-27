import type { Pixels } from './cardDetect'
import { autoTouchUp } from './photoEdit'

/**
 * The automatic touch-up (trim and straighten, glare, lighting) in web workers: about a second per photo on a
 * phone, which would otherwise freeze the screen. A few workers, so capture can fix several cards at once. Falls
 * back to running in place where workers aren't available (tests, or a browser that can't load one).
 */

type Options = Parameters<typeof autoTouchUp>[1]
type Result = ReturnType<typeof autoTouchUp>
export type TouchUpRequest = { id: number; pixels: Pixels; options: Options }
export type TouchUpReply = ({ id: number } & Result) | { id: number; error: string }

type Waiting = { pixels: Pixels; options: Options; resolve: (r: Result) => void; reject: (e: Error) => void }
type Slot = { worker: Worker; waiting: Map<number, Waiting> }

/** Photos worked on at once: a core is left for the screen, and each photo in flight holds about 15 MB. */
export const TOUCH_UP_PARALLEL = Math.min(3, Math.max(1, (globalThis.navigator?.hardwareConcurrency ?? 2) - 1))

let pool: Slot[] | null = null
let nextId = 0

/** Lets the "working" state paint before the main thread is busy. */
const inPlace = (pixels: Pixels, options: Options) =>
  new Promise<Result>((resolve) => setTimeout(resolve, 30)).then(() => autoTouchUp(pixels, options))

function startWorker(): Slot | null {
  let worker: Worker
  try {
    if (typeof Worker === 'undefined') return null
    worker = new Worker(new URL('./touchUpWorker.ts', import.meta.url), { type: 'module' })
  } catch {
    return null
  }
  const slot: Slot = { worker, waiting: new Map() }
  worker.addEventListener('message', ({ data }: MessageEvent<TouchUpReply>) => {
    const job = slot.waiting.get(data.id)
    slot.waiting.delete(data.id)
    if ('error' in data) job?.reject(new Error(data.error))
    else job?.resolve(data)
  })
  // The worker couldn't load: run what was sent to it in place, and stop sending it more.
  worker.addEventListener('error', () => {
    worker.terminate()
    pool = pool?.filter((s) => s !== slot) ?? null
    for (const job of slot.waiting.values()) inPlace(job.pixels, job.options).then(job.resolve, job.reject)
    slot.waiting.clear()
  })
  return slot
}

/** `autoTouchUp` without blocking the screen. The pixels passed in are left as they are. */
export function touchUpInBackground(pixels: Pixels, options: Options): Promise<Result> {
  pool ??= Array.from({ length: TOUCH_UP_PARALLEL }, startWorker).filter((s): s is Slot => s !== null)
  if (pool.length === 0) return inPlace(pixels, options)
  const slot = pool.reduce((a, b) => (b.waiting.size < a.waiting.size ? b : a))
  return new Promise((resolve, reject) => {
    const id = nextId++
    slot.waiting.set(id, { pixels, options, resolve, reject })
    slot.worker.postMessage({ id, pixels, options } satisfies TouchUpRequest) // copied, not transferred: the caller keeps its pixels
  })
}
