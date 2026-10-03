import type { Box } from '../../lib/cardDetect'

type CropPreviewProps = { url: string; box: Box; width: number; height: number; className?: string }

/** Shows just one card's area of a photo, using CSS instead of re-encoding the image. */
export function CropPreview({ url, box, width, height, className = '' }: CropPreviewProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-slate-800 ${className}`}
      style={{ aspectRatio: `${box.w * width} / ${box.h * height}` }}
    >
      <img
        src={url}
        alt=""
        className="absolute max-w-none"
        style={{
          width: `${100 / box.w}%`,
          height: `${100 / box.h}%`,
          left: `${(-box.x / box.w) * 100}%`,
          top: `${(-box.y / box.h) * 100}%`,
        }}
      />
    </div>
  )
}
