import { useState, type ChangeEvent } from 'react'
import { Icon } from '../../components/Icon'
import { buttonPrimary, buttonSecondary, panel } from '../../components/ui'
import { findCards, loadImage } from '../../lib/photos'
import { boxesFor, GRID_LAYOUTS, type CapturedPhoto, type Layout } from './captureState'

type PhotoStepProps = {
  photos: CapturedPhoto[]
  onChange: (photos: CapturedPhoto[]) => void
}

/** Add photos for one side (fronts or backs) and check that every card was found. */
export function PhotoStep({ photos, onChange }: PhotoStepProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function addFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = '' // let the same file be picked again
    if (files.length === 0) return
    setBusy(true)
    setError(null)
    const added: CapturedPhoto[] = []
    try {
      for (const file of files) {
        const img = await loadImage(file)
        const autoBoxes = findCards(img)
        added.push({
          id: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
          width: img.naturalWidth,
          height: img.naturalHeight,
          autoBoxes,
          layout: autoBoxes.length > 0 ? 'auto' : '1x1',
        })
      }
    } catch {
      setError('Couldn’t open one of those photos. Try taking it again.')
    } finally {
      setBusy(false)
      onChange([...photos, ...added])
    }
  }

  function setLayout(id: string, layout: Layout) {
    onChange(photos.map((p) => (p.id === id ? { ...p, layout } : p)))
  }

  function remove(id: string) {
    const photo = photos.find((p) => p.id === id)
    if (photo) URL.revokeObjectURL(photo.url)
    onChange(photos.filter((p) => p.id !== id))
  }

  // Card numbers run on across photos: photo 2 starts where photo 1 left off.
  const firstNumbers = photos.map((_, i) => photos.slice(0, i).reduce((n, p) => n + boxesFor(p).length, 0))
  return (
    <div className="flex flex-col gap-3">
      {photos.map((photo, photoIndex) => {
        const boxes = boxesFor(photo)
        const first = firstNumbers[photoIndex]
        return (
          <section key={photo.id} className={`${panel} overflow-hidden`}>
            <div className="relative">
              <img src={photo.url} alt="" className="block w-full" />
              {boxes.map((box, i) => (
                <div
                  key={i}
                  className="absolute rounded-md border-2 border-sky-400 bg-sky-400/10"
                  style={{
                    left: `${box.x * 100}%`,
                    top: `${box.y * 100}%`,
                    width: `${box.w * 100}%`,
                    height: `${box.h * 100}%`,
                  }}
                >
                  <span className="absolute top-1 left-1 grid size-6 place-items-center rounded-full bg-sky-500 text-xs font-bold text-slate-950">
                    {first + i + 1}
                  </span>
                </div>
              ))}
              <button
                type="button"
                onClick={() => remove(photo.id)}
                aria-label="Remove photo"
                className="absolute top-2 right-2 grid size-11 place-items-center rounded-full bg-slate-950/80 text-slate-200"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-2 p-3">
              <p className="text-sm">
                {photo.layout === 'auto' ? (
                  <>
                    Found <strong>{boxes.length}</strong> {boxes.length === 1 ? 'card' : 'cards'}. Wrong? Pick how many
                    are in the photo:
                  </>
                ) : (
                  <>
                    Split into a grid of <strong>{boxes.length}</strong>.
                  </>
                )}
              </p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cards in this photo">
                {photo.autoBoxes.length > 0 && (
                  <LayoutChip active={photo.layout === 'auto'} onClick={() => setLayout(photo.id, 'auto')}>
                    Auto
                  </LayoutChip>
                )}
                {GRID_LAYOUTS.map((g) => (
                  <LayoutChip key={g.layout} active={photo.layout === g.layout} onClick={() => setLayout(photo.id, g.layout)}>
                    {g.label}
                  </LayoutChip>
                ))}
              </div>
            </div>
          </section>
        )
      })}

      {error && <p className="rounded-xl bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <label className={`${photos.length ? buttonSecondary : buttonPrimary} min-h-12 cursor-pointer`}>
          <Icon name="camera" size={18} /> {busy ? 'Finding cards…' : 'Take photo'}
          <input type="file" accept="image/*" capture="environment" onChange={addFiles} className="sr-only" disabled={busy} />
        </label>
        <label className={`${buttonSecondary} min-h-12 cursor-pointer`}>
          <Icon name="image" size={18} /> From library
          <input type="file" accept="image/*" multiple onChange={addFiles} className="sr-only" disabled={busy} />
        </label>
      </div>
    </div>
  )
}

function LayoutChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 min-w-11 rounded-full border px-3 text-sm font-medium ${
        active ? 'border-sky-400 bg-sky-500 text-slate-950' : 'border-slate-700 bg-slate-900 text-slate-300'
      }`}
    >
      {children}
    </button>
  )
}
