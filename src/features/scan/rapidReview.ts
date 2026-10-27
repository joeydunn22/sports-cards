import type { Card } from '../../types/card'
import { cardFormSchema, toCardInput, type CardFormValues } from '../cards/cardSchema'
import { findDuplicates } from '../cards/duplicates'
import { fieldLabel } from './extraction'

/**
 * Why a card can't be saved straight from the rapid review deck, or null when it can. The full form
 * handles these: a required field the AI left blank (or a serial without its print run), and a card
 * already in the collection (add to its quantity, or the same copy entered twice).
 */
export function quickSaveBlocker(values: CardFormValues, cards: Card[]): string | null {
  const parsed = cardFormSchema.safeParse(values)
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => fieldLabel(String(issue.path[0]))))]
    return `Fill in ${fields.join(', ')}`
  }
  const match = findDuplicates(toCardInput(values), cards).find((m) => m.kind !== 'other-copy')
  if (match) return match.kind === 'mergeable' ? 'Already in your collection' : 'Looks like a card you’ve saved'
  return null
}
