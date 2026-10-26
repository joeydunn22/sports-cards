import { describe, expect, it } from 'vitest'
import { hasParallelList, matchParallel, parallelsFor, parallelSuggestions, type SetParallel } from './parallels'

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
