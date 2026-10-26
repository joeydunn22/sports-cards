import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { Pixels } from '../../lib/cardDetect'
import type { Point, Quad } from '../../lib/photoEdit'
import { drawPixels } from '../../lib/photos'
import { PhotoFrame } from './PhotoFrame'

const CORNERS = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left']
const LOUPE_SIZE = 112
const LOUPE_ZOOM = 3

const clamp = (v: number) => Math.min(Math.max(v, 0), 1)

type CornerEditorProps = { pixels: Pixels; quad: Quad; onChange: (quad: Quad) => void }

/** The photo with four draggable corner handles, and a magnifier while dragging since a finger hides the corner. */
export function CornerEditor({ pixels, quad, onChange }: CornerEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loupeRef = useRef<HTMLCanvasElement>(null)
  // Offset between the finger and the corner, so a handle doesn't jump when grabbed off-centre.
  const drag = useRef<{ index: number; dx: number; dy: number } | null>(null)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    if (canvasRef.current) drawPixels(pixels, canvasRef.current)
  }, [pixels])

  useEffect(() => {
    const src = canvasRef.current
    const ctx = loupeRef.current?.getContext('2d')
    if (active === null || !src || !ctx) return
    const shown = src.getBoundingClientRect().width / pixels.width
    const side = LOUPE_SIZE / LOUPE_ZOOM / shown
    const { x, y } = quad[active]
    ctx.fillStyle = '#020617'
    ctx.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE)
    ctx.drawImage(src, x * pixels.width - side / 2, y * pixels.height - side / 2, side, side, 0, 0, LOUPE_SIZE, LOUPE_SIZE)
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(LOUPE_SIZE / 2, 0)
    ctx.lineTo(LOUPE_SIZE / 2, LOUPE_SIZE)
    ctx.moveTo(0, LOUPE_SIZE / 2)
    ctx.lineTo(LOUPE_SIZE, LOUPE_SIZE / 2)
    ctx.stroke()
  }, [active, quad, pixels])

  function pointer(e: PointerEvent): Point {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
  }

  function grab(index: number, e: PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = pointer(e)
    drag.current = { index, dx: quad[index].x - p.x, dy: quad[index].y - p.y }
    setActive(index)
  }

  function move(e: PointerEvent) {
    if (!drag.current) return
    const { index, dx, dy } = drag.current
    const p = pointer(e)
    const next = [...quad] as Quad
    next[index] = { x: clamp(p.x + dx), y: clamp(p.y + dy) }
    onChange(next)
  }

  function release() {
    drag.current = null
    setActive(null)
  }

  return (
    <div className="relative p-5 select-none">
      <PhotoFrame pixels={pixels}>
        <canvas ref={canvasRef} className="block size-full rounded-md" />
        <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1 1" preserveAspectRatio="none">
          <polygon
            points={quad.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="rgb(14 165 233 / 0.12)"
            stroke="#38bdf8"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {quad.map((p, i) => (
          <button
            key={CORNERS[i]}
            type="button"
            aria-label={`${CORNERS[i]} corner`}
            onPointerDown={(e) => grab(i, e)}
            onPointerMove={move}
            onPointerUp={release}
            onPointerCancel={release}
            className="absolute size-11 -translate-x-1/2 -translate-y-1/2 touch-none"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          >
            <span className="absolute inset-3 rounded-full border-2 border-sky-400 bg-sky-400/30" />
          </button>
        ))}
      </PhotoFrame>
      {active !== null && (
        <canvas
          ref={loupeRef}
          width={LOUPE_SIZE}
          height={LOUPE_SIZE}
          aria-hidden
          className={`pointer-events-none absolute top-0 ${quad[active].x < 0.5 ? 'right-0' : 'left-0'} rounded-full border-2 border-sky-400 shadow-lg shadow-black/60`}
          style={{ width: LOUPE_SIZE, height: LOUPE_SIZE }}
        />
      )}
    </div>
  )
}
