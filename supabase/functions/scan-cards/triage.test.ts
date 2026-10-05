import { describe, expect, it } from 'vitest'
import { triage } from './triage'

describe('triage', () => {
  it('is ready when the AI is confident', () => {
    expect(triage({ uncertain_fields: [], needs_lookup: false, retake: '' })).toBe('ready')
    expect(triage({ uncertain_fields: ['team'], needs_lookup: false, retake: '' })).toBe('ready')
  })

  it('looks up a specific doubt on a card it can search for', () => {
    expect(triage({ uncertain_fields: ['parallel'], needs_lookup: true, retake: '' })).toBe('lookup')
    expect(triage({ uncertain_fields: ['year', 'set_name'], needs_lookup: true, retake: '' })).toBe('lookup')
  })

  it('asks for a retake instead of searching when the photo is the problem', () => {
    expect(triage({ uncertain_fields: ['serial_number'], needs_lookup: true, retake: 'Glare on the serial.' })).toBe(
      'retake',
    )
  })

  it('does not search when too little of the card was read', () => {
    expect(triage({ uncertain_fields: ['player', 'card_number'], needs_lookup: true, retake: '' })).toBe(
      'unidentified',
    )
    expect(triage({ uncertain_fields: ['year', 'set_name', 'player'], needs_lookup: true, retake: '' })).toBe(
      'unidentified',
    )
  })

  it('searches for a missing number or player when the rest of the card was read', () => {
    expect(triage({ uncertain_fields: ['card_number'], needs_lookup: true, retake: '' })).toBe('lookup')
    expect(triage({ uncertain_fields: ['player'], needs_lookup: true, retake: '' })).toBe('lookup')
  })

  it('sends a card it cannot search for to the collector even without a lookup request', () => {
    expect(triage({ uncertain_fields: ['player', 'set_name'], needs_lookup: false, retake: '' })).toBe('unidentified')
  })
})
