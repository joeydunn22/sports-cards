import { describe, expect, it } from 'vitest'
import { emptyCardForm } from '../cards/cardSchema'
import { asExtraction, extractionCost, extractionToForm, fieldNotes, inboxSection, needsYouReason } from './extraction'

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

describe('checklist lookup', () => {
  const reading = {
    player: 'Shohei Ohtani',
    set_name: 'Topps Chrome',
    parallel: 'Refractor',
    year: '2023',
    inferred_fields: ['year', 'set_name'],
    uncertain_fields: ['set_name', 'parallel'],
  }
  const lookup = {
    fields: { ...reading, set_name: 'Topps Finest' },
    changed: ['set_name'],
    confirmed: ['set_name', 'year'],
    still_uncertain: ['parallel'],
  }

  it('fills the form with what the search settled', () => {
    expect(extractionToForm({ ...reading, lookup }, emptyCardForm).set_name).toBe('Topps Finest')
  })

  it('notes corrections and what is still open, and drops notes the search confirmed', () => {
    const notes = fieldNotes({ ...reading, lookup })
    expect(notes.set_name).toBe('Corrected by the checklist search (first read as “Topps Chrome”).')
    expect(notes.parallel).toMatch(/didn’t settle/)
    expect(notes.year).toBeUndefined()
  })

  it('keeps the first reading’s notes when the search failed', () => {
    const notes = fieldNotes({ ...reading, lookup: { error: 'The checklist search didn’t finish.' } })
    expect(notes.parallel).toMatch(/isn’t sure/)
  })

  it('adds the search to the cost', () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 0 }
    const cost = extractionCost({
      model: 'claude-sonnet-5-5',
      usage,
      lookup: { model: 'claude-sonnet-5-5', usage, searches: 2 },
    })
    expect(cost?.dollars).toBeCloseTo(1 + 1 + 0.02)
  })
})

describe('fieldNotes', () => {
  it('flags guessed and uncertain fields', () => {
    const notes = fieldNotes({ inferred_fields: ['year'], uncertain_fields: ['parallel'] })
    expect(notes.year).toMatch(/guessed/)
    expect(notes.parallel).toMatch(/isn’t sure/)
  })
})

describe('inboxSection', () => {
  const scan = (status: string, extraction: object | null = {}) => ({ status, extraction: extraction as never })

  it('sorts cards by what they need', () => {
    expect(inboxSection(scan('pending', null))).toBe('unread')
    expect(inboxSection(scan('looking_up'))).toBe('reading')
    expect(inboxSection(scan('ready', { triage: 'ready' }))).toBe('ready')
    expect(inboxSection(scan('ready', { triage: 'lookup', lookup: { still_uncertain: ['parallel'] } }))).toBe('ready')
  })

  it('sends unsettled cards to the collector, not back to the search', () => {
    expect(inboxSection(scan('failed', null))).toBe('needs-you')
    expect(inboxSection(scan('ready', { triage: 'retake', retake: 'Glare' }))).toBe('needs-you')
    expect(inboxSection(scan('ready', { triage: 'unidentified' }))).toBe('needs-you')
    const open = scan('ready', { triage: 'lookup', lookup: { still_uncertain: ['set_name', 'year'] } })
    expect(inboxSection(open)).toBe('needs-you')
    expect(needsYouReason(open)).toBe('Checklist didn’t settle: Set, Year')
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
