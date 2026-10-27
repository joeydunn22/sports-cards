import { touchUpInBackground } from './backgroundTouchUp'
import { detectCards, padBox, type Box, type Pixels } from './cardDetect'

/**
 * Photo handling in the browser: decoding camera photos, finding cards in them, and cutting each card
 * out at full resolution. Storage layout: `{user_id}/{photo_id}-{front|back}.{webp|jpg}` in the
 * private `card-photos` bucket, with a `-thumb` copy next to each photo. A `-flat` before the extension
 * marks a photo already straightened to the card, so the automatic touch-up doesn't straighten it again;
 * `-auto` after it marks a photo that had the whole automatic touch-up when it was taken, so a card saved
 * with such photos skips the touch-up page.
 */

export const PHOTO_BUCKET = 'card-photos'

/** Long edge of the stored photo: sharp enough for the AI to read fine print on one card. */
export const PHOTO_MAX_EDGE = 1600
const THUMB_MAX_EDGE = 320
/** Long edge of the copy used for detection; more pixels don't help find rectangles. */
const DETECT_MAX_EDGE = 800
/** Extra margin around each detected card so edges aren't clipped. */
const CROP_MARGIN = 0.04
/** Wider cut for straightening, so the corners are surely inside; straightening trims it off again. */
const STRAIGHTEN_MARGIN = 0.08

export type Side = 'front' | 'back'

export function photoPath(userId: string, photoId: string, side: Side, ext: 'webp' | 'jpg', flat = false, auto = false): string {
  return `${userId}/${photoId}-${side}${flat ? '-flat' : ''}${auto ? '-auto' : ''}.${ext}`
}

/** Was this photo saved already straightened to the card? */
export function isFlatPhoto(path: string): boolean {
  return /-flat(-auto)?\.\w+$/.test(path)
}

/** Did this photo have the automatic touch-up (trim, glare, lighting) when it was taken? */
export function isAutoPhoto(path: string): boolean {
  return /-auto\.\w+$/.test(path)
}

/** A card's photos have all been touched up already: it can skip the touch-up page. */
export function photosDone(front: string | null, back: string | null): boolean {
  return Boolean(front || back) && [front, back].every((p) => !p || isAutoPhoto(p))
}

/** `abc/123-front.webp` → `abc/123-front-thumb.webp` */
export function thumbPath(path: string): string {
  const dot = path.lastIndexOf('.')
  return dot === -1 ? `${path}-thumb` : `${path.slice(0, dot)}-thumb${path.slice(dot)}`
}

/** Decodes a photo with its camera rotation applied (browsers honor EXIF orientation for <img>). */
export async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    // The decoded bitmap stays usable after the URL is released.
    URL.revokeObjectURL(url)
  }
}

function canvas(width: number, height: number) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(width))
  c.height = Math.max(1, Math.round(height))
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  return { canvas: c, ctx }
}

/** Finds the cards in a photo; boxes are normalized (0..1) and already in reading order. */
export function findCards(img: HTMLImageElement): Box[] {
  const scale = Math.min(1, DETECT_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
  const { ctx, canvas: c } = canvas(img.naturalWidth * scale, img.naturalHeight * scale)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
  return detectCards({ data, width, height })
}

export type EncodedImage = { blob: Blob; ext: 'webp' | 'jpg' }

async function encode(c: HTMLCanvasElement, quality: number): Promise<EncodedImage> {
  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => c.toBlob(resolve, type, quality))
  // Older iOS Safari can't encode WebP and silently returns PNG; fall back to JPEG then.
  const webp = await toBlob('image/webp')
  if (webp?.type === 'image/webp') return { blob: webp, ext: 'webp' }
  const jpeg = await toBlob('image/jpeg')
  if (!jpeg) throw new Error('Could not encode the photo.')
  return { blob: jpeg, ext: 'jpg' }
}

/**
 * `flat`: straightened to the card (stored with the `-flat` marker). `auto`: had the whole automatic touch-up
 * when it was taken (`-auto`).
 */
export type CardCrop = { photo: EncodedImage; thumb: EncodedImage; flat: boolean; auto?: boolean }

/**
 * Cuts one card out of the full-resolution photo and gives it the whole automatic touch-up: straightened to the
 * card when its corners are found for sure (otherwise the plain box), glare filled and lighting fixed. Makes the
 * stored photo plus a thumbnail.
 */
export async function cropCard(img: HTMLImageElement, box: Box): Promise<CardCrop> {
  const wide = await touchUpInBackground(canvasPixels(cut(img, padBox(box, STRAIGHTEN_MARGIN))), {
    straighten: true,
    maxEdge: PHOTO_MAX_EDGE,
  })
  if (wide.changes.includes('straightened')) return { ...(await finishPhoto(drawPixels(wide.pixels), true)), auto: true }
  // No card edges found for sure: the plain box, with the glare and lighting fixed on that.
  const plain = await touchUpInBackground(canvasPixels(cut(img, padBox(box, CROP_MARGIN))), {
    straighten: false,
    maxEdge: PHOTO_MAX_EDGE,
  })
  return { ...(await finishPhoto(drawPixels(plain.pixels), false)), auto: true }
}

/** The part of the photo inside a box, at most PHOTO_MAX_EDGE on the long side. */
function cut(img: HTMLImageElement, b: Box): HTMLCanvasElement {
  const sx = b.x * img.naturalWidth
  const sy = b.y * img.naturalHeight
  const sw = b.w * img.naturalWidth
  const sh = b.h * img.naturalHeight
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(sw, sh))
  const full = canvas(sw * scale, sh * scale)
  full.ctx.drawImage(img, sx, sy, sw, sh, 0, 0, full.canvas.width, full.canvas.height)
  return full.canvas
}

/** Encodes a card photo (already at most PHOTO_MAX_EDGE) plus its thumbnail. */
export async function finishPhoto(full: HTMLCanvasElement, flat: boolean): Promise<CardCrop> {
  const photo = await encode(full, 0.88)
  const thumbScale = Math.min(1, THUMB_MAX_EDGE / Math.max(full.width, full.height))
  const small = canvas(full.width * thumbScale, full.height * thumbScale)
  small.ctx.drawImage(full, 0, 0, small.canvas.width, small.canvas.height)
  const thumb = await encode(small.canvas, 0.8)
  return { photo, thumb, flat }
}

function canvasPixels(c: HTMLCanvasElement): Pixels {
  const { data, width, height } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
  return { data, width, height }
}

/** Raw pixels of an image, scaled down to at most `maxEdge` on the long side. */
export function imagePixels(img: HTMLImageElement | HTMLCanvasElement, maxEdge = PHOTO_MAX_EDGE): Pixels {
  const w = img instanceof HTMLImageElement ? img.naturalWidth : img.width
  const h = img instanceof HTMLImageElement ? img.naturalHeight : img.height
  const scale = Math.min(1, maxEdge / Math.max(w, h))
  const { ctx, canvas: c } = canvas(w * scale, h * scale)
  ctx.drawImage(img, 0, 0, c.width, c.height)
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
  return { data, width, height }
}

/** Draws raw pixels onto a canvas (a new one unless `target` is given). */
export function drawPixels(pixels: Pixels, target?: HTMLCanvasElement): HTMLCanvasElement {
  const c = target ?? document.createElement('canvas')
  c.width = pixels.width
  c.height = pixels.height
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  const image = ctx.createImageData(pixels.width, pixels.height)
  image.data.set(pixels.data)
  ctx.putImageData(image, 0, 0)
  return c
}
