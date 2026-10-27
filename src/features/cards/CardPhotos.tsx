import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { ZoomImage } from '../../components/ZoomImage'
import { usePhotoUrl } from '../../hooks/usePhotos'

/** `cardId` adds an Edit button to each photo (saved cards only; scans in the inbox have none). */
type CardPhotosProps = { front: string | null; back: string | null; cardId?: string }

/** Front and back side by side; tap one to see it full screen. */
export function CardPhotos({ front, back, cardId }: CardPhotosProps) {
  const [open, setOpen] = useState<string | null>(null)
  if (!front && !back) return null
  const editTo = (side: 'front' | 'back') => (cardId ? `/cards/${cardId}/photo/${side}` : undefined)
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3">
        <Photo path={front} label="Front" editTo={editTo('front')} onOpen={setOpen} />
        <Photo path={back} label="Back" editTo={editTo('back')} onOpen={setOpen} />
      </div>
      {open && <Lightbox path={open} onClose={() => setOpen(null)} />}
    </>
  )
}

type PhotoProps = { path: string | null; label: string; editTo?: string; onOpen: (path: string) => void }

function Photo({ path, label, editTo, onOpen }: PhotoProps) {
  const { data: url, isError } = usePhotoUrl(path)
  if (!path) {
    return (
      <div className="grid aspect-[5/7] place-items-center rounded-2xl border border-dashed border-ink-700 text-sm text-ink-500">
        No {label.toLowerCase()} photo
      </div>
    )
  }
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpen(path)}
        aria-label={`View ${label.toLowerCase()} full size`}
        className="grid aspect-[5/7] w-full place-items-center overflow-hidden rounded-2xl bg-ink-900 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.06] transition-transform active:scale-[0.98]"
      >
        {url ? (
          <img src={url} alt={label} className="size-full object-contain" />
        ) : (
          <span className="text-sm text-ink-500">{isError ? 'Couldn’t load' : 'Loading…'}</span>
        )}
      </button>
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-ink-950/75 px-2 py-0.5 text-[11px] font-semibold text-ink-200 backdrop-blur">
        {label}
      </span>
      {editTo && (
        <Link
          to={editTo}
          aria-label={`Edit ${label.toLowerCase()} photo`}
          className="absolute right-1 bottom-1 flex min-h-11 items-center gap-1.5 rounded-full bg-ink-950/75 px-3 text-sm font-medium text-ink-100 backdrop-blur active:bg-ink-800"
        >
          <Icon name="edit" size={16} /> Edit
        </Link>
      )}
    </div>
  )
}

/** Full-screen photo: pinch or double-tap to zoom; the close button (or Escape) goes back. */
export function Lightbox({ path, onClose }: { path: string; onClose: () => void }) {
  const { data: url } = usePhotoUrl(path)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Photo"
      className="fixed inset-0 z-50 grid place-items-center bg-black/95 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      {url && <ZoomImage src={url} />}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 grid size-11 place-items-center rounded-full bg-ink-800/90 text-ink-100"
      >
        <Icon name="close" size={22} />
      </button>
    </div>
  )
}
