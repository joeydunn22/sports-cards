import { formatSerial } from '../../lib/format'
import type { Card } from '../../types/card'

type TitleFields = Partial<Pick<
  Card,
  | 'year'
  | 'set_name'
  | 'insert_name'
  | 'parallel'
  | 'player'
  | 'card_number'
  | 'serial_number'
  | 'print_run'
  | 'is_rookie'
  | 'is_auto'
  | 'is_patch'
  | 'is_graded'
  | 'grade_company'
  | 'grade'
>>

/** Strips a leading "#" so "#12" and "12" display the same. */
export function cleanCardNumber(cardNumber: string): string {
  return cardNumber.trim().replace(/^#\s*/, '')
}

/** e.g. "2023 Topps Finest Red Refractor Shohei Ohtani #12 3/5 Auto PSA 10" */
export function cardTitle(card: TitleFields): string {
  const grade = card.is_graded ? [card.grade_company, card.grade].filter(Boolean).join(' ') : ''
  return [
    card.year,
    card.set_name,
    card.insert_name,
    card.parallel,
    card.player,
    card.card_number && `#${cleanCardNumber(card.card_number)}`,
    formatSerial(card.serial_number, card.print_run),
    card.is_rookie && 'RC',
    card.is_auto && 'Auto',
    card.is_patch && 'Patch',
    grade,
  ]
    .filter(Boolean)
    .join(' ')
}

const PARALLEL_WORD =
  /\b(refractor|silver|gold|red|blue|green|orange|purple|black|pink|yellow|wave|mojo|shimmer|holo)\b/i

/**
 * Soft check that a parallel hasn't leaked into the Set field.
 * Non-blocking: some real sets contain these words (e.g. Topps Gold Label).
 */
export function setNameWarning(setName: string): string | null {
  const match = setName.match(PARALLEL_WORD)
  if (!match) return null
  return `"${match[0]}" looks like a parallel. Colors and finishes go in Parallel; Set is just the product (e.g. Topps Finest).`
}
