import { Icon } from '../../components/Icon'
import { usePhotoUrl } from '../../hooks/usePhotos'

/** Card-shaped thumbnail of the front photo, or a placeholder when there isn't one. */
export function CardThumb({ path, className = 'w-12' }: { path: string | null; className?: string }) {
  const { data: url } = usePhotoUrl(path, { thumb: true })
  return (
    <div
      className={`grid aspect-[5/7] shrink-0 place-items-center overflow-hidden rounded-md border border-slate-700/60 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-600 ${className}`}
    >
      {url ? <img src={url} alt="" loading="lazy" className="size-full object-cover" /> : <Icon name="image" size={18} />}
    </div>
  )
}
