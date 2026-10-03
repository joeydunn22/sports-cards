import { describe, expect, it } from 'vitest'
import { emptyCardForm } from '../cards/cardSchema'
import { asExtraction, extractionCost, extractionToForm, fieldNotes } from './extraction'

describe('extractionToForm', () => {
  it('fills the form from the AI reading', () => {
    const values = extractionToForm(
      {
        player: 'Shohei Ohtani',
        year: '2023',
        set_name: 'Topps Finest',
        insert_name: '',
        parallel: 'Red Refractor',
        card_number: '12',
        sport: 'Baseball',
        team: 'Los Angeles Angels',
        is_rookie: false,
        is_auto: false,
        is_patch: false,
        is_relic: false,
        serial_number: 3,
        print_run: 5,
      },
      emptyCardForm,
    )
    expect(values).toMatchObject({
      player: 'Shohei Ohtani',
      set_name: 'Topps Finest',
      parallel: 'Red Refractor',
      serial_number: '3',
      print_run: '5',
    })
  })

  it('keeps fallback values for blank required fields and missing data', () => {
    const fallback = { ...emptyCardForm, sport: 'Baseball', set_name: 'Bowman Chrome' }
    const values = extractionToForm({ player: 'A', sport: ' ', serial_number: null }, fallback)
    expect(values.sport).toBe('Baseball')
    expect(values.set_name).toBe('Bowman Chrome')
    expect(values.serial_number).toBe('')
  })
})

describe('fieldNotes', () => {
  it('flags guessed and uncertain fields', () => {
    const notes = fieldNotes({ inferred_fields: ['year'], uncertain_fields: ['parallel'] })
    expect(notes.year).toMatch(/guessed/)
    expect(notes.parallel).toMatch(/isn’t sure/)
  })
})

describe('extractionCost', () => {
  it('prices a Sonnet batch request', () => {
    const cost = extractionCost({
      model: 'claude-sonnet-5-5',
      usage: { input_tokens: 4000, output_tokens: 1000, cache_read_input_tokens: 2000 },
    })
    // (4000 + 200) * $1/M + 1000 * $5/M
    expect(cost?.dollars).toBeCloseTo(0.0092)
    expect(cost?.model).toBe('Sonnet 5.5')
  })

  it('returns null without usage', () => {
    expect(extractionCost({})).toBeNull()
  })
})

describe('asExtraction', () => {
  it('accepts objects only', () => {
    expect(asExtraction(null)).toBeNull()
    expect(asExtraction([1])).toBeNull()
    expect(asExtraction({ player: 'A' })).toEqual({ player: 'A' })
  })
})
