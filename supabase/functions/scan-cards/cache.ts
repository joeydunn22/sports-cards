/**
 * The checklist cache (public.checklist_entries): what's known about each checklist spot, from saved
 * cards and earlier checklist searches. Checked before paying for a web search. Pure, so it's unit tested
 * (cache.test.ts, run by Vitest from the app).
 */
export type Entry = {
  year: string
  set_name: string
  insert_name: string
  card_number: string
  player: string
  team: string | null
  sport: string | null
  is_rookie: boolean
  source: 'collection' | 'search'
  source_url: string | null
}

type Reading = Record<string, unknown> & { uncertain_fields?: string[] }

/** Fields a checklist spot can settle. Parallels, serials and memorabilia depend on the copy in hand. */
const CACHEABLE = ['player', 'year', 'set_name', 'insert_name', 'card_number', 'team', 'sport', 'is_rookie']

/** Same normalization as the database's checklist_norm() and the app's duplicate matching. */
const norm = (value: unknown) => (typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '')

/** The cache entry for this card, if exactly one fits what was read with confidence. */
export function findSpot(reading: Reading, entries: Entry[]): Entry | null {
  const unsure = new Set(reading.uncertain_fields ?? [])
  const known = (f: string) => !unsure.has(f) && norm(reading[f]) !== ''
  const one = (list: Entry[]) => (list.length === 1 ? list[0] : null)

  if (known('year') && known('set_name') && known('card_number')) {
    const spot = entries.filter(
      (e) =>
        norm(e.year) === norm(reading.year) &&
        norm(e.set_name) === norm(reading.set_name) &&
        norm(e.card_number) === norm(reading.card_number),
    )
    // The insert tells apart a base #1 and an insert #1 in the same set.
    const withInsert = spot.filter((e) => norm(e.insert_name) === norm(reading.insert_name))
    const found = one(withInsert) ?? one(spot)
    if (found) return found
  }
  if (known('player') && known('card_number')) {
    return one(
      entries.filter((e) => norm(e.player) === norm(reading.player) && norm(e.card_number) === norm(reading.card_number)),
    )
  }
  return null
}

/**
 * Settles a card from the cache when every doubt is something a checklist spot answers; otherwise null
 * (the web search runs, with the cache entry as a hint). Same shape as a checklist search's result.
 */
export function resolveFromCache(reading: Reading, entries: Entry[], fields: readonly string[]) {
  const entry = findSpot(reading, entries)
  if (!entry || (reading.uncertain_fields ?? []).some((f) => !CACHEABLE.includes(f))) return null
  const settled: Record<string, unknown> = {
    ...Object.fromEntries(fields.map((f) => [f, reading[f]])),
    player: entry.player,
    year: entry.year,
    set_name: entry.set_name,
    insert_name: entry.insert_name,
    card_number: entry.card_number,
    team: entry.team ?? reading.team,
    sport: entry.sport ?? reading.sport,
    is_rookie: entry.is_rookie,
  }
  return {
    fields: settled,
    changed: fields.filter((f) => norm(settled[f]) !== norm(reading[f]) || (f === 'is_rookie' && settled[f] !== reading[f])),
    confirmed: CACHEABLE,
    still_uncertain: [] as string[],
    sources: entry.source_url ? [{ url: entry.source_url, title: 'Earlier checklist search' }] : [],
    notes:
      entry.source === 'collection'
        ? 'Matched a card already in your collection, so no web search was needed.'
        : 'Matched an earlier checklist search, so no new web search was needed.',
    searches: 0,
    cached: entry.source,
  }
}

/** A one-line hint for the web search when the cache knows the spot but can't settle everything. */
export function cacheHint(entry: Entry | null): string {
  if (!entry) return ''
  const where = entry.source === 'collection' ? 'a card in the collection' : 'an earlier checklist search'
  const insert = entry.insert_name ? ` ${entry.insert_name}` : ''
  return `Known from ${where}: ${entry.year} ${entry.set_name}${insert} #${entry.card_number} is ${entry.player}${
    entry.team ? ` (${entry.team})` : ''
  }${entry.is_rookie ? ', a rookie card' : ''}.`
}

/** What a settled checklist search adds to the cache; null if it didn't settle the card's identity. */
export function entryFromSearch(
  fields: Record<string, unknown>,
  stillUncertain: string[],
  sourceUrl: string | null,
): Omit<Entry, 'source'> & { source: 'search' } | null {
  const core = ['player', 'year', 'set_name', 'card_number']
  if (core.some((f) => stillUncertain.includes(f) || norm(fields[f]) === '')) return null
  const text = (f: string) => (typeof fields[f] === 'string' ? (fields[f] as string).trim() : '')
  return {
    year: text('year'),
    set_name: text('set_name'),
    insert_name: text('insert_name'),
    card_number: text('card_number'),
    player: text('player'),
    team: text('team') || null,
    sport: text('sport') || null,
    is_rookie: fields.is_rookie === true,
    source: 'search',
    source_url: sourceUrl,
  }
}
