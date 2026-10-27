import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Icon } from '../../components/Icon'
import { buttonPrimary, buttonSecondary } from '../../components/ui'
import { useCards, useReplaceCardPhoto } from '../../hooks/useCards'
import { usePhotoImage } from '../../hooks/usePhotos'
import { touchUpInBackground } from '../../lib/backgroundTouchUp'
import type { Pixels } from '../../lib/cardDetect'
import {
  fillGlare,
  FULL_FRAME,
  findCardCorners,
  outputSize,
  rotateQuad,
  rotateQuarter,
  warpPerspective,
  type Quad,
  type TouchUpChange,
} from '../../lib/photoEdit'
import { adjustLight } from '../../lib/photoLight'
import { drawPixels, finishPhoto, imagePixels, isFlatPhoto, PHOTO_MAX_EDGE, type Side } from '../../lib/photos'
import type { Card } from '../../types/card'
import { AutoFixPanel } from './AutoFixPanel'
import { cardTitle } from './cardText'
import { CornerEditor } from './CornerEditor'
import { LightPanel } from './LightPanel'
import { TouchUpCanvas } from './TouchUpCanvas'

/** Auto does everything in one tap; the others fix by hand what it didn't get right. */
type Mode = 'auto' | 'crop' | 'glare' | 'light'
const MODES: { mode: Mode; label: string }[] = [
  { mode: 'auto', label: 'Auto' },
  { mode: 'crop', label: 'Crop' },
  { mode: 'glare', label: 'Glare' },
  { mode: 'light', label: 'Light' },
]
/** Each step keeps a full copy of the photo (about 7 MB), so undo stops after this many. */
const UNDO_LIMIT = 8

/**
 * `flat`: the photo is straightened to the card (saved with the `-flat` marker). `changes`: this step is an
 * Auto fix result, with what it changed ([] when it found nothing to change).
 */
type Step = { pixels: Pixels; flat: boolean; changes: TouchUpChange[] | null }

const isFullFrame = (quad: Quad) => quad.every((p, i) => p.x === FULL_FRAME[i].x && p.y === FULL_FRAME[i].y)

/** Starting corners: the card's edges if found; a straightened photo already is the card, so its own corners. */
const suggestCorners = ({ pixels, flat }: Step): Quad => (flat ? FULL_FRAME : findCardCorners(pixels))

export function PhotoEditorPage() {
  const { id, side } = useParams()
  const { data, isPending } = useCards()
  const card = data?.find((c) => c.id === id)
  const s: Side | null = side === 'front' || side === 'back' ? side : null
  const path = card && s ? (s === 'front' ? card.front_image_path : card.back_image_path) : null
  const image = usePhotoImage(path)

  if (isPending) return <p className="p-6 text-slate-400">Loading…</p>
  if (!card || !s || !path) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-slate-300">That photo doesn’t exist (the card may have been deleted).</p>
        <Link to={card ? `/cards/${card.id}` : '/'} className={`${buttonSecondary} mt-4`}>
          Back
        </Link>
      </main>
    )
  }
  if (image.isError) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-red-300">Couldn’t load the photo: {image.error.message}</p>
        <Link to={`/cards/${card.id}`} className={`${buttonSecondary} mt-4`}>
          Back to card
        </Link>
      </main>
    )
  }
  if (!image.data) return <p className="p-6 text-slate-400">Loading photo…</p>
  return <PhotoEditor key={path} card={card} side={s} path={path} image={image.data} />
}

type PhotoEditorProps = { card: Card; side: Side; path: string; image: HTMLImageElement }

