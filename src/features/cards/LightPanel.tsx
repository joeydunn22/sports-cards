import { useEffect, useMemo, useRef, useState } from 'react'
import { buttonPrimary, buttonSecondary } from '../../components/ui'
import type { Pixels } from '../../lib/cardDetect'
import { downscale } from '../../lib/photoEdit'
import { adjustLight, NO_ADJUST, type LightAdjust } from '../../lib/photoLight'
import { drawPixels } from '../../lib/photos'
import { PhotoFrame } from './PhotoFrame'

/** The live preview is drawn from a copy this size, so the sliders keep up on a phone. */
const PREVIEW_EDGE = 700

const SLIDERS: { key: keyof LightAdjust; label: string; min: number; low: string; high: string }[] = [
  { key: 'brightness', label: 'Brightness', min: -100, low: 'Darker', high: 'Brighter' },
  { key: 'contrast', label: 'Contrast', min: -100, low: 'Softer', high: 'Punchier' },
  { key: 'warmth', label: 'Warmth', min: -100, low: 'Cooler', high: 'Warmer' },
  { key: 'sharpness', label: 'Sharpness', min: 0, low: '', high: 'Sharper' },
]

type LightPanelProps = { pixels: Pixels; busy: boolean; onApply: (adjust: LightAdjust) => void }

/** Adjusting by hand: brightness, contrast, warmth and sharpness with a live preview, then Apply. */
export function LightPanel({ pixels, busy, onApply }: LightPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const preview = useMemo(() => downscale(pixels, PREVIEW_EDGE), [pixels])
  // The sliders belong to the photo they were set on; a new photo (after Apply or Undo) starts at zero.
  const [setting, setSetting] = useState<{ on: Pixels; adjust: LightAdjust } | null>(null)
  const adjust = setting?.on === pixels ? setting.adjust : NO_ADJUST
  const changed = SLIDERS.some(({ key }) => adjust[key] !== 0)

  useEffect(() => {
    if (canvasRef.current) drawPixels(changed ? adjustLight(preview, adjust) : preview, canvasRef.current)
  }, [preview, adjust, changed])

  return (
    <>
      {/* Smaller than the other tools, so the sliders fit on screen with the photo they change. */}
      <div className="py-3">
        <PhotoFrame pixels={pixels} maxHeight="40dvh">
          <canvas ref={canvasRef} className="block size-full rounded-md" />
        </PhotoFrame>
      </div>
      <div className="flex flex-col gap-1">
        {SLIDERS.map(({ key, label, min, low, high }) => (
          <label key={key} className="flex min-h-11 items-center gap-3 text-sm text-slate-300">
            <span className="w-20 shrink-0">{label}</span>
            <input
              type="range"
              min={min}
              max={100}
              step={5}
              value={adjust[key]}
              aria-valuetext={adjust[key] === 0 ? 'unchanged' : `${adjust[key] < 0 ? low : high} ${Math.abs(adjust[key])}`}
              onChange={(e) => setSetting({ on: pixels, adjust: { ...adjust, [key]: Number(e.target.value) } })}
              className="flex-1 accent-sky-500"
            />
            <span className="w-9 shrink-0 text-right text-xs text-slate-500 tabular-nums">
              {adjust[key] > 0 ? '+' : ''}
              {adjust[key]}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!changed || busy}
          onClick={() => setSetting(null)}
          className={`${buttonSecondary} flex-1`}
        >
          Reset
        </button>
        <button type="button" disabled={!changed || busy} onClick={() => onApply(adjust)} className={`${buttonPrimary} flex-[2]`}>
          {busy ? 'Applying…' : 'Apply'}
        </button>
      </div>
    </>
  )
}
