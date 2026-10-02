import type { Card } from '../../types/card'
import type { Suggestions } from './CardForm'
import { distinctValues } from './collection'

const DEFAULT_SPORTS = ['Baseball', 'Basketball', 'Football', 'Hockey', 'Soccer']
const DEFAULT_GRADERS = ['PSA', 'BGS', 'SGC', 'CGC']
const DEFAULT_CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Very Good', 'Good', 'Poor']

function merge(own: string[], defaults: string[]): string[] {
  const seen = new Set(own.map((v) => v.toLowerCase()))
  return [...own, ...defaults.filter((d) => !seen.has(d.toLowerCase()))]
}

/** Autocomplete options: each field suggests only its own past values (plus a few common defaults). */
export function buildSuggestions(cards: Card[]): Suggestions {
  return {
    player: distinctValues(cards, 'player'),
    year: distinctValues(cards, 'year'),
    set_name: distinctValues(cards, 'set_name'),
    insert_name: distinctValues(cards, 'insert_name'),
    parallel: distinctValues(cards, 'parallel'),
    team: distinctValues(cards, 'team'),
    sport: merge(distinctValues(cards, 'sport'), DEFAULT_SPORTS),
    grade_company: merge(distinctValues(cards, 'grade_company'), DEFAULT_GRADERS),
    raw_condition: merge(distinctValues(cards, 'raw_condition'), DEFAULT_CONDITIONS),
  }
}

const LAST_SPORT_KEY = 'sports-cards:last-sport'

export function getLastSport(): string {
  try {
    return localStorage.getItem(LAST_SPORT_KEY) ?? ''
  } catch {
    return ''
  }
}

export function rememberSport(sport: string) {
  try {
    localStorage.setItem(LAST_SPORT_KEY, sport)
  } catch {
    // Not critical.
  }
}
