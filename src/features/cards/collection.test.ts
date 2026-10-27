import { describe, expect, it } from 'vitest'
import { makeCard } from '../../test/makeCard'
import { distinctValues, emptyFilters, filterCards, groupCards, summarize } from './collection'

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
      players: 3,
      sets: 3,
    })
  })
})

describe('groupCards', () => {
  const a = makeCard({ player: 'Shohei Ohtani', year: '2023', set_name: 'Topps', team: 'Los Angeles Angels' })
  const b = makeCard({ player: 'Shohei Ohtani', year: '2023', set_name: 'topps', team: 'Los Angeles Angels', front_image_path: 'p/b.webp' })
  const c = makeCard({ player: 'Mike Trout', year: '2011', set_name: 'Topps Update', team: 'los angeles angels', quantity: 3 })
  const d = makeCard({ player: 'Juan Soto', year: '2023', set_name: 'Topps', team: null })

  it('groups by set (year + set, any case), biggest first then by name, with a cover photo when one exists', () => {
    const groups = groupCards([a, b, c, d], 'set')
    expect(groups.map((g) => [g.label, g.count])).toEqual([
      ['2011 Topps Update', 3],
      ['2023 Topps', 3],
    ])
    expect(groups[1].cover).toBe(b)
    expect(groups[1].fields).toEqual({ year: '2023', set_name: 'Topps' })
  })

  it('groups players by name and leaves teamless cards out of the team view', () => {
    expect(groupCards([a, b, c, d], 'player').map((g) => [g.label, g.count])).toEqual([
      ['Mike Trout', 3],
      ['Shohei Ohtani', 2],
      ['Juan Soto', 1],
    ])
    const teams = groupCards([a, b, c, d], 'team')
    expect(teams.map((g) => [g.label, g.count])).toEqual([['Los Angeles Angels', 5]])
    expect(teams[0].fields).toEqual({ team: 'Los Angeles Angels' })
  })
})
