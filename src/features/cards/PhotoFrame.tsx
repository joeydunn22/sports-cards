import type { ReactNode } from 'react'
import type { Pixels } from '../../lib/cardDetect'

/** Fits a photo being edited into the width and 60% of the screen height, keeping its shape. */
export function PhotoFrame({ pixels, children }: { pixels: Pixels; children: ReactNode }) {
  const { width, height } = pixels
  return (
    <div
      className="relative mx-auto"
      style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc(60dvh * ${width / height}))` }}
    >
      {children}
    </div>
  )
}
