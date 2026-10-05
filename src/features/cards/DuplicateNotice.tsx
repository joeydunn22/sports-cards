import { buttonGhost, buttonPrimary, buttonSecondary } from '../../components/ui'
import { cardTitle } from './cardText'
import { CardThumb } from './CardThumb'
import type { DuplicateMatch } from './duplicates'

const LABEL: Record<DuplicateMatch['kind'], string> = {
  'same-copy': 'This exact card is already saved',
  mergeable: 'Already in your collection',
  'other-copy': 'You have another copy',
}

/** Live note under the form when the card being entered is already in the collection. */
export function DuplicateNotice({ matches }: { matches: DuplicateMatch[] }) {
  if (matches.length === 0) return null
  return (
    <section
      role="status"
      className="flex flex-col gap-2 rounded-2xl border border-amber-800/60 bg-amber-950/40 p-3 text-sm"
    >
      {matches.slice(0, 3).map(({ card, kind }) => (
        <div key={card.id} className="flex items-center gap-3">
          <CardThumb path={card.front_image_path} className="w-9" />
          <div className="min-w-0">
            <p className="font-medium text-amber-200">
              {LABEL[kind]}
              {card.quantity > 1 && ` (qty ${card.quantity})`}
            </p>
            <p className="truncate text-slate-300">{cardTitle(card)}</p>
          </div>
        </div>
      ))}
      {matches.length > 3 && <p className="text-slate-400">and {matches.length - 3} more</p>}
    </section>
  )
}

type DuplicatePromptProps = {
  match: DuplicateMatch
  quantity: number
  busy: boolean
  onMerge: () => void
  onSeparate: () => void
  onCancel: () => void
}

/** Asked on save when the card is a plain extra copy, or looks like a card entered twice. */
export function DuplicatePrompt({ match, quantity, busy, onMerge, onSeparate, onCancel }: DuplicatePromptProps) {
  const { card, kind } = match
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-title"
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
      >
        <div className="flex gap-3">
          <CardThumb path={card.front_image_path} className="w-14" />
          <div className="min-w-0">
            <h2 id="duplicate-title" className="font-semibold">
              {kind === 'same-copy' ? 'Already saved?' : 'You already have this card'}
            </h2>
            <p className="text-sm text-slate-300">{cardTitle(card)}</p>
            <p className="mt-1 text-sm text-slate-400">
              {kind === 'same-copy'
                ? 'It has the same serial number or grading cert, so it may be the same card entered twice.'
                : `Quantity ${card.quantity}. Another copy can go on the same entry.`}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {kind === 'mergeable' && (
            <button type="button" disabled={busy} onClick={onMerge} className={`${buttonPrimary} min-h-12`}>
              Add to it (quantity {card.quantity + quantity})
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={onSeparate}
            className={`${kind === 'mergeable' ? buttonSecondary : buttonPrimary} min-h-12`}
          >
            {kind === 'mergeable' ? 'Save as a separate entry' : 'Save anyway'}
          </button>
          <button type="button" disabled={busy} onClick={onCancel} className={`${buttonGhost} min-h-12`}>
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}
