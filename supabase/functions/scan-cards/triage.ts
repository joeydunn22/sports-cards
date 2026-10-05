/**
 * What happens to a card after the AI's first reading. Pure, so the rules are unit tested
 * (see triage.test.ts, run by Vitest from the app).
 *
 * - ready: confident enough to review as is.
 * - lookup: a specific doubt that the set's checklist can settle (year, set, insert, parallel, number...),
 *   on a card read well enough to search for (see `searchable`).
 * - retake: the AI said the photo hides something. A search can't fix a bad photo.
 * - unidentified: unsure about too much of the card's identity to search for it. Searching would
 *   only add cost and guesses, so it goes straight to the collector.
 *
 * A card gets at most one lookup. Whatever it leaves unsettled goes to the collector, never back.
 */
export type Triage = 'ready' | 'lookup' | 'retake' | 'unidentified'

export const CORE_FIELDS = ['player', 'year', 'set_name', 'card_number'] as const

type Reading = { uncertain_fields?: string[]; needs_lookup?: boolean; retake?: string }

/** A checklist search needs something solid to search by. */
function searchable(unsure: Set<string>): boolean {
  const known = (f: string) => !unsure.has(f)
  return (
    (known('player') && known('card_number')) || // "Ohtani #12": find the set and year
    (known('player') && known('set_name') && known('year')) || // find the card number
    (known('set_name') && known('year') && known('card_number')) // find the player
  )
}

export function triage(reading: Reading): Triage {
  const unsure = new Set(reading.uncertain_fields ?? [])
  if (reading.retake?.trim()) return 'retake'
  if (!searchable(unsure)) return 'unidentified'
  return reading.needs_lookup ? 'lookup' : 'ready'
}
