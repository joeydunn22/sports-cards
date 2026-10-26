import { describe, expect, it } from 'vitest'
import { listSets, parseParallelsCsv, parseSetLines, setPath } from './setIndex'

const bcd = { year: '2011', set_name: 'Bowman Chrome Draft' }

describe('listSets', () => {
  it('merges parallels, checklist spots and fetches per set, newest year first', () => {
    const sets = listSets(
      [
        { ...bcd, source: 'search' },
        { ...bcd, source: 'collection' },
        { year: '2023', set_name: 'Topps Finest', source: 'collection' },
      ],
      [{ year: '2011', set_name: 'bowman chrome draft' }],
      [{ year: '2024', set_name: 'Topps Chrome', status: 'pending' }],
    )
    expect(sets.map((s) => [s.year, s.set_name, s.parallels, s.cards, s.hasList, s.fetch?.status ?? null])).toEqual([
      ['2024', 'Topps Chrome', 0, 0, false, 'pending'],
      ['2023', 'Topps Finest', 1, 0, false, null],
      ['2011', 'Bowman Chrome Draft', 2, 1, true, null],
    ])
  })
})

describe('parseSetLines', () => {
  it('reads one set per line and reports lines without a year', () => {
    expect(parseSetLines('2011 Bowman Chrome Draft\n\n 2023-24  Panini Prizm \nTopps Chrome\n2011 bowman chrome draft')).toEqual({
      sets: [bcd, { year: '2023-24', set_name: 'Panini Prizm' }],
      bad: ['Topps Chrome'],
    })
  })
})

describe('parseParallelsCsv', () => {
  it('reads rows, with a blank print run meaning not numbered', () => {
    const csv = 'Year,Set,Insert,Parallel,Print Run\n2011,Bowman Chrome Draft,,Refractor,\n2011,Bowman Chrome Draft,,Red Refractor,/5\n'
    expect(parseParallelsCsv(csv)).toEqual({
      rows: [
        { ...bcd, insert_name: '', parallel: 'Refractor', print_run: null },
        { ...bcd, insert_name: '', parallel: 'Red Refractor', print_run: 5 },
      ],
      errors: [],
    })
  })

  it('reports bad rows and a missing header', () => {
    expect(parseParallelsCsv('year,set,parallel,print_run\n2011,,Red,5\n2011,BCD,Red,five').errors).toEqual([
      'Line 2: year, set and parallel are required.',
      'Line 3: the print run should be a number, like 99.',
    ])
    expect(parseParallelsCsv('a,b\n1,2').errors).toHaveLength(1)
  })
})

describe('setPath', () => {
  it('encodes the set for the URL', () => {
    expect(setPath({ year: '2023-24', set_name: 'Upper Deck Series 1' })).toBe('/sets/2023-24/Upper%20Deck%20Series%201')
  })
})
