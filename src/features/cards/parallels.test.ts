import { describe, expect, it } from 'vitest'
import {
  cardNumbering,
  firstOptions,
  hasParallelList,
  matchParallel,
  parallelOptions,
  parallelsFor,
  parallelSuggestions,
  shortlist,
  type SetParallel,
} from './parallels'

const p = (parallel: string, print_run: number | null, overrides: Partial<SetParallel> = {}): SetParallel => ({
  year: '2011',
  set_name: 'Bowman Chrome Draft',
  insert_name: '',
  parallel,
  print_run,
  source: 'search',
  ...overrides,
})

const rainbow = [
  p('Refractor', null),
  p('Blue Refractor', 199),
  p('Gold Refractor', 50),
  p('Red Refractor', 5),
  p('Superfractor', 1),
  p('Printing Plate Black', 1),
  p('Red Refractor', 5, { insert_name: 'Prospect Autographs', parallel: 'Red Refractor Auto' }),
]

const typed = { year: '2011', set_name: 'bowman chrome draft', insert_name: '', parallel: '', print_run: '' }

describe('parallelsFor', () => {
  it('lists one set and insert, unnumbered first, then by print run', () => {
    expect(parallelsFor(rainbow, typed).map((r) => r.parallel)).toEqual([
      'Refractor',
      'Blue Refractor',
      'Gold Refractor',
      'Red Refractor',
      'Printing Plate Black',
      'Superfractor',
    ])
  })
})

describe('matchParallel', () => {
  it('fills the only parallel with that print run', () => {
    expect(matchParallel(rainbow, { ...typed, print_run: '5' })).toEqual({
      kind: 'fill',
      parallel: 'Red Refractor',
      text: 'the only /5 parallel in 2011 Bowman Chrome Draft',
    })
  })

  it('offers choices when several share the print run', () => {
    const match = matchParallel(rainbow, { ...typed, print_run: '1' })
    expect(match).toMatchObject({ kind: 'choices', options: ['Printing Plate Black', 'Superfractor'] })
  })

  it('fills the print run from a typed parallel', () => {
    expect(matchParallel(rainbow, { ...typed, parallel: 'gold refractor' })).toMatchObject({
      kind: 'printRun',
      printRun: 50,
    })
  })

  it('warns when the print run contradicts the list', () => {
    expect(matchParallel(rainbow, { ...typed, parallel: 'Red Refractor', print_run: '10' })).toMatchObject({
      kind: 'conflict',
    })
    expect(matchParallel(rainbow, { ...typed, parallel: 'Pink Refractor', print_run: '5' })).toEqual({
      kind: 'conflict',
      text: 'In 2011 Bowman Chrome Draft, /5 is Red Refractor.',
    })
  })

  it('keeps inserts apart and stays quiet without a match', () => {
    const autos = { ...typed, insert_name: 'Prospect Autographs', print_run: '5' }
    expect(matchParallel(rainbow, autos)).toMatchObject({ kind: 'fill', parallel: 'Red Refractor Auto' })
    expect(matchParallel(rainbow, { ...typed, print_run: '77' })).toBeNull()
    expect(matchParallel(rainbow, { ...typed, parallel: 'Red Refractor', print_run: '5' })).toBeNull()
    expect(matchParallel(rainbow, { ...typed, year: '2012', print_run: '5' })).toBeNull()
  })
})

describe('hasParallelList', () => {
  it('counts fetched or entered lists, not parallels learned from single cards', () => {
    expect(hasParallelList(rainbow, '2011', 'Bowman Chrome Draft')).toBe(true)
    expect(hasParallelList([p('Refractor', null, { source: 'collection' })], '2011', 'Bowman Chrome Draft')).toBe(false)
  })
})

describe('parallelSuggestions', () => {
  it('puts the set’s parallels first without repeating them', () => {
    expect(parallelSuggestions(rainbow.slice(0, 2), typed, ['Silver', 'refractor'])).toEqual([
      'Refractor',
      'Blue Refractor',
      'Silver',
    ])
  })
})

describe('parallelOptions', () => {
  it('lists the set and insert’s rainbow with print runs', () => {
    expect(parallelOptions(rainbow, typed).map((o) => o.label)).toEqual([
      'Refractor',
      'Blue Refractor /199',
      'Gold Refractor /50',
      'Red Refractor /5',
      'Printing Plate Black 1/1',
      'Superfractor 1/1',
    ])
    expect(parallelOptions(rainbow, { ...typed, insert_name: 'Prospect Autographs' }).map((o) => o.label)).toEqual([
      'Red Refractor Auto /5',
    ])
  })

  it('suggests the parallels of a typed print run, and marks a typed parallel', () => {
    const marked = (values: typeof typed) =>
      parallelOptions(rainbow, values)
        .filter((o) => o.state)
        .map((o) => [o.parallel, o.state])
    expect(marked({ ...typed, print_run: '1' })).toEqual([
      ['Printing Plate Black', 'suggested'],
      ['Superfractor', 'suggested'],
    ])
    expect(marked({ ...typed, parallel: 'gold refractor', print_run: '1' })).toEqual([['Gold Refractor', 'selected']])
  })

  it('keeps a long rainbow short without hiding what’s marked', () => {
    const options = parallelOptions(rainbow, { ...typed, print_run: '1' })
    expect(firstOptions(options, 2).map((o) => o.parallel)).toEqual([
      'Refractor',
      'Blue Refractor',
      'Printing Plate Black',
      'Superfractor',
    ])
  })

  it('shows only the parallels numbered like the card before "All"', () => {
    const names = (values: typeof typed, unnumbered = false) => {
      const short = shortlist(parallelOptions(rainbow, values), cardNumbering(values.print_run, unnumbered), 12)
      return [short.base, short.options.map((o) => o.parallel)]
    }
    expect(names({ ...typed, print_run: '1' })).toEqual([false, ['Printing Plate Black', 'Superfractor']])
    expect(names({ ...typed, print_run: '99' })).toEqual([false, []])
    // A typed parallel that doesn't fit still shows, so the mismatch is visible.
    expect(names({ ...typed, parallel: 'Gold Refractor', print_run: '5' })).toEqual([
      false,
      ['Gold Refractor', 'Red Refractor'],
    ])
    // A scan that found no serial number: only the unnumbered ones, and Base.
    expect(names({ ...typed, print_run: '' }, true)).toEqual([true, ['Refractor']])
    // Nothing known yet: the first ones, as before.
    expect(names({ ...typed, print_run: '' })[1]).toHaveLength(6)
  })
})
