import { autoTouchUp } from './photoEdit'
import type { TouchUpReply, TouchUpRequest } from './backgroundTouchUp'

/** Runs the automatic touch-up off the main thread (see backgroundTouchUp.ts), so the screen keeps responding. */
self.onmessage = ({ data: { id, pixels, options } }: MessageEvent<TouchUpRequest>) => {
  let reply: TouchUpReply
  try {
    reply = { id, ...autoTouchUp(pixels, options) }
  } catch (e) {
    reply = { id, error: e instanceof Error ? e.message : String(e) }
  }
  self.postMessage(reply, { transfer: 'pixels' in reply ? [reply.pixels.data.buffer] : [] })
}
