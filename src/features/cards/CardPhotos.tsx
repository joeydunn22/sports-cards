import { useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
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
      <div className="mb-4 grid grid-cols-2 gap-3">
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
      <div className="grid aspect-[5/7] place-items-center rounded-xl border border-dashed border-slate-700 text-sm text-slate-500">
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
        className="grid aspect-[5/7] w-full place-items-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
      >
        {url ? (
          <img src={url} alt={label} className="size-full object-contain" />
        ) : (
          <span className="text-sm text-slate-500">{isError ? 'Couldn’t load' : 'Loading…'}</span>
        )}
      </button>
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-200">
        {label}
      </span>
      {editTo && (
        <Link
          to={editTo}
          aria-label={`Edit ${label.toLowerCase()} photo`}
          className="absolute right-1 bottom-1 grid size-11 place-items-center rounded-full bg-slate-950/80 text-slate-100 active:bg-slate-800"
        >
          <Icon name="edit" size={18} />
        </Link>
      )}
    </div>
  )
}

function Lightbox({ path, onClose }: { path: string; onClose: () => void }) {
  const { data: url } = usePhotoUrl(path)
  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Photo"
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/95 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      {url && <img src={url} alt="" className="max-h-full max-w-full object-contain" />}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 grid size-11 place-items-center rounded-full bg-slate-800/90 text-slate-100"
      >
        <Icon name="close" size={22} />
      </button>
    </div>
  )
}
