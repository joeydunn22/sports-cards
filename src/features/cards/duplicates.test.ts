import { describe, expect, it } from 'vitest'
import { makeCard } from '../../test/makeCard'
import { findDuplicates } from './duplicates'

const base = {
  player: 'Ken Griffey Jr.',
  year: '1989',
  set_name: 'Upper Deck',
  insert_name: null,
  parallel: null,
  card_number: '1',
  serial_number: null,
  is_graded: false,
  cert_number: null,
}

describe('findDuplicates', () => {
  it('matches regardless of case, spacing and punctuation', () => {
    const card = makeCard({ ...base, player: 'ken griffey jr', set_name: 'upper  deck', card_number: '#1' })
    expect(findDuplicates(base, [card])).toEqual([{ card, kind: 'mergeable' }])
  })

  it('treats a different parallel, insert or number as a different card', () => {
    const cards = [
      makeCard({ ...base, parallel: 'Refractor' }),
      makeCard({ ...base, insert_name: 'Star Rookies' }),
      makeCard({ ...base, card_number: '2' }),
      makeCard({ ...base, year: '1990' }),
    ]
    expect(findDuplicates(base, cards)).toEqual([])
  })

  it('ignores sold cards and the card being edited', () => {
    const sold = makeCard({ ...base, sold_date: '2026-01-01' })
    const self = makeCard(base)
    expect(findDuplicates(base, [sold, self], self.id)).toEqual([])
  })

  it('keeps numbered copies apart unless the serial matches', () => {
    const numbered = { ...base, serial_number: 12, print_run: 99 }
    const other = makeCard({ ...numbered, serial_number: 45 })
    const same = makeCard(numbered)
    const unknownSerial = makeCard({ ...base, serial_number: null, print_run: 99 })
    expect(findDuplicates(numbered, [other, unknownSerial, same])).toEqual([
      { card: same, kind: 'same-copy' },
      { card: unknownSerial, kind: 'other-copy' },
    ])
  })

  it('treats graded slabs as separate copies unless the cert matches', () => {
    const graded = { ...base, is_graded: true, cert_number: '12345678' }
    const sameSlab = makeCard({ ...graded, cert_number: '12345678' })
    const otherSlab = makeCard({ ...graded, cert_number: '99999999' })
    const raw = makeCard(base)
    expect(findDuplicates(graded, [raw, otherSlab, sameSlab]).map((m) => [m.card, m.kind])).toEqual([
      [sameSlab, 'same-copy'],
      [raw, 'other-copy'],
      [otherSlab, 'other-copy'],
    ])
  })
})
