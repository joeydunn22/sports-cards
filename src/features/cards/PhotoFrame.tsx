import type { ReactNode } from 'react'
import type { Pixels } from '../../lib/cardDetect'

type PhotoFrameProps = { pixels: Pixels; children: ReactNode; maxHeight?: string }

/** Fits a photo being edited into the width and `maxHeight` (60% of the screen), keeping its shape. */
export function PhotoFrame({ pixels, children, maxHeight = '60dvh' }: PhotoFrameProps) {
  const { width, height } = pixels
  return (
    <div
      className="relative mx-auto"
      style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc(${maxHeight} * ${width / height}))` }}
    >
      {children}
    </div>
  )
}