function PhotoEditor({ card, side, path, image }: PhotoEditorProps) {
  const navigate = useNavigate()
  const replace = useReplaceCardPhoto()
  const original = useMemo<Step>(() => ({ pixels: imagePixels(image), flat: isFlatPhoto(path), changes: null }), [image, path])
  const [current, setCurrent] = useState<Step>(original)
  const [history, setHistory] = useState<Step[]>([])
  const [mode, setMode] = useState<Mode>('auto')
  // Corners dragged by hand belong to the photo they were set on; a new photo starts from the suggestion.
  const [corners, setCorners] = useState<{ on: Pixels; quad: Quad } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const edited = current.pixels !== original.pixels
  const backTo = `/cards/${card.id}`

  // Only worked out once the Crop tab is open: finding the edges takes a moment.
  const suggested = useMemo(() => (mode === 'crop' ? suggestCorners(current) : null), [mode, current])
  const moved = corners?.on === current.pixels
  const quad = moved ? corners.quad : (suggested ?? FULL_FRAME)

  // Warn before a reload or tab close throws away an unsaved edit.
  useEffect(() => {
    if (!edited || replace.isSuccess) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [edited, replace.isSuccess])

  function push(next: Step) {
    setHistory((h) => [...h, current].slice(-UNDO_LIMIT))
    setCurrent(next)
  }

  /** Runs a heavy pixel step after the "working" state has painted. */
  function run(step: () => Step) {
    setBusy(true)
    setError(null)
    setTimeout(() => {
      try {
        push(step())
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    }, 30)
  }

  /** Trim and straighten (unless already straight), glare, lighting: the same pass as the automatic touch-up. */
  async function autoFix() {
    setBusy(true)
    setError(null)
    try {
      const { pixels, changes } = await touchUpInBackground(current.pixels, {
        straighten: !current.flat,
        maxEdge: PHOTO_MAX_EDGE,
      })
      push({ pixels, flat: current.flat || changes.includes('straightened'), changes })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function straighten() {
    run(() => {
      const size = outputSize(quad, current.pixels.width, current.pixels.height, PHOTO_MAX_EDGE)
      setMode('auto') // shows the result, with Auto fix for the glare and lighting
      return { pixels: warpPerspective(current.pixels, quad, size.width, size.height), flat: true, changes: null }
    })
  }

  function rotate() {
    run(() => {
      const pixels = rotateQuarter(current.pixels)
      setCorners({ on: pixels, quad: rotateQuad(quad) })
      return { ...current, pixels, changes: null }
    })
  }

  function undo() {
    const previous = history.at(-1)
    if (!previous) return
    setHistory((h) => h.slice(0, -1))
    setCurrent(previous)
  }

  function cancel() {
    if (edited && !window.confirm('Discard your changes to this photo?')) return
    navigate(backTo)
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const crop = await finishPhoto(drawPixels(current.pixels), current.flat)
      await replace.mutateAsync({ card, side, crop })
      navigate(backTo)
    } catch (e) {
      setError(`Couldn’t save: ${e instanceof Error ? e.message : String(e)}`)
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-[env(safe-area-inset-top)] pb-28 md:pt-4">
      <header className="mb-3 flex items-start justify-between gap-3 pt-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{side === 'front' ? 'Front' : 'Back'} photo</h1>
          <p className="truncate text-sm text-slate-400">{cardTitle(card)}</p>
        </div>
        <button type="button" onClick={cancel} className="min-h-11 shrink-0 px-2 text-sm font-medium text-sky-400">
          Cancel
        </button>
      </header>

      <div className="grid grid-cols-4 gap-1 rounded-full bg-slate-900 p-1 text-center text-sm font-medium" role="tablist">
        {MODES.map(({ mode: m, label }) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            disabled={busy}
            onClick={() => setMode(m)}
            className={`min-h-10 rounded-full ${mode === m ? 'bg-sky-500 text-slate-950' : 'text-slate-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>}

      {mode === 'auto' ? (
        <AutoFixPanel pixels={current.pixels} original={original.pixels} changes={current.changes} busy={busy} onAuto={autoFix} />
      ) : mode === 'crop' ? (
        <>
          <p className="mt-3 text-sm text-slate-400">
            Drag each circle onto a corner of the card itself (not the toploader), then tap Straighten.
          </p>
          <CornerEditor pixels={current.pixels} quad={quad} onChange={(q) => setCorners({ on: current.pixels, quad: q })} />
          <div className="flex gap-2">
            <button type="button" disabled={busy || !moved} onClick={() => setCorners(null)} className={`${buttonSecondary} flex-1`}>
              Reset
            </button>
            <button type="button" disabled={busy} onClick={rotate} className={`${buttonSecondary} flex-1`}>
              <Icon name="refresh" size={18} /> Rotate
            </button>
            <button
              type="button"
              disabled={busy || isFullFrame(quad)}
              onClick={straighten}
              className={`${buttonPrimary} flex-[1.4]`}
            >
              {busy ? 'Working…' : 'Straighten'}
            </button>
          </div>
        </>
      ) : mode === 'light' ? (
        <>
          <p className="mt-3 text-sm text-slate-400">
            Set it yourself (sharpness helps a photo softened by the toploader), then tap Apply.
          </p>
          <LightPanel
            pixels={current.pixels}
            busy={busy}
            onApply={(adjust) => run(() => ({ ...current, pixels: adjustLight(current.pixels, adjust), changes: null }))}
          />
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-400">
            Paint over the glare, a little past its soft edge, then tap Fill. Best on borders and plain areas: it
            can’t bring back text or faces.
          </p>
          <TouchUpCanvas
            pixels={current.pixels}
            busy={busy}
            onFill={(mask) => run(() => ({ ...current, pixels: fillGlare(current.pixels, mask), changes: null }))}
          />
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-3">
          <button
            type="button"
            disabled={busy || history.length === 0}
            onClick={undo}
            className={`${buttonSecondary} min-h-12 flex-1`}
          >
            <Icon name="undo" size={18} /> Undo
          </button>
          <button type="button" disabled={busy || !edited} onClick={save} className={`${buttonPrimary} min-h-12 flex-[2]`}>
            {replace.isPending ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </main>
  )
}
