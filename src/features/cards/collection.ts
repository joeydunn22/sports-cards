import type { Card } from '../../types/card'
import { setKey } from '../sets/setIndex'
import { cardTitle } from './cardText'
import { nameKey } from './nameMatch'

export const FILTER_FIELDS = ['sport', 'year', 'set_name', 'insert_name', 'parallel', 'team', 'player'] as const
export type FilterField = (typeof FILTER_FIELDS)[number]

export const FLAG_FILTERS = {
  is_rookie: 'RC',
  is_auto: 'Auto',
  is_relic: 'Relic',
  is_graded: 'Graded',
  numbered: 'Numbered',
} as const
export type FlagFilter = keyof typeof FLAG_FILTERS

export type Ownership = 'owned' | 'sold' | 'all'

export type CardFilters = {
  search: string
  fields: Partial<Record<FilterField, string>>
  flags: FlagFilter[]
  ownership: Ownership
}

export const emptyFilters: CardFilters = { search: '', fields: {}, flags: [], ownership: 'owned' }

export function isSold(card: Card): boolean {
  return card.sold_date != null || card.sold_price != null
}

function hasFlag(card: Card, flag: FlagFilter): boolean {
  return flag === 'numbered' ? card.print_run != null : card[flag]
}

export function filterCards(cards: Card[], filters: CardFilters): Card[] {
  const tokens = filters.search.toLowerCase().split(/\s+/).filter(Boolean)
  // A filter saved before a flag was retired (Patch) is ignored.
  const flags = filters.flags.filter((flag) => flag in FLAG_FILTERS)
  const fieldEntries = Object.entries(filters.fields).filter(([, value]) => value) as [FilterField, string][]

  return cards.filter((card) => {
    if (filters.ownership === 'owned' && isSold(card)) return false
    if (filters.ownership === 'sold' && !isSold(card)) return false
    for (const [field, value] of fieldEntries) {
      if ((card[field] ?? '').toLowerCase() !== value.toLowerCase()) return false
    }
    for (const flag of flags) {
      if (!hasFlag(card, flag)) return false
    }
    if (tokens.length) {
      const haystack = `${cardTitle(card)} ${card.team ?? ''} ${card.sport} ${card.cert_number ?? ''}`.toLowerCase()
      if (!tokens.every((t) => haystack.includes(t))) return false
    }
    return true
  })
}

export function countActiveFilters(filters: CardFilters): number {
  return (
    Object.values(filters.fields).filter(Boolean).length +
    filters.flags.length +
    (filters.ownership === 'owned' ? 0 : 1)
  )
}

/** Unique non-empty values of a text field, case-insensitive, first spelling wins. */
export function distinctValues(cards: Card[], field: FilterField | 'grade_company' | 'raw_condition'): string[] {
  const seen = new Map<string, string>()
  for (const card of cards) {
    const value = card[field]?.trim()
    if (value && !seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value)
  }
  const values = [...seen.values()]
  return field === 'year'
    ? values.sort((a, b) => b.localeCompare(a))
    : values.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

export type CollectionSummary = {
  entries: number
  totalCards: number
  players: number
  sets: number
}

/** Counts for cards still owned (sold cards are excluded). Quantity counts toward the card total. */
export function summarize(cards: Card[]): CollectionSummary {
  const summary: CollectionSummary = { entries: 0, totalCards: 0, players: 0, sets: 0 }
  const players = new Set<string>()
  const sets = new Set<string>()
  for (const card of cards) {
    if (isSold(card)) continue
    summary.entries += 1
    summary.totalCards += card.quantity
    players.add(nameKey(card.player))
    sets.add(setKey(card))
  }
  summary.players = players.size
  summary.sets = sets.size
  return summary
}
