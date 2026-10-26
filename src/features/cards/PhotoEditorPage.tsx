import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Icon } from '../../components/Icon'
import { buttonPrimary, buttonSecondary } from '../../components/ui'
import { useCards, useReplaceCardPhoto } from '../../hooks/useCards'
import { usePhotoImage } from '../../hooks/usePhotos'
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
} from '../../lib/photoEdit'
import { drawPixels, finishPhoto, imagePixels, isFlatPhoto, PHOTO_MAX_EDGE, type Side } from '../../lib/photos'
import type { Card } from '../../types/card'
import { cardTitle } from './cardText'
import { CornerEditor } from './CornerEditor'
import { TouchUpCanvas } from './TouchUpCanvas'

type Mode = 'straighten' | 'touchup'
/** Each step keeps a full copy of the photo (about 7 MB), so undo stops after this many. */
const UNDO_LIMIT = 8

/** `flat`: the photo is straightened to the card (saved with the `-flat` marker). */
type Step = { pixels: Pixels; quad: Quad; flat: boolean }

const isFullFrame = (quad: Quad) => quad.every((p, i) => p.x === FULL_FRAME[i].x && p.y === FULL_FRAME[i].y)

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
  const original = useMemo<Step>(() => {
    const pixels = imagePixels(image)
    return { pixels, quad: findCardCorners(pixels), flat: isFlatPhoto(path) }
  }, [image, path])
  const [current, setCurrent] = useState<Step>(original)
  const [history, setHistory] = useState<Step[]>([])
  const [mode, setMode] = useState<Mode>('straighten')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const edited = current.pixels !== original.pixels
  const backTo = `/cards/${card.id}`

  // Warn before a reload or tab close throws away an unsaved edit.
  useEffect(() => {
    if (!edited || replace.isSuccess) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [edited, replace.isSuccess])

  /** Runs a heavy pixel step after the "working" state has painted. */
  function run(step: () => Step | void) {
    setBusy(true)
    setError(null)
    setTimeout(() => {
      try {
        const next = step()
        if (next) {
          setHistory((h) => [...h, current].slice(-UNDO_LIMIT))
          setCurrent(next)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    }, 30)
  }

  function straighten() {
    run(() => {
      const { pixels, quad } = current
      const size = outputSize(quad, pixels.width, pixels.height, PHOTO_MAX_EDGE)
      const flat = warpPerspective(pixels, quad, size.width, size.height)
      setMode('touchup') // glare is the usual next step
      return { pixels: flat, quad: FULL_FRAME, flat: true }
    })
  }

  function rotate() {
    run(() => ({ ...current, pixels: rotateQuarter(current.pixels), quad: rotateQuad(current.quad) }))
  }

  function fill(mask: Uint8Array) {
    run(() => ({ ...current, pixels: fillGlare(current.pixels, mask) }))
  }

  function undo() {
    const previous = history.at(-1)
    if (!previous) return
    setHistory((h) => h.slice(0, -1))
    setCurrent(previous)
  }

  function startOver() {
    setHistory([])
    setCurrent(original)
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
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Edit {side} photo</h1>
          <p className="truncate text-sm text-slate-400">{cardTitle(card)}</p>
        </div>
        <button type="button" onClick={cancel} className="min-h-11 shrink-0 px-2 text-sm font-medium text-sky-400">
          Cancel
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2 text-center text-sm font-medium" role="tablist">
        {(['straighten', 'touchup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-11 rounded-full ${mode === m ? 'bg-sky-500 text-slate-950' : 'bg-slate-900 text-slate-400'}`}
          >
            {m === 'straighten' ? 'Straighten' : 'Touch up'}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>}

      {mode === 'straighten' ? (
        <>
          <p className="mt-3 text-sm text-slate-400">
            Drag each circle onto a corner of the card itself (not the toploader), then tap Straighten.
          </p>
          <CornerEditor
            pixels={current.pixels}
            quad={current.quad}
            onChange={(quad) => setCurrent((c) => ({ ...c, quad }))}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setCurrent((c) => ({ ...c, quad: findCardCorners(c.pixels) }))}
              className={`${buttonSecondary} flex-1`}
            >
              Auto
            </button>
            <button type="button" disabled={busy} onClick={rotate} className={`${buttonSecondary} flex-1`}>
              <Icon name="refresh" size={18} /> Rotate
            </button>
            <button
              type="button"
              disabled={busy || isFullFrame(current.quad)}
              onClick={straighten}
              className={`${buttonPrimary} flex-[1.4]`}
            >
              {busy ? 'Working…' : 'Straighten'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-400">
            Paint over the glare, a little past its soft edge, then tap Fill. Best on borders and plain areas: it
            can’t bring back text or faces.
          </p>
          <TouchUpCanvas pixels={current.pixels} busy={busy} onFill={fill} />
        </>
      )}

      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy || history.length === 0} onClick={undo} className={`${buttonSecondary} flex-1`}>
          Undo
        </button>
        <button type="button" disabled={busy || !edited} onClick={startOver} className={`${buttonSecondary} flex-1`}>
          Start over
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-3">
          <button type="button" onClick={cancel} className={`${buttonSecondary} min-h-12 flex-1`}>
            Cancel
          </button>
          <button type="button" disabled={busy || !edited} onClick={save} className={`${buttonPrimary} min-h-12 flex-[2]`}>
            {replace.isPending ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </main>
  )
}
