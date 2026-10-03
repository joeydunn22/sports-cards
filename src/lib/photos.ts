import { detectCards, padBox, type Box } from './cardDetect'

/**
 * Photo handling in the browser: decoding camera photos, finding cards in them, and cutting each card
 * out at full resolution. Storage layout: `{user_id}/{photo_id}-{front|back}.{webp|jpg}` in the
 * private `card-photos` bucket, with a `-thumb` copy next to each photo.
 */

export const PHOTO_BUCKET = 'card-photos'

/** Long edge of the stored photo: sharp enough for the AI to read fine print on one card. */
const PHOTO_MAX_EDGE = 1600
const THUMB_MAX_EDGE = 320
/** Long edge of the copy used for detection; more pixels don't help find rectangles. */
const DETECT_MAX_EDGE = 800
/** Extra margin around each detected card so edges aren't clipped. */
const CROP_MARGIN = 0.04

export type Side = 'front' | 'back'

export function photoPath(userId: string, photoId: string, side: Side, ext: 'webp' | 'jpg'): string {
  return `${userId}/${photoId}-${side}.${ext}`
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

export type CardCrop = { photo: EncodedImage; thumb: EncodedImage }

/** Cuts one card out of the full-resolution photo and makes the stored photo plus a thumbnail. */
export async function cropCard(img: HTMLImageElement, box: Box): Promise<CardCrop> {
  const b = padBox(box, CROP_MARGIN)
  const sx = b.x * img.naturalWidth
  const sy = b.y * img.naturalHeight
  const sw = b.w * img.naturalWidth
  const sh = b.h * img.naturalHeight

  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(sw, sh))
  const full = canvas(sw * scale, sh * scale)
  full.ctx.drawImage(img, sx, sy, sw, sh, 0, 0, full.canvas.width, full.canvas.height)
  const photo = await encode(full.canvas, 0.88)

  const thumbScale = Math.min(1, THUMB_MAX_EDGE / Math.max(full.canvas.width, full.canvas.height))
  const small = canvas(full.canvas.width * thumbScale, full.canvas.height * thumbScale)
  small.ctx.drawImage(full.canvas, 0, 0, small.canvas.width, small.canvas.height)
  const thumb = await encode(small.canvas, 0.8)

  return { photo, thumb }
}
