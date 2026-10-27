import type { Pixels } from './cardDetect'
import { autoTouchUp } from './photoEdit'

/**
 * The automatic touch-up (trim and straighten, glare, lighting) in a web worker: about a second per photo on a
 * phone, which would otherwise freeze the screen. Falls back to running in place where workers aren't
 * available (tests, or a browser that can't load one).
 */

type Options = Parameters<typeof autoTouchUp>[1]
type Result = ReturnType<typeof autoTouchUp>
export type TouchUpRequest = { id: number; pixels: Pixels; options: Options }
export type TouchUpReply = ({ id: number } & Result) | { id: number; error: string }

type Waiting = { pixels: Pixels; options: Options; resolve: (r: Result) => void; reject: (e: Error) => void }

let worker: Worker | null | undefined
const waiting = new Map<number, Waiting>()
let nextId = 0

/** Lets the "working" state paint before the main thread is busy. */
const inPlace = (pixels: Pixels, options: Options) =>
  new Promise<Result>((resolve) => setTimeout(resolve, 30)).then(() => autoTouchUp(pixels, options))

function getWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    worker = typeof Worker === 'undefined' ? null : new Worker(new URL('./touchUpWorker.ts', import.meta.url), { type: 'module' })
  } catch {
    worker = null
  }
  worker?.addEventListener('message', ({ data }: MessageEvent<TouchUpReply>) => {
    const job = waiting.get(data.id)
    waiting.delete(data.id)
    if ('error' in data) job?.reject(new Error(data.error))
    else job?.resolve(data)
  })
  // The worker couldn't load: run what was sent to it, and everything after, in place.
  worker?.addEventListener('error', () => {
    worker?.terminate()
    worker = null
    for (const job of waiting.values()) inPlace(job.pixels, job.options).then(job.resolve, job.reject)
    waiting.clear()
  })
  return worker
}

/** `autoTouchUp` without blocking the screen. The pixels passed in are left as they are. */
export function touchUpInBackground(pixels: Pixels, options: Options): Promise<Result> {
  const w = getWorker()
  if (!w) return inPlace(pixels, options)
  return new Promise((resolve, reject) => {
    const id = nextId++
    waiting.set(id, { pixels, options, resolve, reject })
    w.postMessage({ id, pixels, options } satisfies TouchUpRequest) // copied, not transferred: the caller keeps its pixels
  })
}
