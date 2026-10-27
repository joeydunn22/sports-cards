import { useRef, useState, type PointerEvent } from 'react'

const MAX_SCALE = 4
const DOUBLE_TAP_MS = 300

type View = { scale: number; x: number; y: number }
const FIT: View = { scale: 1, x: 0, y: 0 }

/**
 * An image you can pinch to zoom, drag when zoomed and double-tap to zoom in or back out. Done by hand
 * with pointer events, since the installed app turns off the browser's own page zoom.
 */
export function ZoomImage({ src, alt = '' }: { src: string; alt?: string }) {
  const [view, setView] = useState<View>(FIT)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ dist: number; view: View; mid: { x: number; y: number } } | null>(null)
  const lastTap = useRef(0)
  // While a finger is down the image follows it exactly; on release it eases.
  const [touching, setTouching] = useState(false)

  const clamp = (v: View): View => {
    const scale = Math.min(MAX_SCALE, Math.max(1, v.scale))
    return scale === 1 ? FIT : { scale, x: v.x, y: v.y }
  }

  function down(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    gesture.current = null
    if (pointers.current.size === 1) {
      const now = Date.now()
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        const box = e.currentTarget.getBoundingClientRect()
        // Zoom in on the tapped spot, or back out.
        setView((v) =>
          v.scale > 1
            ? FIT
            : { scale: 2.5, x: (box.left + box.width / 2 - e.clientX) * 1.5, y: (box.top + box.height / 2 - e.clientY) * 1.5 },
        )
        lastTap.current = 0
      } else lastTap.current = now
    }
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    if (!touching) setTouching(true)
    const points = pointers.current
    points.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (points.size === 2) {
      const [a, b] = [...points.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      if (!gesture.current) gesture.current = { dist, view, mid }
      const g = gesture.current
      setView(
        clamp({
          scale: (g.view.scale * dist) / g.dist,
          x: g.view.x + mid.x - g.mid.x,
          y: g.view.y + mid.y - g.mid.y,
        }),
      )
    } else if (points.size === 1 && view.scale > 1) {
      setView((v) => ({ ...v, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y }))
    }
  }

  function up(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    gesture.current = null
    if (pointers.current.size === 0) setTouching(false)
  }

  return (
    <div
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onClick={(e) => e.stopPropagation()}
      className="grid size-full touch-none place-items-center overflow-hidden select-none"
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={`max-h-full max-w-full object-contain ${touching ? '' : 'transition-transform duration-200'}`}
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      />
    </div>
  )
}
