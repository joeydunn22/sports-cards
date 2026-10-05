import { describe, expect, it } from 'vitest'
import { cacheHint, entryFromSearch, findSpot, resolveFromCache, type Entry } from './cache'
import { FIELDS } from './prompt'

const entry = (overrides: Partial<Entry> = {}): Entry => ({
  year: '2023',
  set_name: 'Bowman Chrome',
  insert_name: '',
  card_number: '150',
  player: 'Corbin Carroll',
  team: 'Arizona Diamondbacks',
  sport: 'Baseball',
  is_rookie: true,
  source: 'collection',
  source_url: null,
  ...overrides,
})

const reading = {
  player: 'Corbin Carroll',
  year: '2023',
  set_name: 'bowman chrome',
  insert_name: '',
  parallel: 'Refractor',
  card_number: '150',
  team: '',
  is_rookie: false,
  uncertain_fields: ['team', 'is_rookie'],
}

describe('findSpot', () => {
  it('finds the spot by year, set and number, using the insert to break ties', () => {
    const base = entry()
    const insert = entry({ insert_name: 'Prospects', player: 'Someone Else' })
    expect(findSpot(reading, [insert, base])).toBe(base)
  })

  it('falls back to player and number when the set or year is in doubt', () => {
    const found = entry()
    expect(findSpot({ ...reading, set_name: 'Topps Chrome', uncertain_fields: ['set_name'] }, [found])).toBe(found)
  })

  it('gives up when the match is ambiguous', () => {
    const two = [entry(), entry({ year: '2024' })]
    expect(findSpot({ ...reading, uncertain_fields: ['year'] }, two)).toBeNull()
  })
})

describe('resolveFromCache', () => {
  it('settles doubts a checklist spot can answer, for free', () => {
    const result = resolveFromCache(reading, [entry()], FIELDS)
    expect(result?.fields).toMatchObject({ team: 'Arizona Diamondbacks', is_rookie: true, parallel: 'Refractor' })
    expect(result?.changed).toEqual(['sport', 'team', 'is_rookie'])
    expect(result?.searches).toBe(0)
  })

  it('leaves doubts about the copy in hand to the web search', () => {
    expect(resolveFromCache({ ...reading, uncertain_fields: ['parallel'] }, [entry()], FIELDS)).toBeNull()
    expect(cacheHint(entry())).toBe(
      'Known from a card in the collection: 2023 Bowman Chrome #150 is Corbin Carroll (Arizona Diamondbacks), a rookie card.',
    )
  })
})

describe('entryFromSearch', () => {
  it('keeps a search only when it settled the card’s identity', () => {
    const fields = { player: 'Corbin Carroll', year: '2023', set_name: 'Bowman Chrome', card_number: '150', is_rookie: true }
    expect(entryFromSearch(fields, ['parallel'], 'https://example.com')).toMatchObject({
      player: 'Corbin Carroll',
      insert_name: '',
      source: 'search',
      source_url: 'https://example.com',
    })
    expect(entryFromSearch(fields, ['year'], null)).toBeNull()
  })
})
