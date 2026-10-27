import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'
import { buttonPrimary, buttonSecondary } from '../../components/ui'
import type { Pixels } from '../../lib/cardDetect'
import { CHANGE_LABELS, type TouchUpChange } from '../../lib/photoEdit'
import { drawPixels } from '../../lib/photos'
import { PhotoFrame } from './PhotoFrame'

type AutoFixPanelProps = {
  pixels: Pixels
  original: Pixels
  /** What the last Auto fix changed, while its result is the photo shown; [] when it found nothing to fix. */
  changes: TouchUpChange[] | null
  busy: boolean
  onAuto: () => void
}

/** The editor's main view: the photo, press-and-hold to see the original, and one button that does every fix. */
export function AutoFixPanel({ pixels, original, changes, busy, onAuto }: AutoFixPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [comparing, setComparing] = useState(false)
  const edited = pixels !== original
  const shown = comparing && edited ? original : pixels
  const fixed = changes !== null && changes.length > 0

  useEffect(() => {
    if (canvasRef.current) drawPixels(shown, canvasRef.current)
  }, [shown])

  return (
    <>
      <div className="py-3">
        <PhotoFrame pixels={shown} maxHeight="52dvh">
          <canvas ref={canvasRef} className="block size-full rounded-md" />
          {edited && (
            <span className="pointer-events-none absolute top-1.5 left-1.5 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-200">
              {comparing ? 'Original' : 'Edited'}
            </span>
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center rounded-md bg-slate-950/50">
              <span className="flex items-center gap-2 rounded-full bg-slate-950/90 px-4 py-2 text-sm font-medium">
                <span className="size-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                Fixing…
              </span>
            </div>
          )}
        </PhotoFrame>
      </div>
      {changes && (
        <p className={`mb-2 flex items-center gap-1.5 text-sm ${fixed ? 'text-emerald-300' : 'text-slate-400'}`}>
          {fixed && <Icon name="check" size={16} className="shrink-0" />}
          {fixed ? changes.map((c) => CHANGE_LABELS[c]).join(' · ') : 'Nothing to fix: this photo already looks good.'}
        </p>
      )}
      <div className="flex gap-2">
        {/* Once Auto fix has run, Save is the next step; Undo brings the button back. */}
        {!changes && (
          <button type="button" disabled={busy} onClick={onAuto} className={`${buttonPrimary} min-h-12 flex-[2] text-base`}>
            <Icon name="sparkle" size={20} />
            {busy ? 'Fixing…' : 'Auto fix'}
          </button>
        )}
        {edited && (
          <button
            type="button"
            onPointerDown={() => setComparing(true)}
            onPointerUp={() => setComparing(false)}
            onPointerLeave={() => setComparing(false)}
            onPointerCancel={() => setComparing(false)}
            onContextMenu={(e) => e.preventDefault()}
            className={`${buttonSecondary} min-h-12 flex-1 select-none [-webkit-touch-callout:none]`}
          >
            Hold to compare
          </button>
        )}
      </div>
      {!changes && (
        <p className="mt-2 text-center text-xs text-slate-500">Crops to the card, fills glare and fixes the lighting in one tap.</p>
      )}
    </>
  )
}
