import { describe, expect, it } from 'vitest'
import { rainbowHint, rowsFromSearch, settleParallel, type Rainbow } from './rainbow'

const p = (parallel: string, print_run: number | null, overrides: Partial<Rainbow> = {}): Rainbow => ({
  year: '2011',
  set_name: 'Bowman Chrome Draft',
  insert_name: '',
  parallel,
  print_run,
  source: 'search',
  source_url: null,
  ...overrides,
})

const rainbow = [p('Refractor', null), p('Gold Refractor', 50), p('Red Refractor', 5), p('Superfractor', 1), p('Printing Plate Cyan', 1)]

const reading = {
  player: 'Dylan Bundy',
  year: '2011',
  set_name: 'Bowman Chrome Draft',
  insert_name: '',
  parallel: 'Pink Refractor',
  card_number: 'BDPP1',
  serial_number: 3,
  print_run: 5,
  uncertain_fields: ['parallel'],
  needs_lookup: true,
}

describe('settleParallel', () => {
  it('settles an unsure parallel from the print run, so no search is needed', () => {
    const result = settleParallel(reading, rainbow)
    expect(result?.reading).toMatchObject({ parallel: 'Red Refractor', uncertain_fields: [], needs_lookup: false })
    expect(result?.rainbow).toEqual({
      kind: 'settled',
      was: 'Pink Refractor',
      note: 'The only /5 parallel in 2011 Bowman Chrome Draft is Red Refractor.',
    })
  })

  it('keeps other doubts and the lookup they need', () => {
    const result = settleParallel({ ...reading, uncertain_fields: ['parallel', 'team'] }, rainbow)
    expect(result?.reading).toMatchObject({ uncertain_fields: ['team'], needs_lookup: true })
  })

  it('lists the choices when several parallels share the print run', () => {
    const result = settleParallel({ ...reading, print_run: 1, serial_number: 1 }, rainbow)
    expect(result?.reading.parallel).toBe('Pink Refractor')
    expect(result?.rainbow).toMatchObject({ kind: 'choices' })
  })

  it('flags a confident parallel that the print run contradicts', () => {
    const result = settleParallel({ ...reading, parallel: 'Gold Refractor', uncertain_fields: [] }, rainbow)
    expect(result?.reading.uncertain_fields).toEqual(['parallel'])
    expect(result?.rainbow.note).toBe('Gold Refractor is /50 in 2011 Bowman Chrome Draft, but the serial reads /5. Check both.')
  })

  it('does nothing without a confident set and print run, or a match', () => {
    expect(settleParallel({ ...reading, uncertain_fields: ['parallel', 'set_name'] }, rainbow)).toBeNull()
    expect(settleParallel({ ...reading, print_run: null }, rainbow)).toBeNull()
    expect(settleParallel({ ...reading, print_run: 77 }, rainbow)).toBeNull()
    expect(settleParallel({ ...reading, insert_name: 'Prospect Autographs' }, rainbow)).toBeNull()
    expect(settleParallel({ ...reading, parallel: 'Red Refractor', uncertain_fields: [] }, rainbow)).toBeNull()
  })
})

describe('rainbowHint', () => {
  it('lists the set’s parallels for the search prompt', () => {
    expect(rainbowHint(reading, rainbow.slice(0, 3))).toBe(
      'Known parallels of this set: Refractor (not numbered), Gold Refractor /50, Red Refractor /5.',
    )
    expect(rainbowHint({ ...reading, year: '2012' }, rainbow)).toBe('')
  })
})

describe('rowsFromSearch', () => {
  it('cleans what the search recorded, dropping base and bad print runs', () => {
    const rows = rowsFromSearch(
      '2011',
      'Bowman Chrome Draft',
      [
        { insert_name: '', parallels: [{ name: 'Base', print_run: null }, { name: ' Red Refractor ', print_run: 5 }] },
        { insert_name: 'Prospect Autographs', parallels: [{ name: 'Refractor', print_run: 0 }] },
      ],
      'https://example.com',
    )
    expect(rows.map((r) => [r.insert_name, r.parallel, r.print_run])).toEqual([
      ['', 'Red Refractor', 5],
      ['Prospect Autographs', 'Refractor', null],
    ])
  })
})
