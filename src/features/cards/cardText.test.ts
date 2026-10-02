import { describe, expect, it } from 'vitest'
import { makeCard } from '../../test/makeCard'
import { cardTitle, cleanCardNumber, setNameWarning } from './cardText'

describe('cardTitle', () => {
  it('builds the full title in hobby order', () => {
    const card = makeCard({
      year: '2023',
      set_name: 'Topps Finest',
      parallel: 'Red Refractor',
      player: 'Shohei Ohtani',
      card_number: '12',
      serial_number: 3,
      print_run: 5,
    })
    expect(cardTitle(card)).toBe('2023 Topps Finest Red Refractor Shohei Ohtani #12 3/5')
  })

  it('skips empty parts and appends flags and grade', () => {
    const card = makeCard({
      year: '2018',
      set_name: 'Bowman Chrome',
      insert_name: 'Prospect Autographs',
      player: 'Juan Soto',
      card_number: 'CPA-JS',
      is_rookie: true,
      is_auto: true,
      is_graded: true,
      grade_company: 'PSA',
      grade: '10',
    })
    expect(cardTitle(card)).toBe('2018 Bowman Chrome Prospect Autographs Juan Soto #CPA-JS RC Auto PSA 10')
  })

  it('ignores grading fields when not graded', () => {
    expect(cardTitle(makeCard({ grade_company: 'PSA', grade: '9', is_graded: false }))).not.toContain('PSA')
  })
})

describe('cleanCardNumber', () => {
  it('strips a leading #', () => {
    expect(cleanCardNumber('#12')).toBe('12')
    expect(cleanCardNumber(' # RC-5 ')).toBe('RC-5')
  })
})

describe('setNameWarning', () => {
  it('flags parallel words in the set', () => {
    expect(setNameWarning('Topps Finest Refractor')).toMatch(/Refractor/)
    expect(setNameWarning('Prizm Silver')).toMatch(/Silver/)
  })

  it('allows normal set names', () => {
    expect(setNameWarning('Topps Finest')).toBeNull()
    expect(setNameWarning('Panini Prizm')).toBeNull()
    expect(setNameWarning('Bowman Chrome')).toBeNull()
  })
})
