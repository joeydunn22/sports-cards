import type { Card } from '../../types/card'
import type { CardFormValues } from './cardSchema'
import { samePlayer } from './nameMatch'

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

const INSERT_FLAGS: [keyof CardFormValues & `is_${string}`, RegExp][] = [
  ['is_auto', /auto|signature/i],
  ['is_relic', /relic|patch|jersey|memorabilia/i],
]

/** The yes/no flags an insert's name settles: "Prospect Autographs" is an auto. */
export function insertFlags(insertName: string): ('is_auto' | 'is_relic')[] {
  return INSERT_FLAGS.filter(([, pattern]) => pattern.test(insertName)).map(([flag]) => flag as 'is_auto' | 'is_relic')
}

/** A player's cards in one set, by checklist: what Card # can be. */
export type CardNumberMatch = {
  /** Set when one card fits (the current insert is preferred): Card #, plus Insert, RC and the spelling. */
  fill: Fill | null
  /** Every card of the player in the set, the current insert's first, to pick from when there are several. */
  options: Spot[]
}

/**
 * Card # from the set's checklist (saved cards, Cardpedia, earlier searches) once Player, Year and Set
 * are in: the player's card in that set, matched loosely ("ronald acuna jr" is "Ronald Acuña, Jr.").
 * Several cards (base and an insert, say) fill only when one is in the current insert.
 */
export function cardNumberFill(values: CardFormValues, spots: Spot[]): CardNumberMatch | null {
  if (!values.player.trim() || !norm(values.year) || !norm(values.set_name)) return null
  const seen = new Set<string>()
  const options = spots.filter((s) => {
    if (norm(s.year) !== norm(values.year) || norm(s.set_name) !== norm(values.set_name)) return false
    if (!samePlayer(s.player, values.player)) return false
    const id = `${norm(s.insert_name)}|${norm(s.card_number)}`
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  if (!options.length) return null
  const inInsert = (s: Spot) => norm(s.insert_name) === norm(values.insert_name)
  options.sort((a, b) => Number(inInsert(b)) - Number(inInsert(a)))
  const preferred = options.filter(inInsert)
  const only = preferred.length === 1 ? preferred[0] : options.length === 1 ? options[0] : null
  if (!only || norm(values.card_number)) return { fill: null, options }

  const filled: Partial<CardFormValues> = { card_number: only.card_number }
  if (only.insert_name && !values.insert_name.trim()) filled.insert_name = only.insert_name
  if (only.is_rookie && !values.is_rookie) filled.is_rookie = true
  if (only.insert_name) for (const flag of insertFlags(only.insert_name)) if (!values[flag]) filled[flag] = true
  // The checklist's spelling, for a name typed loosely or heard by dictation.
  if (only.player !== values.player.trim()) filled.player = only.player
  return {
    fill: { values: filled, fields: Object.keys(filled), source: `the ${only.year} ${only.set_name} checklist` },
    options,
  }
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
  serial_number: 'Serial #',
  print_run: 'Print run',
  is_graded: 'Graded',
  grade_company: 'Grading company',
  grade: 'Grade',
  is_rookie: 'RC',
  is_auto: 'Auto',
  is_relic: 'Relic',
}

/** Form labels, for notes like "Filled Team, Sport". */
export const fieldName = (field: string) => FIELD_NAMES[field] ?? field

