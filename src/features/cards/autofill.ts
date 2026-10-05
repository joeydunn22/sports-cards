import type { Card } from '../../types/card'
import type { CardFormValues } from './cardSchema'

const norm = (value: string | null | undefined) => (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

export type Fill = { values: Partial<CardFormValues>; fields: string[]; source: string }

/** A known checklist spot: a saved card, or an entry in the checklist cache (public.checklist_entries). */
export type Spot = Pick<Card, 'player' | 'year' | 'set_name' | 'card_number' | 'team' | 'is_rookie'> & {
  insert_name: string | null
  sport: string | null
}

/**
 * Free fill-in from cards already in the collection (and the checklist cache), for fields still blank:
 * - same year, set and card number as an existing card (say, another parallel of it): player, team,
 *   sport, insert and RC;
 * - otherwise the same player: team and sport from their most recent card.
 * Never overwrites anything typed.
 */
export function fillFromCollection(values: CardFormValues, cards: Spot[]): Fill | null {
  const sameSpot =
    norm(values.card_number) && norm(values.set_name) && norm(values.year)
      ? cards.find(
          (c) =>
            norm(c.card_number) === norm(values.card_number) &&
            norm(c.set_name) === norm(values.set_name) &&
            norm(c.year) === norm(values.year),
        )
      : undefined
  if (sameSpot) {
    return fillBlanks(values, {
      card: sameSpot,
      fields: ['player', 'team', 'sport', 'insert_name', 'is_rookie'],
      source: `your ${sameSpot.year} ${sameSpot.set_name} #${sameSpot.card_number}`,
    })
  }
  const player = norm(values.player)
  if (!player) return null
  // Cards load newest first, so the first match is the player's most recent card.
  const samePlayer = cards.find((c) => norm(c.player) === player)
  return samePlayer
    ? fillBlanks(values, { card: samePlayer, fields: ['team', 'sport'], source: `your other ${samePlayer.player} cards` })
    : null
}

function fillBlanks(
  values: CardFormValues,
  { card, fields, source }: { card: Spot; fields: (keyof Spot & keyof CardFormValues)[]; source: string },
): Fill | null {
  const filled: Partial<CardFormValues> = {}
  for (const field of fields) {
    const theirs = card[field]
    if (typeof theirs === 'boolean') {
      if (theirs && !values[field]) Object.assign(filled, { [field]: true })
    } else if (theirs && !String(values[field]).trim()) {
      Object.assign(filled, { [field]: String(theirs) })
    }
  }
  const names = Object.keys(filled)
  return names.length ? { values: filled, fields: names, source } : null
}


const FIELD_NAMES: Record<string, string> = {
  player: 'Player',
  year: 'Year',
  set_name: 'Set',
  insert_name: 'Insert',
  parallel: 'Parallel',
  card_number: 'Card #',
  sport: 'Sport',
  team: 'Team',
  print_run: 'Print run',
  is_rookie: 'RC',
  is_auto: 'Auto',
  is_patch: 'Patch',
  is_relic: 'Relic',
}

/** Form labels, for notes like "Filled Team, Sport". */
export const fieldName = (field: string) => FIELD_NAMES[field] ?? field

