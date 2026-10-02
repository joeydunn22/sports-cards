import { describe, expect, it } from 'vitest'
import { makeCard } from '../../test/makeCard'
import { cardFormSchema, emptyCardForm, fromCard, stickyForm, toCardInput, type CardFormValues } from './cardSchema'

const valid: CardFormValues = {
  ...emptyCardForm,
  player: ' Shohei Ohtani ',
  year: '2023',
  set_name: 'Topps Finest',
  card_number: '#12',
  sport: 'Baseball',
  parallel: 'Red Refractor',
  serial_number: '3',
  print_run: '5',
}

function errorsFor(values: CardFormValues) {
  const result = cardFormSchema.safeParse(values)
  return result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('cardFormSchema', () => {
  it('accepts a valid card', () => {
    expect(cardFormSchema.safeParse(valid).success).toBe(true)
  })

  it('requires player, year, set, card number and sport', () => {
    const errors = errorsFor(emptyCardForm)
    expect(Object.keys(errors).sort()).toEqual(['card_number', 'player', 'set_name', 'sport', 'year'])
  })

  it('rejects a serial above the print run', () => {
    expect(errorsFor({ ...valid, serial_number: '6' })).toHaveProperty('serial_number')
  })

  it('requires a print run when a serial is given', () => {
    expect(errorsFor({ ...valid, print_run: '' })).toHaveProperty('print_run')
  })

  it('accepts a print run alone', () => {
    expect(cardFormSchema.safeParse({ ...valid, serial_number: '' }).success).toBe(true)
  })

  it('accepts money with $ and commas, rejects junk', () => {
    expect(cardFormSchema.safeParse({ ...valid, purchase_price: '$1,200.50' }).success).toBe(true)
    expect(errorsFor({ ...valid, estimated_value: 'lots' })).toHaveProperty('estimated_value')
  })
})

describe('toCardInput', () => {
  it('trims text, strips # and converts numbers', () => {
    const input = toCardInput({ ...valid, purchase_price: '$1,200.50' })
    expect(input).toMatchObject({
      player: 'Shohei Ohtani',
      card_number: '12',
      serial_number: 3,
      print_run: 5,
      quantity: 1,
      purchase_price: 1200.5,
      team: null,
      insert_name: null,
    })
  })

  it('drops grading fields when not graded, and raw condition when graded', () => {
    const raw = toCardInput({ ...valid, grade_company: 'PSA', grade: '10', raw_condition: 'NM' })
    expect(raw).toMatchObject({ grade_company: null, grade: null, raw_condition: 'NM' })

    const graded = toCardInput({ ...valid, is_graded: true, grade_company: 'PSA', grade: '10', raw_condition: 'NM' })
    expect(graded).toMatchObject({ grade_company: 'PSA', grade: '10', raw_condition: null })
  })
})

describe('fromCard', () => {
  it('round-trips through the form', () => {
    const card = makeCard({ serial_number: 23, print_run: 99, estimated_value: 45.5, team: 'Dodgers' })
    expect(toCardInput(fromCard(card))).toMatchObject({
      serial_number: 23,
      print_run: 99,
      estimated_value: 45.5,
      team: 'Dodgers',
    })
  })
})

describe('stickyForm', () => {
  it('keeps year, set, insert and sport only', () => {
    const next = stickyForm({ ...valid, insert_name: 'Future Stars' })
    expect(next).toMatchObject({
      year: '2023',
      set_name: 'Topps Finest',
      insert_name: 'Future Stars',
      sport: 'Baseball',
      player: '',
      card_number: '',
      parallel: '',
      serial_number: '',
    })
  })
})
