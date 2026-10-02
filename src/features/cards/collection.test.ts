import { describe, expect, it } from 'vitest'
import { makeCard } from '../../test/makeCard'
import { distinctValues, emptyFilters, filterCards, summarize } from './collection'

const ohtani = makeCard({ player: 'Shohei Ohtani', team: 'Dodgers', is_rookie: true, estimated_value: 100, quantity: 2 })
const soto = makeCard({ player: 'Juan Soto', set_name: 'Bowman Chrome', is_auto: true, print_run: 99, purchase_price: 40 })
const mahomes = makeCard({ player: 'Patrick Mahomes', sport: 'Football', year: '2017', estimated_value: 50 })
const sold = makeCard({ player: 'Sold Guy', sold_price: 20, estimated_value: 999 })
const all = [ohtani, soto, mahomes, sold]

describe('filterCards', () => {
  it('hides sold cards by default', () => {
    expect(filterCards(all, emptyFilters)).toEqual([ohtani, soto, mahomes])
  })

  it('shows only sold cards when asked', () => {
    expect(filterCards(all, { ...emptyFilters, ownership: 'sold' })).toEqual([sold])
  })

  it('matches every search word anywhere in the card', () => {
    expect(filterCards(all, { ...emptyFilters, search: 'ohtani dodgers' })).toEqual([ohtani])
    expect(filterCards(all, { ...emptyFilters, search: 'bowman soto' })).toEqual([soto])
    expect(filterCards(all, { ...emptyFilters, search: 'ohtani bowman' })).toEqual([])
  })

  it('filters by field values case-insensitively', () => {
    expect(filterCards(all, { ...emptyFilters, fields: { sport: 'football' } })).toEqual([mahomes])
  })

  it('combines flags', () => {
    expect(filterCards(all, { ...emptyFilters, flags: ['is_auto', 'numbered'] })).toEqual([soto])
    expect(filterCards(all, { ...emptyFilters, flags: ['is_rookie', 'numbered'] })).toEqual([])
  })
})

describe('distinctValues', () => {
  it('dedupes case-insensitively and sorts', () => {
    const cards = [makeCard({ team: 'dodgers' }), makeCard({ team: 'Angels' }), makeCard({ team: 'Dodgers' })]
    expect(distinctValues(cards, 'team')).toEqual(['Angels', 'dodgers'])
  })

  it('sorts years newest first', () => {
    const cards = [makeCard({ year: '2019' }), makeCard({ year: '2023-24' }), makeCard({ year: '2021' })]
    expect(distinctValues(cards, 'year')).toEqual(['2023-24', '2021', '2019'])
  })
})

describe('summarize', () => {
  it('totals owned cards with quantity, ignoring sold ones', () => {
    expect(summarize(all)).toEqual({
      entries: 3,
      totalCards: 4,
      valuedCards: 3,
      totalValue: 250,
      totalCost: 40,
    })
  })
})
