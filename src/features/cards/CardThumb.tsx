import { Icon } from '../../components/Icon'
import { usePhotoUrl } from '../../hooks/usePhotos'

/** Card-shaped thumbnail of the front photo, or a placeholder when there isn't one. */
export function CardThumb({ path, className = 'w-12' }: { path: string | null; className?: string }) {
  const { data: url } = usePhotoUrl(path, { thumb: true })
  return (
    <div
      className={`grid aspect-[5/7] shrink-0 place-items-center overflow-hidden rounded-[5px] bg-ink-800 text-ink-600 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.06] ${className}`}
    >
      {url ? <img src={url} alt="" loading="lazy" className="size-full object-cover" /> : <Icon name="image" size={18} />}
    </div>
  )
}
