import { Icon } from '../../components/Icon'
import type { Card } from '../../types/card'

/** Card-shaped thumbnail. Shows a placeholder until the card has a photo. */
export function CardThumb({ card, className = 'w-12' }: { card: Card; className?: string }) {
  return (
    <div
      className={`grid aspect-[5/7] shrink-0 place-items-center rounded-md border border-slate-700/60 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-600 ${className}`}
      title={card.front_image_path ? undefined : 'No photo yet'}
    >
      <Icon name="image" size={18} />
    </div>
  )
}
