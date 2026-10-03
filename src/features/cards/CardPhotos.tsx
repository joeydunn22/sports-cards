import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { usePhotoUrl } from '../../hooks/usePhotos'

type CardPhotosProps = { front: string | null; back: string | null }

/** Front and back side by side; tap one to see it full screen. */
export function CardPhotos({ front, back }: CardPhotosProps) {
  const [open, setOpen] = useState<string | null>(null)
  if (!front && !back) return null
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <Photo path={front} label="Front" onOpen={setOpen} />
        <Photo path={back} label="Back" onOpen={setOpen} />
      </div>
      {open && <Lightbox path={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function Photo({ path, label, onOpen }: { path: string | null; label: string; onOpen: (path: string) => void }) {
  const { data: url, isError } = usePhotoUrl(path)
  if (!path) {
    return (
      <div className="grid aspect-[5/7] place-items-center rounded-xl border border-dashed border-slate-700 text-sm text-slate-500">
        No {label.toLowerCase()} photo
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(path)}
      aria-label={`View ${label.toLowerCase()} full size`}
      className="relative grid aspect-[5/7] place-items-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
    >
      {url ? (
        <img src={url} alt={label} className="size-full object-contain" />
      ) : (
        <span className="text-sm text-slate-500">{isError ? 'Couldn’t load' : 'Loading…'}</span>
      )}
      <span className="absolute bottom-1.5 left-1.5 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-200">
        {label}
      </span>
    </button>
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
