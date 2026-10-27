import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { buttonPrimary, buttonSecondary } from '../../components/ui'
import type { Pixels } from '../../lib/cardDetect'
import type { Point } from '../../lib/photoEdit'
import { drawPixels } from '../../lib/photos'
import { PhotoFrame } from './PhotoFrame'

type TouchUpCanvasProps = { pixels: Pixels; busy: boolean; onFill: (mask: Uint8Array) => void }

/** Paint over glare spots on the photo; Fill hands the painted mask (one byte per pixel) to the caller. */
export function TouchUpCanvas({ pixels, busy, onFill }: TouchUpCanvasProps) {
  const imageRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<HTMLCanvasElement>(null)
  const last = useRef<Point | null>(null)
  const [brush, setBrush] = useState(24)
  // The photo the current mask was painted on; a new photo (after a fill, undo or straighten) starts clean.
  const [paintedOn, setPaintedOn] = useState<Pixels | null>(null)
  const painted = paintedOn === pixels

  useEffect(() => {
    if (imageRef.current) drawPixels(pixels, imageRef.current)
    const mask = maskRef.current
    if (mask) {
      mask.width = pixels.width // resizing also clears it
      mask.height = pixels.height
    }
  }, [pixels])

  function paint(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const scale = pixels.width / rect.width // brush size is in screen pixels
    const p = { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale }
    ctx.fillStyle = ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = brush * scale
    ctx.lineCap = ctx.lineJoin = 'round'
    if (last.current) {
      ctx.beginPath()
      ctx.moveTo(last.current.x, last.current.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(p.x, p.y, (brush * scale) / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    last.current = p
    setPaintedOn(pixels)
  }

  function clear() {
    const mask = maskRef.current
    mask?.getContext('2d')?.clearRect(0, 0, mask.width, mask.height)
    setPaintedOn(null)
  }

  function fill() {
    const ctx = maskRef.current?.getContext('2d')
    if (!ctx) return
    const { data } = ctx.getImageData(0, 0, pixels.width, pixels.height)
    const mask = new Uint8Array(pixels.width * pixels.height)
    for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 0 ? 1 : 0
    onFill(mask)
  }

  return (
    <>
      <div className="p-5">
        <PhotoFrame pixels={pixels}>
          <canvas ref={imageRef} className="block size-full rounded-md" />
          <canvas
            ref={maskRef}
            aria-label="Paint over glare"
            className="absolute inset-0 size-full touch-none opacity-50"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              last.current = null
              paint(e)
            }}
            onPointerMove={(e) => e.buttons && paint(e)}
            onPointerUp={() => (last.current = null)}
            onPointerCancel={() => (last.current = null)}
          />
        </PhotoFrame>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm text-ink-300">
        Brush
        <input
          type="range"
          min={10}
          max={60}
          value={brush}
          onChange={(e) => setBrush(Number(e.target.value))}
          className="flex-1 accent-accent-500"
        />
        <span
          aria-hidden
          className="shrink-0 rounded-full bg-red-500/50"
          style={{ width: brush * 0.6, height: brush * 0.6 }}
        />
      </label>
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={!painted || busy} onClick={clear} className={`${buttonSecondary} flex-1`}>
          Clear
        </button>
        <button type="button" disabled={!painted || busy} onClick={fill} className={`${buttonPrimary} flex-[2]`}>
          {busy ? 'Filling…' : 'Fill'}
        </button>
      </div>
    </>
  )
}
